#!/usr/bin/env node
/**
 * persistent-agy-bridge — MCP server (stdio) that holds ONE long-lived
 * `agy --input-format stream-json --output-format stream-json` process.
 *
 * Why: the stock @trishchuk/antigravity-mcp-server spawns a fresh `agy -p`
 * per call (~30 s/call: cold start + Serena startup + model time). A single
 * persistent stream-json process skips the startup overhead on every turn
 * after the first, so calls cost model time only (~5-15 s for short prompts).
 *
 * Protocol (verified from https://antigravity.google/docs/cli/headless/):
 *   stdin  <- NDJSON lines: {"event":"user","message":{"content":"..."}}
 *   stdout -> NDJSON events: {"event":"init",...} once, then per turn
 *             {"event":"step_update",...} ... {"event":"result","result":{
 *             "conversation_id","status":"SUCCESS"|"ERROR","response",
 *             "duration_seconds","num_turns","usage":{...}}}
 *   One `result` event per turn. A single conversation_id tracks the whole
 *   session; `init` is sent only once. There is NO documented "reset" event
 *   in the stream protocol, so resetSession=true restarts the child process.
 *   Model is pinned per process via --model / --effort CLI flags, so a
 *   different requested model also restarts the child process.
 *
 * Transport: this server speaks MCP over stdio. It is meant to be exposed
 * over SSE by supergateway, exactly like the old bridge:
 *   supergateway --stdio "node <path-to>/server.mjs" --port 8999 --host 0.0.0.0
 *
 * Logging goes to stderr ONLY. stdout is reserved for the MCP protocol.
 * No API keys, no paid services, no credentials anywhere in this file.
 */

import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import http from "node:http";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Config (env vars, all optional)
// ---------------------------------------------------------------------------
const CFG = {
  agyPath: process.env.AGY_PATH || "agy",
  // Default model label, passed verbatim to `agy --model`. This is the same
  // display label the old bridge used ("Gemini 4 Neon (High)"), which agy
  // accepts. If your `agy models` output shows slugs instead, set
  // AGY_MODEL_SLUG to the exact slug and it is used verbatim instead.
  defaultModel: process.env.AGY_MODEL || "Gemini 4 Neon (High)",
  modelSlug: process.env.AGY_MODEL_SLUG || "",
  defaultEffort: process.env.AGY_EFFORT || "",
  cwd: process.env.AGY_CWD || process.cwd(),
  printTimeout: process.env.AGY_PRINT_TIMEOUT || "10m",
  // Max wait for one turn's `result` event before giving up + respawning.
  turnTimeoutMs: Number(process.env.AGY_TURN_TIMEOUT_MS || 600_000),
  // Max wait for the `init` event after spawning.
  initTimeoutMs: Number(process.env.AGY_INIT_TIMEOUT_MS || 120_000),
  // Extra CLI flags, space-separated, e.g. "--dangerously-skip-permissions".
  // Off by default. Only set this if you understand the permission warning
  // in the agy docs (it auto-approves every tool call, incl. file writes).
  extraArgs: (process.env.AGY_EXTRA_ARGS || "").split(/\s+/).filter(Boolean),
};

function log(...args) {
  console.error(`[${new Date().toISOString()} persistent-agy]`, ...args);
}

// ---------------------------------------------------------------------------
// Persistent agy child process
// ---------------------------------------------------------------------------
class PersistentAgy {
  constructor() {
    this.child = null; // ChildProcess | null
    this.modelLabel = null; // label the running child was started with
    this.effort = null; // effort the running child was started with
    this.startedAt = null;
    this.turns = 0; // turns completed in this child
    this.lineBuf = "";
    this.initWaiters = []; // [{resolve, reject, timer}]
    this.pending = null; // {resolve, reject, timer} for the in-flight turn
    this.queue = Promise.resolve(); // serialises all asks
    this.stopping = false; // true while we intentionally kill the child
    this.dead = true;
    this.lastStderr = []; // last ~20 stderr lines, for diagnostics
    this.respawnScheduled = false;
    this.spawnCount = 0;
  }

