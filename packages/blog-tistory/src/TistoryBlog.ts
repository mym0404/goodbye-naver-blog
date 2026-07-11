import { delay, mapConcurrent } from "@exitpress/engine/shared/async/util/AsyncTasks.js"
import { load } from "cheerio"

import type { BlogPostRef, BlogSource } from "@exitpress/domain/blog/schema/Blog.js"
import type { Blog } from "@exitpress/engine/blog/Blog.js"

import {
  getTistoryBlockTemplateDefinitions,
  parseTistoryPostHtml,
} from "./parsing/TistoryPostParser.js"

const blogKey = "tistory"
const uncategorized = "Uncategorized"
const metadataConcurrency = 1

type CreateTistoryBlogOptions = {
  fetchText?: (url: string, signal?: AbortSignal) => Promise<string>
  fetchBinary?: (url: string, signal?: AbortSignal) => Promise<Response>
}

const defaultFetchText = async (url: string, signal?: AbortSignal) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, { signal })

    if (response.ok) {
      return response.text()
    }

    if (response.status !== 429 || attempt === 3) {
      throw new Error(`Tistory fetch failed: ${response.status} ${url}`)
    }

    const retryAfter = Number(response.headers.get("retry-after"))
    const delayMs =
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1_000 : 500 * 2 ** attempt

    await delay(delayMs)
  }

  throw new Error(`Tistory fetch failed: ${url}`)
}

const defaultFetchBinary = (url: string, signal?: AbortSignal) => fetch(url, { signal })

const getOrigin = (source: BlogSource) => new URL(source.input).origin

const getPostId = (url: string) => {
  const pathname = new URL(url).pathname.replace(/\/$/, "")
  const segments = pathname.split("/").filter(Boolean)

  return decodeURIComponent(segments.at(-1) ?? pathname)
}

const getCanonicalPostUrls = ({ sitemap, source }: { sitemap: string; source: BlogSource }) => {
  const $ = load(sitemap, { xmlMode: true })
  const sourceHost = new URL(source.input).host
  const seen = new Set<string>()

  return $("loc")
    .toArray()
    .flatMap((node) => {
      const rawUrl = $(node).text().trim()

      if (!rawUrl) {
        return []
      }

      const url = new URL(rawUrl)
      const pathname = url.pathname.replace(/\/$/, "")

      if (
        url.host !== sourceHost ||
        pathname.startsWith("/m/") ||
        (!/^\/\d+$/.test(pathname) && !/^\/entry\/[^/]+$/.test(pathname))
      ) {
        return []
      }

      url.search = ""
      url.hash = ""
      url.pathname = pathname
      const canonical = url.href

      if (seen.has(canonical)) {
        return []
      }

      seen.add(canonical)
      return [canonical]
    })
}

const getMetaContent = (html: string, selectors: string[]) => {
  const $ = load(html)

  for (const selector of selectors) {
    const content = $(selector).first().attr("content")?.trim()

    if (content) {
      return content
    }
  }

  return undefined
}

const getEntryInfoCategory = (html: string) => {
  const match = /window\.T\.entryInfo\s*=\s*(\{[^\n]+\})\s*;/.exec(html)

  if (!match?.[1]) {
    return undefined
  }

  try {
    const entryInfo = JSON.parse(match[1]) as { categoryLabel?: unknown }

    return typeof entryInfo.categoryLabel === "string" ? entryInfo.categoryLabel.trim() : undefined
  } catch {
    return undefined
  }
}

