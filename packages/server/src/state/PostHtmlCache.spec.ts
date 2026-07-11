import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { createPostHtmlCache } from "./PostHtmlCache.js"

let tempDirs: string[] = []

const createTempDir = async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "post-html-cache-"))
  tempDirs.push(dir)
  return dir
}

afterEach(async () => {
  await Promise.all(tempDirs.map((dir) => rm(dir, { recursive: true, force: true })))
  tempDirs = []
})

describe("createPostHtmlCache", () => {
  it("returns null when a cached post html file does not exist", async () => {
    const cache = createPostHtmlCache({ cacheDir: await createTempDir() })

    await expect(
      cache.getPostHtml?.({ blogKey: "naver", sourceId: "blog/a", postId: "1" }),
    ).resolves.toBeNull()
  })

  it("writes and reads post html using encoded blog and post keys", async () => {
    const cache = createPostHtmlCache({ cacheDir: await createTempDir() })

    await cache.setPostHtml?.({
      blogKey: "naver",
      sourceId: "blog/a",
      postId: "1/2",
      html: "<html>cached</html>",
    })

    await expect(
      cache.getPostHtml?.({ blogKey: "naver", sourceId: "blog/a", postId: "1/2" }),
    ).resolves.toBe("<html>cached</html>")
  })

  it("keeps cache entries separate when encoded blog and post keys contain dashes", async () => {
    const cache = createPostHtmlCache({ cacheDir: await createTempDir() })

    await cache.setPostHtml?.({
      blogKey: "naver",
      sourceId: "a-b",
      postId: "c",
      html: "<html>a-b c</html>",
    })
    await cache.setPostHtml?.({
      blogKey: "naver",
      sourceId: "a",
      postId: "b-c",
      html: "<html>a b-c</html>",
    })

    await expect(
      cache.getPostHtml?.({ blogKey: "naver", sourceId: "a-b", postId: "c" }),
    ).resolves.toBe("<html>a-b c</html>")
    await expect(
      cache.getPostHtml?.({ blogKey: "naver", sourceId: "a", postId: "b-c" }),
    ).resolves.toBe("<html>a b-c</html>")
  })

  it("stores post IDs longer than a filesystem path segment", async () => {
    const cache = createPostHtmlCache({ cacheDir: await createTempDir() })
    const input = {
      blogKey: "tistory",
      sourceId: "example.com",
      postId: "긴-게시물-슬러그".repeat(30),
    }

    await cache.setPostHtml?.({ ...input, html: "<article>cached</article>" })

    await expect(cache.getPostHtml?.(input)).resolves.toBe("<article>cached</article>")
  })
})