  modelArg(label) {
    return CFG.modelSlug || label;
  }

  buildArgs(label, effort) {
    const args = [
      "--input-format",
      "stream-json",
      "--output-format",
      "stream-json",
      "--model",
      this.modelArg(label),
    ];
    if (effort) args.push("--effort", effort);
    if (CFG.printTimeout) args.push("--print-timeout", CFG.printTimeout);
    args.push(...CFG.extraArgs);
    return args;
  }

  spawn(label, effort) {
    if (this.child) throw new Error("spawn called while a child is alive");
    const args = this.buildArgs(label, effort);
    log(`spawning: ${CFG.agyPath} ${args.join(" ")} (cwd=${CFG.cwd})`);
    const child = spawn(CFG.agyPath, args, {
      cwd: CFG.cwd,
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true,
    });
    this.child = child;
    this.modelLabel = label;
    this.effort = effort || null;
    this.startedAt = Date.now();
    this.turns = 0;
    this.lineBuf = "";
    this.dead = false;
    this.spawnCount += 1;

    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => this.onStdout(chunk));
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => this.onStderr(chunk));
    child.on("error", (err) => {
      if (this.stopping) return; // intentional kill; ignore
      this.onUnexpectedExit(`spawn error: ${err.message}`);
    });
    child.on("exit", (code, signal) => {
      if (this.stopping) return; // intentional kill (reset / shutdown)
      this.onUnexpectedExit(`exited code=${code} signal=${signal}`);
    });
    return this.waitForInit();
  }

  waitForInit() {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.initWaiters = this.initWaiters.filter((w) => w.timer !== timer);
        reject(new Error(`agy did not emit an init event within ${CFG.initTimeoutMs} ms`));
      }, CFG.initTimeoutMs);
      this.initWaiters.push({ resolve, reject, timer });
    });
  }

  onStderr(chunk) {
    for (const line of String(chunk).split(/\r?\n/)) {
      if (!line.trim()) continue;
      this.lastStderr.push(line);
      if (this.lastStderr.length > 20) this.lastStderr.shift();
      log("[agy:stderr]", line);
    }
  }

  onStdout(chunk) {
    this.lineBuf += chunk;
    let idx;
    while ((idx = this.lineBuf.indexOf("\n")) >= 0) {
      const line = this.lineBuf.slice(0, idx).trim();
      this.lineBuf = this.lineBuf.slice(idx + 1);
      if (!line) continue;
      let evt;
      try {
        evt = JSON.parse(line);
      } catch {
        log("[agy:stdout] unparsable line (ignored):", line.slice(0, 200));
        continue;
      }
      this.onEvent(evt);
    }
  }

  onEvent(evt) {
    if (evt.event === "init") {
      const waiters = this.initWaiters.splice(0);
      for (const w of waiters) {
        clearTimeout(w.timer);
        w.resolve(evt);
      }
      log(`agy ready (conversation_id=${evt.conversation_id || "?"})`);
      return;
    }
    if (evt.event === "result") {
      const r = evt.result || {};
      if (this.pending) {
        const p = this.pending;
        this.pending = null;
        clearTimeout(p.timer);
        if (r.status === "SUCCESS") {
          this.turns += 1;
          log(
            `turn done: status=SUCCESS num_turns=${r.num_turns} ` +
              `duration=${r.duration_seconds}s ` +
              `tokens=${r.usage ? r.usage.total_tokens : "?"}`
          );
          p.resolve(r);
        } else {
          p.reject(new Error(`agy turn failed: ${r.error || r.status || "unknown error"}`));
        }
      } else {
        log("[agy] unexpected result event with no pending turn (ignored)");
      }
      return;
    }
    // step_update and anything else: ignore (progress noise).
  }

  onUnexpectedExit(reason) {
    const wasAlive = !this.dead;
    this.dead = true;
    this.child = null;
    // Reject the in-flight turn, if any.
    if (this.pending) {
      const p = this.pending;
      this.pending = null;
      clearTimeout(p.timer);
      p.reject(new Error(`agy process died mid-turn (${reason}). The next call will respawn it.`));
    }
    // Reject init waiters, if any.
    const waiters = this.initWaiters.splice(0);
    for (const w of waiters) {
      clearTimeout(w.timer);
      w.reject(new Error(`agy process died before init (${reason})`));
    }
    if (wasAlive) {
      log(`[agy] DIED unexpectedly: ${reason}`);
      if (this.lastStderr.length) {
        log("[agy] last stderr:", this.lastStderr.join(" | ").slice(0, 1000));
      }
      // Survive one crash: schedule a single automatic respawn so the next
      // call is fast. If that respawn also dies, stay dead; the next ask()
      // will try a fresh spawn on demand.
      if (!this.respawnScheduled) {
        this.respawnScheduled = true;
        setTimeout(() => {
          this.respawnScheduled = false;
          if (this.dead && !this.stopping && !this.child) {
            log("[agy] auto-respawning after crash...");
            try {
              this.spawn(this.modelLabel || CFG.defaultModel, this.effort).catch((err) => {
                log("[agy] auto-respawn failed:", err.message);
              });
            } catch (err) {
              log("[agy] auto-respawn failed:", err.message);
            }
          }
        }, 1000);
      }
    }
  }

  async kill() {
    const child = this.child;
    if (!child) return;
    this.stopping = true;
    this.dead = true;
    this.child = null;
    try {
      child.stdin.end();
    } catch {
      /* already closed */
    }
    const exited = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve(false), 5000);
      child.once("exit", () => {
        clearTimeout(timer);
        resolve(true);
      });
    });
    if (!exited) {
      try {
        child.kill("SIGKILL");
      } catch {
        /* already gone */
      }
    }
    this.stopping = false;
  }

  async ensureAlive(label, effort) {
    if (this.child && !this.dead) return;
    await this.spawn(label, effort);
  }

  /**
   * Send one prompt and wait for its `result` event. Serialised: concurrent
   * calls queue up behind the in-flight turn, because agy handles one turn
   * at a time and `result` events arrive in order.
   * opts: { model?, effort?, resetSession? }
   */
  ask(prompt, opts = {}) {
    const run = async () => {
      const label = opts.model || CFG.defaultModel;
      const effort = opts.effort || CFG.defaultEffort || null;
      const modelChanged =
        this.child && !this.dead && (label !== this.modelLabel || effort !== this.effort);

      if (opts.resetSession) {
        log("resetSession=true: restarting agy for a fresh conversation");
        await this.kill();
      } else if (modelChanged) {
        log(`model changed (${this.modelLabel} -> ${label}): restarting agy`);
        await this.kill();
      }
      await this.ensureAlive(label, effort);

      return await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          if (this.pending && this.pending.timer === timer) {
            this.pending = null;
            reject(new Error(`agy turn timed out after ${CFG.turnTimeoutMs} ms; restarting agy`));
            // The turn is stuck; restart the child so later calls are clean.
            this.kill()
              .catch(() => {})
              .finally(() => {
                this.ensureAlive(label, effort).catch((e) => log("[agy] respawn after timeout failed:", e.message));
              });
          }
        }, CFG.turnTimeoutMs);
        this.pending = { resolve, reject, timer };
        const line = JSON.stringify({ event: "user", message: { content: prompt } });
        try {
          this.child.stdin.write(line + "\n");
        } catch (err) {
          clearTimeout(timer);
          this.pending = null;
          reject(new Error(`failed to write to agy stdin: ${err.message}`));
        }
      });
    };
    // Chain onto the queue so turns never overlap.
    const p = this.queue.then(run);
    // Keep the chain alive even if this call rejects.
    this.queue = p.catch(() => {});
    return p;
  }

  status() {
    return {
      alive: Boolean(this.child && !this.dead),
      pid: this.child ? this.child.pid : null,
      model: this.modelLabel,
      effort: this.effort,
      turnsInSession: this.turns,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      spawnCount: this.spawnCount,
      cwd: CFG.cwd,
      agyPath: CFG.agyPath,
    };
  }

  async shutdown() {
    this.stopping = true;
    await this.kill();
  }
}

