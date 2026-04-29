import { mkdir, writeFile as writeFileDefault } from "node:fs/promises"
import path from "node:path"

import { NaverBlogFetcher } from "../../src/modules/fetcher/NaverBlogFetcher.js"
import type { SinglePostFetcher } from "../../src/modules/exporter/SinglePostExport.js"
import { log } from "../../src/shared/Logger.js"
import type { PostSummary, ScanResult } from "../../src/shared/Types.js"

export type SinglePostMetadataCacheFile = {
  blogId: string
  scan: ScanResult
  posts: PostSummary[]
}

type CreateSinglePostMetadataCachingFetcherArgs = {
  blogId: string
  cachePath: string | null
  readFile: (path: string, encoding: "utf8") => Promise<string>
  writeFile?: (path: string, contents: string, encoding: "utf8") => Promise<void>
  createFetcher?: (input: { blogId: string }) => SinglePostFetcher | Promise<SinglePostFetcher>
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const isString = (value: unknown): value is string => typeof value === "string"

const isPostSummary = (value: unknown): value is PostSummary => {
  if (!isObject(value)) {
    return false
  }

  return (
    isString(value.blogId) &&
    isString(value.logNo) &&
    isString(value.title) &&
    isString(value.publishedAt) &&
    typeof value.categoryId === "number" &&
    isString(value.categoryName) &&
    isString(value.source) &&
    (value.thumbnailUrl === null || isString(value.thumbnailUrl))
  )
}

const isScanResult = (value: unknown): value is ScanResult => {
  if (!isObject(value)) {
    return false
  }

  return (
    isString(value.blogId) &&
    typeof value.totalPostCount === "number" &&
    Array.isArray(value.categories) &&
    value.categories.every((category) => isObject(category) && isString(category.name))
  )
}

const parseCacheFile = (value: unknown): SinglePostMetadataCacheFile | null => {
  if (!isObject(value)) {
    return null
  }

  if (!isString(value.blogId) || !isScanResult(value.scan) || !Array.isArray(value.posts)) {
    return null
  }

  if (value.scan.blogId !== value.blogId) {
    return null
  }

  if (!value.posts.every(isPostSummary)) {
    return null
  }

  return {
    blogId: value.blogId,
    scan: value.scan,
    posts: value.posts,
  }
}

export const createSinglePostMetadataCachingFetcher = async ({
  blogId,
  cachePath,
  readFile: readFileImpl,
  writeFile,
  createFetcher,
}: CreateSinglePostMetadataCachingFetcherArgs): Promise<SinglePostFetcher> => {
  const resolvedCachePath = cachePath ? path.resolve(cachePath) : null
  const writeFileImpl = writeFile ?? writeFileDefault
  const baseFetcher =
    (await createFetcher?.({
      blogId,
    })) ??
    new NaverBlogFetcher({
      blogId,
    })

  let cachedScan: ScanResult | null = null
  let cachedPosts: PostSummary[] | null = null

  if (resolvedCachePath) {
    try {
      const cacheText = await readFileImpl(resolvedCachePath, "utf8")
      const cache = parseCacheFile(JSON.parse(cacheText))

      if (!cache) {
        throw new Error("cache contents are invalid")
      }

      if (cache.blogId !== blogId) {
        throw new Error(`blogId mismatch: expected ${blogId}, received ${cache.blogId}`)
      }

      cachedScan = cache.scan
      cachedPosts = cache.posts
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)

      if (!message.includes("ENOENT")) {
        log(`metadata cache 재사용 실패: ${resolvedCachePath}`)
        throw new Error(`Invalid metadata cache in ${resolvedCachePath}: ${message}`)
      }
    }
  }

  const persistCache = async () => {
    if (!resolvedCachePath || !cachedScan || !cachedPosts) {
      return
    }

    await mkdir(path.dirname(resolvedCachePath), { recursive: true })
    await writeFileImpl(
      resolvedCachePath,
      `${JSON.stringify(
        {
          blogId,
          scan: cachedScan,
          posts: cachedPosts,
        },
        null,
        2,
      )}\n`,
      "utf8",
    )
  }

  return {
    scanBlog: async () => {
      if (cachedScan) {
        return cachedScan
      }

      cachedScan = await baseFetcher.scanBlog()
      await persistCache()
      return cachedScan
    },
    getAllPosts: async () => {
      if (cachedPosts) {
        return cachedPosts
      }

      cachedPosts = await baseFetcher.getAllPosts()
      await persistCache()
      return cachedPosts
    },
    fetchPostHtml: async (requestedLogNo: string) => baseFetcher.fetchPostHtml(requestedLogNo),
    downloadBinary: async (input) => baseFetcher.downloadBinary(input),
    fetchBinary: async (input) => baseFetcher.fetchBinary(input),
  }
}
