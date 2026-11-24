import asyncio
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
            result = await session.call_tool("list-models", {})
            for c in result.content:
                print(c.text if hasattr(c, "text") else c)

asyncio.run(main())
