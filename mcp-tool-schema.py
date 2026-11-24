import asyncio
import json
import os

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
    async with sse_client(url) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            tools = await session.list_tools()
            for t in tools.tools:
                if t.name in ("ask-antigravity", "delegate-antigravity", "list-models"):
                    print("==", t.name, "==")
                    print(json.dumps(t.input_schema, indent=2, ensure_ascii=False))

asyncio.run(main())
