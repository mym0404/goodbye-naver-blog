import { mkdtemp, readFile, rm } from "node:fs/promises"
import path from "node:path"
import { tmpdir } from "node:os"

import { describe, expect, it, vi } from "vitest"

import { createSinglePostMetadataCachingFetcher } from "../scripts/lib/single-post-metadata-cache.js"

const createBaseFetcher = ({
  scanCount,
  postsCount,
}: {
  scanCount: { value: number }
  postsCount: { value: number }
}) => ({
  scanBlog: async () => {
    scanCount.value += 1

    return {
      blogId: "mym0404",
      totalPostCount: 1,
      categories: [
        {
          id: 85,
          name: "BOJ",
          parentId: null,
          postCount: 1,
          isDivider: false,
          isOpen: true,
          path: ["BOJ"],
          depth: 0,
        },
      ],
    }
  },
  getAllPosts: async () => {
    postsCount.value += 1

    return [
        {
          blogId: "mym0404",
          logNo: "223034929697",
          title: "Single post",
          publishedAt: "2024-01-02T03:04:05+09:00",
          categoryId: 85,
          categoryName: "BOJ",
          source: "https://blog.naver.com/mym0404/223034929697",
          thumbnailUrl: null,
        },
    ]
  },
  fetchPostHtml: async () => "<div />",
  downloadBinary: async () => {},
  fetchBinary: async () => ({
    bytes: Buffer.from("asset"),
    contentType: "image/png",
  }),
})

describe("single post metadata cache", () => {
  it("reuses cached metadata across repeated wrappers for the same blog", async () => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "single-post-cache-"))
    const cachePath = path.join(rootDir, "metadata-cache.json")
    const scanCount = { value: 0 }
    const postsCount = { value: 0 }
    const secondScanCount = { value: 0 }
    const secondPostsCount = { value: 0 }

    try {
      const firstFetcher = await createSinglePostMetadataCachingFetcher({
        blogId: "mym0404",
        cachePath,
        createFetcher: () => createBaseFetcher({ scanCount, postsCount }),
        readFile,
      })

      await firstFetcher.scanBlog()
      await firstFetcher.getAllPosts()

      expect(scanCount.value).toBe(1)
      expect(postsCount.value).toBe(1)
      expect(await readFile(cachePath, "utf8")).toContain("\"blogId\": \"mym0404\"")

      const secondFetcher = await createSinglePostMetadataCachingFetcher({
        blogId: "mym0404",
        cachePath,
        createFetcher: () => createBaseFetcher({ scanCount: secondScanCount, postsCount: secondPostsCount }),
        readFile,
      })

      await secondFetcher.scanBlog()
      await secondFetcher.getAllPosts()

      expect(secondScanCount.value).toBe(0)
      expect(secondPostsCount.value).toBe(0)
    } finally {
      await rm(rootDir, { recursive: true, force: true })
    }
  })
})