// ---------------------------------------------------------------------------
// MCP server
// ---------------------------------------------------------------------------
const agy = new PersistentAgy();

// One McpServer instance serves exactly ONE client session: the MCP
// Protocol rejects a second `initialize` ("Server already initialized").
// The daemon therefore builds a FRESH McpServer per client session, while
// all of them share the single PersistentAgy above. The server object is
// cheap; the agy process is the expensive part, and it is shared.
function buildMcpServer() {
  const server = new McpServer({
    name: "persistent-antigravity",
    version: "1.0.0",
  });

const EFFORTS = ["low", "medium", "high", "xhigh", "max"];

server.tool(
  "ask-antigravity",
  "Ask the persistent Antigravity agent (Gemini) a question. One long-lived " +
    "agy process answers; the conversation continues across calls unless " +
    "resetSession is true. Same interface as the old @trishchuk bridge.",
  {
    prompt: z.string().min(1).describe("The prompt to send to Antigravity."),
    model: z
      .string()
      .optional()
      .describe(
        'Model display label, e.g. "Gemini 4 Neon (High)". Defaults to AGY_MODEL. ' +
          "A different model restarts the agy process."
      ),
    effort: z
      .enum(EFFORTS)
      .optional()
      .describe("Reasoning effort (low/medium/high/xhigh/max). Overrides the default effort."),
    resetSession: z
      .boolean()
      .optional()
      .describe(
        "If true, restart the agy process for a fresh conversation before answering."
      ),
  },
  async ({ prompt, model, effort, resetSession }) => {
    try {
      const result = await agy.ask(prompt, { model, effort, resetSession });
      return { content: [{ type: "text", text: result.response || "" }] };
    } catch (err) {
      return {
        content: [{ type: "text", text: `ERROR: ${err.message}` }],
        isError: true,
      };
    }
  }
);

server.tool("ping", "Health check. Returns pong.", {}, async () => ({
  content: [{ type: "text", text: "pong" }],
}));

server.tool(
  "health",
  "Report the persistent agy process status (alive, pid, model, turns in this session, uptime).",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(agy.status(), null, 2) }],
  })
);

