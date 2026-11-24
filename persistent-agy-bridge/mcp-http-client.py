#!/usr/bin/env python3
"""VM client for the persistent-agy HTTP daemon.

Drop-in replacement for mcp-test-client.py / mcp-test-neon.py, but talks
MCP Streamable HTTP to the daemon's /mcp endpoint instead of SSE.
Same proxy fix as the other mcp-*.py clients: clear NO_PROXY (bracketed
IPv6 entries break httpx) and point the proxy at the runtime tunnel
(port 3130) so the Tailscale address is reachable.

Usage:
  MCP_URL=http://100.127.155.110:8999/mcp python3 mcp-http-client.py "berapa 2+2?"
  MCP_URL=http://100.127.155.110:8999/mcp python3 mcp-http-client.py --model "Gemini 4 Neon (High)" --reset "berapa 2+2?"
Defaults: URL http://100.127.155.110:8999/mcp, prompt "Jawab dengan satu
kalimat: berapa 2+2?", model "Gemini 4 Neon (High)".

Run from the VM with the MCP venv:
  ~/.venvs/mcp-remote/bin/python mcp-http-client.py "prompt..."
"""
import argparse
import asyncio
import os
import sys

for k in ("NO_PROXY", "no_proxy"):
    os.environ.pop(k, None)
hp = os.environ.get("HTTPS_PROXY", "") or os.environ.get("https_proxy", "")
if hp:
    tun = hp.rsplit(":", 1)[0] + ":3130"
    os.environ["HTTP_PROXY"] = tun
    os.environ["HTTPS_PROXY"] = tun
    os.environ["http_proxy"] = tun
    os.environ["https_proxy"] = tun
    os.environ["ALL_PROXY"] = tun
    os.environ["all_proxy"] = tun

from mcp.client.streamable_http import streamable_http_client
from mcp import ClientSession


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt", nargs="?", default="Jawab dengan satu kalimat: berapa 2+2?")
    ap.add_argument("--model", default="Gemini 4 Neon (High)")
    ap.add_argument("--reset", action="store_true")
    ap.add_argument("--url", default=os.environ.get(
        "MCP_URL", "http://100.127.155.110:8999/mcp"))
    args = ap.parse_args()

    print("Connecting to", args.url, flush=True)
    async with streamable_http_client(args.url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("Initialized OK", flush=True)
            result = await session.call_tool(
                "ask-antigravity",
                {"prompt": args.prompt, "model": args.model,
                 "resetSession": args.reset},
            )
            for c in result.content:
                print(c.text if hasattr(c, "text") else c, flush=True)
            if getattr(result, "is_error", False):
                sys.exit(1)


asyncio.run(main())
