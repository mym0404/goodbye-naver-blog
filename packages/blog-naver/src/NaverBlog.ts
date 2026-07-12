import { NaverBlogFetcher } from "@exitpress/blog-naver/integrations/naver-blog/NaverBlogFetcher.js"
import { extractSourceId, extractNaverBlogPostIdentity } from "@exitpress/blog-naver/NaverUrl.js"
import { parsePostHtml } from "@exitpress/blog-naver/parsing/naver-blog/core/PostParser.js"
import { NaverBlog } from "@exitpress/blog-naver/parsing/naver-blog/NaverBlog.js"
import { naverFumadocsTemplates } from "@exitpress/blog-naver/profiles/NaverFumadocsTemplates.js"

import type { Blog, BlogPostContentCache } from "@exitpress/engine/blog/Blog.js"

const blogKey = "naver"

export const createNaverBlog = (): Blog => {
  const createFetcher = (sourceId: string, cache?: BlogPostContentCache) =>
    new NaverBlogFetcher({
      sourceId,
      ...(cache
        ? {
            cache: {
              getPostHtml: ({ sourceId, postId }) =>
                cache.getPostHtml?.({
                  blogKey,
                  sourceId,
                  postId,
                }) ?? null,
              setPostHtml: ({ sourceId, postId, html }) =>
                cache.setPostHtml?.({
                  blogKey,
                  sourceId,
                  postId,
                  html,
                }),
            },
          }
        : {}),
    })
  const createAssetFetcher = () => new NaverBlogFetcher({ sourceId: "" })

  return {
    key: blogKey,
    label: "Naver Blog",
    parseSource: (input) => {
      const sourceId = extractSourceId(input)

      return {
        blogKey,
        sourceId,
        displayName: sourceId,
        input,
      }
    },
    scan: async (source, options) => {
      const fetcher = createFetcher(source.sourceId, options?.cache)
      const scan = await fetcher.scanBlog({ includePosts: true })
      const posts =
        scan.posts ??
        (await fetcher.getAllPosts({
          expectedTotal: scan.totalPostCount,
        }))

      return {
        source,
        totalPostCount: scan.totalPostCount,
        categories: scan.categories.map((category) => ({
          id: category.id,
          name: category.name,
          parentId: category.parentId ?? undefined,
          postCount: category.postCount,
          path: category.path,
          depth: category.depth,
        })),
        posts: posts.map((post) => ({
          blogKey,
          sourceId: post.sourceId,
          postId: post.postId,
          title: post.title,
          sourceUrl: post.source,
          publishedAt: post.publishedAt,
          categoryId: post.categoryId,
          categoryName: post.categoryName,
          thumbnailUrl: post.thumbnailUrl ?? undefined,
        })),
      }
    },
    loadPostContent: async ({ source, post, cache }) => {
      const html = await createFetcher(source.sourceId, cache).fetchPostHtml(post.postId)

      return {
        kind: "html",
        html,
        sourceUrl: post.sourceUrl,
        tags: [],
      }
    },
    parseContent: ({ content, options }) => {
      if (content.kind !== "html") {
        throw new Error(`Unsupported Naver Blog content kind: ${content.kind}`)
      }

      return parsePostHtml({
        html: content.html,
        sourceUrl: content.sourceUrl,
        options,
      })
    },
    getBlockTemplateDefinitions: () => new NaverBlog().getBlockTemplateDefinitions(),
    getOutputBlockTemplates: (profile) => (profile === "fumadocs" ? naverFumadocsTemplates : {}),
    downloadBinary: (input) => createAssetFetcher().downloadBinary(input),
    fetchBinary: (input) => createAssetFetcher().fetchBinary(input),
    resolvePostLinkIdentity: (url) => {
      const identity = extractNaverBlogPostIdentity(url)

      if (!identity) {
        return undefined
      }

      return {
        blogKey,
        sourceId: identity.sourceId,
        postId: identity.postId,
      }
    },
  }
}