server.tool(
  "list-models",
  "List available agy models by running one-shot `agy models` (separate short-lived process).",
  {},
  async () => {
    const { spawn } = await import("node:child_process");
    return await new Promise((resolve) => {
      const child = spawn(CFG.agyPath, ["models"], { stdio: ["ignore", "pipe", "pipe"] });
      let out = "";
      let errOut = "";
      const timer = setTimeout(() => {
        try {
          child.kill("SIGKILL");
        } catch {
          /* gone */
        }
        resolve({
          content: [{ type: "text", text: "ERROR: `agy models` timed out after 60s" }],
          isError: true,
        });
      }, 60_000);
      child.stdout.setEncoding("utf8");
      child.stdout.on("data", (d) => (out += d));
      child.stderr.setEncoding("utf8");
      child.stderr.on("data", (d) => (errOut += d));
      child.on("error", (e) => {
        clearTimeout(timer);
        resolve({ content: [{ type: "text", text: `ERROR: ${e.message}` }], isError: true });
      });
      child.on("exit", (code) => {
        clearTimeout(timer);
        if (code === 0) resolve({ content: [{ type: "text", text: out }] });
        else
          resolve({
            content: [{ type: "text", text: `ERROR (exit ${code}): ${errOut || out}` }],
            isError: true,
          });
      });
    });
  }
);

  return server;
}

// ---------------------------------------------------------------------------
// Start: boot agy once, then serve MCP.
//
// TWO MODES (pick one):
//   stdio (default): `node server.mjs`
//     Speaks MCP over stdin/stdout. Meant to be wrapped by supergateway:
//       supergateway --stdio "node <path>/server.mjs" --port 8999
//     Caveat, VERIFIED by test: supergateway spawns a FRESH server child per
//     SSE client session, so the agy process only persists WITHIN one client
//     session. One-shot client scripts (one session per run) still pay the
//     agy cold start on every run. Use this mode only if the client holds a
//     single session open for many calls.
//   http (recommended): `node server.mjs --http [--port 8999] [--host 0.0.0.0]`
//     Serves MCP Streamable HTTP on /mcp plus GET /health. The daemon mints
//     one transport + one McpServer per client session, but all sessions
//     share the ONE agy child, which lives as long as the daemon runs. Any
//     number of one-shot client connections share that agy process, so the
//     cold start is paid once at daemon boot and never again. This is the
//     mode that actually delivers "one long-lived agy process" for
//     one-shot clients.
// ---------------------------------------------------------------------------
function cliArg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

