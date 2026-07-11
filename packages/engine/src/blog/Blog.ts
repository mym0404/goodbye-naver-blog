import type {
  BlogContentDocument,
  BlogPostIdentity,
  BlogPostRef,
  BlogScanResult,
  BlogSource,
} from "@exitpress/domain/blog/schema/Blog.js"
import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ParsedBlock, ParsedPost } from "@exitpress/domain/parser/schema/ParsedPost.js"
import type { ParserBlockOptions } from "@exitpress/domain/parser/schema/ParserBlockOptions.js"
import type { BlockTemplateDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

export type BlogFetcher = {
  scan: (
    source: BlogSource,
    options?: { cache?: BlogPostContentCache; signal?: AbortSignal },
  ) => Promise<BlogScanResult>
  loadPostContent: (input: {
    source: BlogSource
    post: BlogPostRef
    cache?: BlogPostContentCache
    signal?: AbortSignal
  }) => Promise<BlogContentDocument>
  downloadBinary?: (input: { sourceUrl: string; destinationPath: string }) => Promise<void>
  fetchBinary?: (input: { sourceUrl: string }) => Promise<{
    bytes: Buffer
    contentType: string | null
  }>
}

export type BlogPostContentCache = {
  getPostHtml?: (input: {
    blogKey: string
    sourceId: string
    postId: string
  }) => string | null | Promise<string | null>
  setPostHtml?: (input: {
    blogKey: string
    sourceId: string
    postId: string
    html: string
  }) => void | Promise<void>
}

export type BlogContentParser = {
  parseContent: (input: {
    source: BlogSource
    post: BlogPostRef
    content: BlogContentDocument
    options: Pick<ExportOptions, "blockOutputs" | "assets"> & {
      resolveLinkUrl?: (url: string) => string
    }
  }) => ParsedPost
}

export type BlogEditor = {
  type: string
  label: string
  canParse: (input: BlogContentDocument) => boolean
  parse: (input: {
    content: BlogContentDocument
    options: ParserBlockOptions
    resolveLinkUrl?: (url: string) => string
  }) => ParsedPost
  getBlockTemplateDefinitions: () => BlockTemplateDefinition[]
}

export type BlockParser = {
  id: string
  label: string
  parse: (input: { content: BlogContentDocument; options: ParserBlockOptions }) => ParsedBlock[]
}

export type Blog = BlogFetcher &
  BlogContentParser & {
    key: string
    label: string
    parseSource: (input: string) => BlogSource
    getBlockTemplateDefinitions: () => BlockTemplateDefinition[]
    resolvePostLinkIdentity?: (url: string) => BlogPostIdentity | undefined
  }
