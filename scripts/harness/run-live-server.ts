import { createHttpServer } from "../../src/server/http-server.js"
import { NaverBlogFetcher } from "../../src/modules/blog-fetcher/naver-blog-fetcher.js"

const wait = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })

const delayMs = Number(process.env.FAREWELL_LIVE_FETCH_DELAY_MS ?? "0")
const delayedLogNos = new Set(
  (process.env.FAREWELL_LIVE_FETCH_DELAY_LOGNOS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean),
)

if (delayedLogNos.size > 0 && delayMs > 0) {
  const originalFetchPostHtml = NaverBlogFetcher.prototype.fetchPostHtml

  NaverBlogFetcher.prototype.fetchPostHtml = async function patchedFetchPostHtml(logNo: string) {
    const html = await originalFetchPostHtml.call(this, logNo)

    if (delayedLogNos.has(logNo)) {
      await wait(delayMs)
    }

    return html
  }
}

const server = createHttpServer({
  settingsPath: process.env.FAREWELL_SETTINGS_PATH,
  scanCachePath: process.env.FAREWELL_SCAN_CACHE_PATH,
})

const shutdown = () => {
  server.close(() => {
    process.exit(0)
  })
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)

server.listen(0, "127.0.0.1", () => {
  const address = server.address()

  if (!address || typeof address === "string") {
    console.error("READY_FAILED")
    process.exit(1)
    return
  }

  console.log(`READY ${address.port}`)
})
