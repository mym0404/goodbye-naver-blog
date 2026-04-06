import { afterEach, describe, expect, it, vi } from "vitest"

import { NaverBlogFetcher } from "../src/modules/blog-fetcher/naver-blog-fetcher.js"

describe("NaverBlogFetcher", () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("retries getPostCount after an aborted request", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockImplementationOnce((_, init) => {
        return new Promise<Response>((_, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Request timed out", "AbortError"))
          })
        })
      })
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            result: {
              postCount: 12,
            },
          }),
          {
            status: 200,
            headers: {
              "content-type": "application/json",
            },
          },
        ),
      )

    vi.stubGlobal("fetch", fetchMock)

    const fetcher = new NaverBlogFetcher({
      blogId: "mym0404",
    })

    Reflect.set(fetcher, "requestTimeoutMs", 10)
    Reflect.set(fetcher, "retryDelays", [0, 0])

    await expect(fetcher.getPostCount()).resolves.toBe(12)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  }, 500)
})