async function serveHttp(port, host) {
  // One transport + one McpServer per client session, all sharing the single
  // PersistentAgy. Sessions are keyed by the `mcp-session-id` header the
  // client sends after initialize. Why not one shared transport/server?
  // Verified by test: (1) the SDK's STATELESS mode throws "Stateless
  // transport cannot be reused across requests" on the 2nd request, and
  // (2) a shared STATEFUL server rejects a 2nd client's `initialize` with
  // "Server already initialized" — one Protocol instance serves exactly one
  // client session. So the daemon mints a fresh transport+server per
  // session; the expensive part (the agy process) stays shared.
  const sessions = new Map(); // sessionId -> { transport, server }

  async function handleMcp(req, res, body) {
    const sessionId = req.headers["mcp-session-id"];
    const isInit = body && body.method === "initialize" && !sessionId;
    let entry = sessionId ? sessions.get(sessionId) : undefined;
    if (!entry) {
      if (!isInit) {
        res.writeHead(404, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32001, message: "Session not found" },
            id: body && body.id !== undefined ? body.id : null,
          })
        );
        return;
      }
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      const server = buildMcpServer();
      await server.connect(transport);
      entry = { transport, server };
      transport.onclose = () => {
        if (transport.sessionId) sessions.delete(transport.sessionId);
      };
    }
    await entry.transport.handleRequest(req, res, body);
    // The session id is minted while handling initialize; record it now so
    // the client's next request routes to this session.
    if (entry.transport.sessionId) sessions.set(entry.transport.sessionId, entry);
    if (req.method === "DELETE" && sessionId) sessions.delete(sessionId);
  }

  const httpServer = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
      if (url.pathname === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(JSON.stringify(agy.status()));
        return;
      }
      if (url.pathname !== "/mcp") {
        res.writeHead(404, { "content-type": "text/plain" });
        res.end("not found (use POST /mcp, GET /health)");
        return;
      }
      const body = req.method === "POST" ? await readJsonBody(req) : undefined;
      await handleMcp(req, res, body);
    } catch (err) {
      log("http error:", err.message);
      if (!res.headersSent) res.writeHead(500, { "content-type": "text/plain" });
      res.end(`error: ${err.message}`);
    }
  });
  await new Promise((resolve) => httpServer.listen(port, host, resolve));
  log(`persistent-antigravity MCP server (HTTP) listening on http://${host}:${port}/mcp`);
  return httpServer;
}

async function main() {
  // Warm up the persistent process at startup so the first call is fast.
  // If agy is not installed / not logged in, log the error and keep serving
  // MCP anyway: the next ask-antigravity call will retry the spawn on demand.
  try {
    await agy.spawn(CFG.defaultModel, CFG.defaultEffort || null);
    log(`persistent agy ready (model=${agy.modelLabel})`);
  } catch (err) {
    log(`WARNING: initial agy spawn failed (${err.message}). Will retry on first ask-antigravity call.`);
  }

  const useHttp = process.argv.includes("--http");
  let httpServer = null;
  if (useHttp) {
    const port = Number(cliArg("--port", "8999"));
    const host = cliArg("--host", "127.0.0.1");
    httpServer = await serveHttp(port, host);
  } else {
    const server = buildMcpServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    log("persistent-antigravity MCP server listening on stdio");
  }

  const shutdown = async () => {
    log("shutting down...");
    try {
      if (httpServer) await new Promise((r) => httpServer.close(r));
    } catch {
      /* ignore */
    }
    await agy.shutdown();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  log("fatal:", err);
  process.exit(1);
});
