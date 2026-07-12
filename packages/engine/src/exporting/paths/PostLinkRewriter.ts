import {
  applyPostTemplate as applySameBlogPostCustomUrlTemplate,
  buildPostTemplateValues as buildSameBlogPostTemplateValues,
} from "@exitpress/domain/export-paths/PostPathTemplate.js"

import type { CategoryInfo, PostSummary } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"

import type { OutputAdapter } from "../profiles/OutputAdapter.js"

import { relativePathFrom } from "../../infra/node/FilePaths.js"

import { buildMarkdownFilePath, getCategoryForPost } from "./ExportPaths.js"

type PostLinkTarget = {
  markdownFilePath: string
  templateValues: ReturnType<typeof buildSameBlogPostTemplateValues>
}

type SameBlogPostIdentity = {
  blogKey: string
  sourceId: string
  postId: string
}

const getPostLinkTargetKey = ({
  blogKey,
  sourceId,
  postId,
}: {
  blogKey: string
  sourceId: string
  postId: string
}) => `${blogKey}:${sourceId}:${postId}`

export const buildPostLinkTargets = ({
  outputDir,
  posts,
  categories,
  options,
  adapter,
}: {
  outputDir: string
  posts: PostSummary[]
  categories: CategoryInfo[]
  options: Pick<ExportOptions, "structure">
  adapter?: Pick<OutputAdapter, "contentRootSegments" | "documentFileName" | "formatPathSegment">
}) => {
  const categoryMap = new Map(categories.map((category) => [category.id, category]))

  return new Map(
    posts.map((post) => {
      const category = getCategoryForPost({
        categories: categoryMap,
        categoryId: post.categoryId,
        categoryName: post.categoryName,
      })

      return [
        getPostLinkTargetKey({
          blogKey: post.blogKey,
          sourceId: post.sourceId,
          postId: post.postId,
        }),
        {
          markdownFilePath: buildMarkdownFilePath({
            outputDir,
            post,
            category,
            options,
            adapter,
          }),
          templateValues: buildSameBlogPostTemplateValues({
            post: {
              sourceId: post.sourceId,
              blogKey: post.blogKey,
              postId: post.postId,
              title: post.title,
              publishedAt: post.publishedAt,
              categoryName: category.name,
            },
            options,
          }),
        } satisfies PostLinkTarget,
      ] as const
    }),
  )
}

export const createPostLinkResolver = ({
  sourceId,
  blogKey,
  markdownFilePath,
  options,
  targets,
  resolveIdentity,
}: {
  sourceId: string
  blogKey: string
  markdownFilePath: string
  options: Pick<ExportOptions, "links">
  targets: Map<string, PostLinkTarget>
  resolveIdentity: (url: string) => SameBlogPostIdentity | null | undefined
}) => {
  if (options.links.sameBlogPostMode === "keep-source") {
    return (url: string) => url
  }

  return (url: string) => {
    const identity = resolveIdentity(url)

    if (!identity || identity.blogKey !== blogKey || identity.sourceId !== sourceId) {
      return url
    }

    const target = targets.get(
      getPostLinkTargetKey({
        blogKey: identity.blogKey,
        sourceId: identity.sourceId,
        postId: identity.postId,
      }),
    )

    if (!target) {
      return url
    }

    if (options.links.sameBlogPostMode === "relative-filepath") {
      return relativePathFrom({
        from: markdownFilePath,
        to: target.markdownFilePath,
      })
    }

    const template = options.links.sameBlogPostCustomUrlTemplate.trim()

    if (!template) {
      return url
    }

    return applySameBlogPostCustomUrlTemplate({
      template,
      values: target.templateValues,
    })
  }
}
