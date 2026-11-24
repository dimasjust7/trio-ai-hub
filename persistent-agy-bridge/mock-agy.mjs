#!/usr/bin/env node
/**
 * mock-agy.mjs — a fake `agy` for testing persistent-agy-bridge/server.mjs.
 *
 * Speaks the same NDJSON stream-json protocol as real agy:
 *   stdin  <- {"event":"user","message":{"content":"..."}} lines
 *   stdout -> {"event":"init",...} once, then per turn a step_update and a
 *             {"event":"result","result":{...}} with a canned response.
 *
 * Special prompt contents (for tests):
 *   "__CRASH__"  — exit(1) immediately, simulating an agy crash.
 *   "__SLOW__"   — wait 3 s before answering (used for timeout tests).
 *
 * Env:
 *   MOCK_AGY_LOG  — if set, append one line per process start
 *                   ("START <pid> <args>") so tests can count spawns.
 *   MOCK_AGY_DELAY_MS — artificial delay (ms) before each result event.
 *
 * CLI args are accepted and ignored (real agy gets --input-format etc.).
 */
import { appendFileSync } from "node:fs";

const logFile = process.env.MOCK_AGY_LOG || "";
if (logFile) {
  try {
    appendFileSync(logFile, `START pid=${process.pid} args=${process.argv.slice(2).join(" ")}\n`);
  } catch {
    /* ignore */
  }
}

const delayMs = Number(process.env.MOCK_AGY_DELAY_MS || 0);
const conversationId = `mock-conv-${process.pid}`;
let numTurns = 0;

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

// init event, once at stream start.
send({
  event: "init",
  conversation_id: conversationId,
  init: { cwd: process.cwd(), tools: ["mock_tool"], permission_mode: "request-review", model: "Mock Neon (High)" },
});

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let idx;
  while ((idx = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, idx).trim();
    buf = buf.slice(idx + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      // Real agy ends the session with ERROR on invalid JSON; mirror that.
      send({
        event: "result",
        result: {
          conversation_id: conversationId,
          status: "ERROR",
          response: "",
          error: "invalid JSON line",
          duration_seconds: 0,
          num_turns: numTurns,
          usage: { input_tokens: 0, output_tokens: 0, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 0 },
        },
      });
      process.exit(1);
    }
    if (msg.event !== "user") continue; // unrecognized events are skipped
    const content =
      typeof msg.message?.content === "string"
        ? msg.message.content
        : Array.isArray(msg.message?.content)
          ? msg.message.content.map((b) => b.text || "").join("")
          : "";
    if (content.includes("__CRASH__")) {
      process.stderr.write("mock-agy: simulated crash\n");
      process.exit(1);
    }
    const waitMs = content.includes("__SLOW__") ? 3000 : delayMs;
    numTurns += 1;
    const turnNo = numTurns;
    const reply = `mock reply to: ${content}`;
    const finish = () => {
      send({
        event: "step_update",
        step_update: {
          conversation_id: conversationId,
          step_index: turnNo * 2,
          state: "DONE",
          step_type: "agent_response",
          text_delta: reply + "\n",
          duration_seconds: 0.01,
          usage: { input_tokens: 10, output_tokens: 5, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 15 },
        },
      });
      send({
        event: "result",
        result: {
          conversation_id: conversationId,
          status: "SUCCESS",
          response: reply + "\n",
          duration_seconds: 0.01,
          num_turns: turnNo,
          usage: { input_tokens: 10, output_tokens: 5, thinking_tokens: 0, cache_read_tokens: 0, total_tokens: 15 },
        },
      });
    };
    if (waitMs > 0) setTimeout(finish, waitMs);
    else finish();
  }
});
process.stdin.on("end", () => process.exit(0));