const parsePostMetadata = ({
  html,
  source,
  sourceUrl,
}: {
  html: string
  source: BlogSource
  sourceUrl: string
}) => {
  const $ = load(html)
  const postId = getPostId(sourceUrl)
  const title =
    getMetaContent(html, ['meta[property="og:title"]', 'meta[name="title"]']) ??
    $("title").text().trim() ??
    postId
  const publishedAt =
    getMetaContent(html, [
      'meta[property="article:published_time"]',
      'meta[property="og:regDate"]',
      'meta[name="date"]',
    ]) ??
    $("time[datetime]").first().attr("datetime")?.trim() ??
    new Date(0).toISOString()
  const categoryName =
    getMetaContent(html, ['meta[property="article:section"]', 'meta[name="category"]']) ??
    getEntryInfoCategory(html) ??
    $('.post-category, .content-title .category a, a[href^="/category/"]').first().text().trim() ??
    uncategorized
  const thumbnailUrl =
    getMetaContent(html, ['meta[property="og:image"]', 'meta[name="twitter:image"]']) ?? undefined

  return {
    blogKey,
    sourceId: source.sourceId,
    postId,
    title: title || postId,
    sourceUrl,
    publishedAt,
    categoryName: categoryName.replace(/^['"]|['"]$/g, "").trim() || uncategorized,
    thumbnailUrl,
  }
}

export const createTistoryBlog = ({
  fetchText = defaultFetchText,
  fetchBinary = defaultFetchBinary,
}: CreateTistoryBlogOptions = {}): Blog => ({
  key: blogKey,
  label: "Tistory",
  parseSource: (input) => {
    const url = new URL(input.trim())

    return {
      blogKey,
      sourceId: url.host,
      displayName: url.host,
      input: url.href,
    }
  },
  scan: async (source, options) => {
    const sitemap = await fetchText(`${getOrigin(source)}/sitemap.xml`, options?.signal)
    const postUrls = getCanonicalPostUrls({ sitemap, source })

    if (postUrls.length === 0) {
      throw new Error(`Tistory sitemap contains no public posts: ${source.sourceId}`)
    }

    const metadata = await mapConcurrent({
      items: postUrls,
      concurrency: metadataConcurrency,
      mapper: async (sourceUrl) => {
        const postId = getPostId(sourceUrl)
        try {
          const cached = await options?.cache?.getPostHtml?.({
            blogKey,
            sourceId: source.sourceId,
            postId,
          })
          const html = cached ?? (await fetchText(sourceUrl, options?.signal))

          if (cached === null || cached === undefined) {
            await options?.cache?.setPostHtml?.({
              blogKey,
              sourceId: source.sourceId,
              postId,
              html,
            })
          }

          return parsePostMetadata({ html, source, sourceUrl })
        } catch (error) {
          if (
            options?.signal?.aborted ||
            (error instanceof Error &&
              ("code" in error || error.message.startsWith("Tistory fetch failed: 429")))
          ) {
            throw error
          }

          return parsePostMetadata({ html: "", source, sourceUrl })
        }
      },
    })
    const categoryIdByPath = new Map<string, number>()
    const getCategoryPath = (categoryName: string) =>
      categoryName
        .split("/")
        .map((part) => part.trim())
        .filter(Boolean)
    metadata.forEach(({ categoryName }) => {
      const pathParts = getCategoryPath(categoryName)

      pathParts.forEach((_, index) => {
        const categoryPath = pathParts.slice(0, index + 1).join("/")

        if (!categoryIdByPath.has(categoryPath)) {
          categoryIdByPath.set(categoryPath, categoryIdByPath.size)
        }
      })
    })

    const posts: BlogPostRef[] = metadata.map((post) => ({
      ...post,
      categoryId: categoryIdByPath.get(getCategoryPath(post.categoryName).join("/"))!,
      categoryName: getCategoryPath(post.categoryName).at(-1) ?? uncategorized,
    }))

    return {
      source,
      totalPostCount: posts.length,
      categories: [...categoryIdByPath].map(([categoryPath, id]) => {
        const pathParts = categoryPath.split("/")
        const parentPath = pathParts.slice(0, -1).join("/")

        return {
          id,
          name: pathParts.at(-1)!,
          parentId: parentPath ? categoryIdByPath.get(parentPath) : undefined,
          postCount: metadata.filter(({ categoryName }) => {
            const postCategoryPath = getCategoryPath(categoryName).join("/")

            return (
              postCategoryPath === categoryPath || postCategoryPath.startsWith(`${categoryPath}/`)
            )
          }).length,
          path: pathParts,
          depth: pathParts.length - 1,
        }
      }),
      posts,
    }
  },
  loadPostContent: async ({ source, post, cache, signal }) => {
    const cached = await cache?.getPostHtml?.({
      blogKey,
      sourceId: source.sourceId,
      postId: post.postId,
    })
    const html = cached ?? (await fetchText(post.sourceUrl || source.input, signal))

    if (cached === null || cached === undefined) {
      await cache?.setPostHtml?.({
        blogKey,
        sourceId: source.sourceId,
        postId: post.postId,
        html,
      })
    }

    const $ = load(html)
    const tags = $('meta[property="article:tag"]')
      .toArray()
      .map((node) => $(node).attr("content")?.trim())
      .filter((tag): tag is string => Boolean(tag))

    return { kind: "html", html, sourceUrl: post.sourceUrl || source.input, tags }
  },
  parseContent: ({ content, options }) => {
    if (content.kind !== "html") {
      throw new Error(`Unsupported Tistory content kind: ${content.kind}`)
    }

    return parseTistoryPostHtml({ html: content.html, tags: content.tags, options })
  },
  getBlockTemplateDefinitions: getTistoryBlockTemplateDefinitions,
  resolvePostLinkIdentity: (value) => {
    try {
      const url = new URL(value)
      const pathname = url.pathname.replace(/\/$/, "")

      if (!/^\/\d+$/.test(pathname) && !/^\/entry\/[^/]+$/.test(pathname)) {
        return undefined
      }

      return { blogKey, sourceId: url.host, postId: getPostId(url.href) }
    } catch {
      return undefined
    }
  },
  fetchBinary: async ({ sourceUrl }) => {
    const response = await fetchBinary(sourceUrl)

    if (!response.ok) {
      throw new Error(`Tistory binary fetch failed: ${response.status}`)
    }

    return {
      bytes: Buffer.from(await response.arrayBuffer()),
      contentType: response.headers.get("content-type"),
    }
  },
})
