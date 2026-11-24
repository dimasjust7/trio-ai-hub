#!/usr/bin/env python3
"""End-to-end test of persistent-agy-bridge/server.mjs against mock-agy.mjs.

Spawns the real MCP server over stdio (via the Python MCP SDK) with
AGY_PATH pointed at the mock, then asserts:
  1. tools list contains ask-antigravity (+ ping/health/list-models)
  2. ask returns the mock's canned reply
  3. persistence: 2nd ask is served by the SAME mock process (spawn log
     still shows 1 START line)
  4. resetSession=true restarts the process (spawn log grows to 2)
  5. a different model restarts the process (spawn log grows to 3)
  6. crash recovery: a __CRASH__ prompt errors, the next ask succeeds
     (auto-respawn), spawn log grows
  7. ping -> pong, health -> alive JSON

Run:  ~/.venvs/mcp-remote/bin/python test-mock.py
Exit code 0 = all pass.
"""
import asyncio
import json
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = "/tmp/mock-agy-spawns.log"
SERVER = os.path.join(HERE, "server.mjs")
MOCK = os.path.join(HERE, "mock-agy.mjs")

for k in ("NO_PROXY", "no_proxy"):
    os.environ.pop(k, None)

from mcp.client.stdio import stdio_client
from mcp import ClientSession, StdioServerParameters


def spawn_count():
    try:
        with open(LOG) as f:
            return len([l for l in f if l.startswith("START")])
    except FileNotFoundError:
        return 0


def check(name, cond, detail=""):
    print(("PASS " if cond else "FAIL ") + name + (f" — {detail}" if detail else ""))
    if not cond:
        check.failed = True


check.failed = False


async def call(session, name, args):
    result = await session.call_tool(name, args)
    texts = [c.text for c in result.content if hasattr(c, "text")]
    return result, texts


async def main():
    if os.path.exists(LOG):
        os.remove(LOG)
    env = dict(os.environ)
    env["AGY_PATH"] = MOCK
    env["MOCK_AGY_LOG"] = LOG
    env["AGY_TURN_TIMEOUT_MS"] = "30000"
    env["AGY_INIT_TIMEOUT_MS"] = "15000"

    params = StdioServerParameters(command="node", args=[SERVER], env=env)
    async with stdio_client(params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            names = sorted(t.name for t in tools.tools)
            check("tools listed", "ask-antigravity" in names, f"tools={names}")

            # 2. first ask
            _, texts = await call(session, "ask-antigravity", {"prompt": "berapa 2+2?"})
            check("ask returns mock reply", texts and texts[0].strip() == "mock reply to: berapa 2+2?",
                  f"got={texts}")

            # 3. persistence: second ask, same process (spawn log still 1)
            _, texts = await call(session, "ask-antigravity", {"prompt": "lanjut"})
            check("second ask works", texts and "mock reply to: lanjut" in texts[0], f"got={texts}")
            time.sleep(0.2)
            check("persistence: still 1 agy process after 2 asks", spawn_count() == 1,
                  f"spawns={spawn_count()}")

            # 4. resetSession restarts the process
            _, texts = await call(session, "ask-antigravity",
                                  {"prompt": "fresh", "resetSession": True})
            check("resetSession ask works", texts and "mock reply to: fresh" in texts[0], f"got={texts}")
            time.sleep(0.2)
            check("resetSession restarted agy", spawn_count() == 2, f"spawns={spawn_count()}")

            # 5. model change restarts the process
            _, texts = await call(session, "ask-antigravity",
                                  {"prompt": "model lain", "model": "Gemini 4 Carbon (High)"})
            check("model-change ask works", texts and "mock reply to: model lain" in texts[0],
                  f"got={texts}")
            time.sleep(0.2)
            check("model change restarted agy", spawn_count() == 3, f"spawns={spawn_count()}")

            # 6. crash recovery (stay on the Carbon child so no model-change
            # restart muddies the spawn count)
            result, texts = await call(session, "ask-antigravity",
                                       {"prompt": "__CRASH__", "model": "Gemini 4 Carbon (High)"})
            check("crash turn reports error", bool(result.is_error) or (texts and texts[0].startswith("ERROR")),
                  f"is_error={result.is_error} texts={texts}")
            await asyncio.sleep(2.0)  # let the 1s auto-respawn fire
            _, texts = await call(session, "ask-antigravity",
                                  {"prompt": "sesudah crash", "model": "Gemini 4 Carbon (High)"})
            check("ask after crash succeeds (respawn)", texts and "mock reply to: sesudah crash" in texts[0],
                  f"got={texts}")
            time.sleep(0.2)
            check("crash caused exactly one extra spawn", spawn_count() == 4,
                  f"spawns={spawn_count()}")

            # 7. ping + health
            _, texts = await call(session, "ping", {})
            check("ping -> pong", texts == ["pong"], f"got={texts}")
            _, texts = await call(session, "health", {})
            try:
                h = json.loads(texts[0])
                check("health alive", h.get("alive") is True and h.get("turnsInSession", 0) >= 1,
                      f"health={h}")
            except Exception as e:
                check("health alive", False, f"bad JSON: {texts} ({e})")

    print("\nALL PASS" if not check.failed else "\nSOME TESTS FAILED")
    sys.exit(1 if check.failed else 0)


asyncio.run(main())
