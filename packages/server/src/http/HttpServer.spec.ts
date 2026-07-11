import {
  cleanupTestServerRoots,
  createTestHttpServer,
  startServer,
} from "@tests/support/server/HttpServerSpecHarness.js"
import { afterEach, describe, expect, it, vi } from "vitest"

import { createHttpServer } from "./HttpServer.js"

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("http server composition", () => {
  it("creates a node http server", () => {
    const server = createHttpServer()

    expect(server.listening).toBe(false)
    server.close()
  })

  it("publishes every registered blog in bootstrap", async () => {
    const server = createTestHttpServer()

    try {
      const baseUrl = await startServer(server)
      const response = await fetch(`${baseUrl}/api/export-defaults`)
      const body = (await response.json()) as { blogs: { key: string; label: string }[] }

      expect(body.blogs).toEqual([
        { key: "naver", label: "Naver Blog" },
        { key: "tistory", label: "Tistory" },
      ])
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await cleanupTestServerRoots()
    }
  })

  it("scans Tistory through the shared API route", async () => {
    const originalFetch = fetch
    vi.stubGlobal("fetch", async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)

      if (url === "https://sample.tistory.com/sitemap.xml") {
        return new Response("<urlset><url><loc>https://sample.tistory.com/42</loc></url></urlset>")
      }

      if (url === "https://sample.tistory.com/42") {
        return new Response(`
          <meta property="og:title" content="Tistory Route" />
          <meta property="article:published_time" content="2026-01-02T03:04:05+09:00" />
          <article><div class="tt_article_useless_p_margin"><p>Body</p></div></article>
        `)
      }

      return originalFetch(input, init)
    })
    const server = createTestHttpServer()

    try {
      const baseUrl = await startServer(server)
      const response = await fetch(`${baseUrl}/api/scan`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          blogKey: "tistory",
          sourceInput: "https://sample.tistory.com",
        }),
      })
      const body = (await response.json()) as {
        blogKey: string
        posts: { postId: string; title: string }[]
      }

      expect(response.status).toBe(200)
      expect(body).toMatchObject({
        blogKey: "tistory",
        posts: [{ postId: "42", title: "Tistory Route" }],
      })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()))
      })
      await cleanupTestServerRoots()
    }
  })
})
