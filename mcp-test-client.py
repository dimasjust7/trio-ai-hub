import asyncio
import os

# Sanitize proxy env BEFORE importing httpx/mcp: NO_PROXY contains bracketed
# IPv6 entries ([::1], [fd8b:...]) that httpx chokes on when building URL
# patterns. Clear it, and point the proxy at the runtime tunnel (port 3130).
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

from mcp.client.sse import sse_client
from mcp import ClientSession

async def main():
    url = "http://100.127.155.110:8999/sse"
    print("Connecting to", url, flush=True)
    async with sse_client(url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            print("Initialized OK", flush=True)
            tools = await session.list_tools()
            print("Tools:", flush=True)
            for t in tools.tools:
                print(" -", t.name, flush=True)
            print("Calling ask-antigravity...", flush=True)
            result = await session.call_tool(
                "ask-antigravity",
                {"prompt": "Jawab dengan satu kalimat: berapa 2+2?"},
            )
            print("Result:", flush=True)
            for c in result.content:
                print(c.text if hasattr(c, "text") else c, flush=True)

asyncio.run(main())
