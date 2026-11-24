#!/usr/bin/env python3
"""End-to-end test of persistent-agy-bridge/server.mjs in --http mode.

Starts the real server as a daemon (Streamable HTTP on 127.0.0.1:8999)
with AGY_PATH pointed at the mock, then opens TWO separate MCP client
sessions (simulating two one-shot script runs, like the VM's mcp-*.py
clients) and asserts:
  1. /health returns alive JSON
  2. both sessions' ask-antigravity calls succeed
  3. cross-session persistence: the mock spawn log shows exactly ONE
     agy process for both sessions (the cold start is paid once)
  4. resetSession in session 2 restarts agy (spawn log grows to 2)

Run:  ~/.venvs/mcp-remote/bin/python test-http.py
Exit code 0 = all pass.
"""
import asyncio
import json
import os
import subprocess
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
LOG = "/tmp/mock-agy-spawns.log"
SERVER = os.path.join(HERE, "server.mjs")
MOCK = os.path.join(HERE, "mock-agy.mjs")
PORT = 8999

for k in ("NO_PROXY", "no_proxy", "HTTP_PROXY", "HTTPS_PROXY", "http_proxy",
          "https_proxy", "ALL_PROXY", "all_proxy"):
    os.environ.pop(k, None)

from mcp.client.streamable_http import streamable_http_client
from mcp import ClientSession


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


async def one_session(prompt, **kwargs):
    url = f"http://127.0.0.1:{PORT}/mcp"
    async with streamable_http_client(url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            result = await session.call_tool("ask-antigravity",
                                             {"prompt": prompt, **kwargs})
            return [c.text for c in result.content if hasattr(c, "text")]


async def main():
    if os.path.exists(LOG):
        os.remove(LOG)
    env = dict(os.environ)
    env["AGY_PATH"] = MOCK
    env["MOCK_AGY_LOG"] = LOG
    env["AGY_TURN_TIMEOUT_MS"] = "30000"
    env["AGY_INIT_TIMEOUT_MS"] = "15000"

    proc = subprocess.Popen(
        ["node", SERVER, "--http", "--port", str(PORT), "--host", "127.0.0.1"],
        env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, text=True,
    )
    try:
        # wait for /health
        health = None
        for _ in range(50):
            try:
                with urllib.request.urlopen(f"http://127.0.0.1:{PORT}/health",
                                            timeout=1) as r:
                    health = json.loads(r.read())
                break
            except Exception:
                time.sleep(0.2)
        check("/health responds", health is not None, f"health={health}")
        check("/health alive", bool(health and health.get("alive")),
              f"health={health}")
        check("daemon booted exactly 1 agy", spawn_count() == 1,
              f"spawns={spawn_count()}")

        # session 1 (like one mcp-*.py run)
        t1 = await one_session("berapa 2+2?")
        check("session 1 ask works", t1 and "mock reply to: berapa 2+2?" in t1[0], f"got={t1}")

        # session 2 (a second, separate one-shot run)
        t2 = await one_session("lanjut")
        check("session 2 ask works", t2 and "mock reply to: lanjut" in t2[0], f"got={t2}")
        time.sleep(0.2)
        check("CROSS-SESSION persistence: still 1 agy after 2 sessions",
              spawn_count() == 1, f"spawns={spawn_count()}")

        # resetSession from session 2 restarts agy
        t3 = await one_session("fresh", resetSession=True)
        check("resetSession ask works", t3 and "mock reply to: fresh" in t3[0], f"got={t3}")
        time.sleep(0.2)
        check("resetSession restarted agy", spawn_count() == 2, f"spawns={spawn_count()}")
    finally:
        proc.terminate()
        try:
            err = proc.communicate(timeout=10)[1] or ""
        except subprocess.TimeoutExpired:
            proc.kill()
            err = proc.communicate()[1] or ""
        print("--- server stderr (last 12 lines) ---")
        print("\n".join(err.strip().splitlines()[-12:]))

    print("\nALL PASS" if not check.failed else "\nSOME TESTS FAILED")
    sys.exit(1 if check.failed else 0)


asyncio.run(main())
