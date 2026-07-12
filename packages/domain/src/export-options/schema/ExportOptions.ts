import type { ExportProfile } from "../../export-job/schema/ExportProfile.js"

export const allSlugStyles = ["kebab", "snake", "keep-title"] as const
// Title slug formatting style for generated paths.
export type SlugStyle = (typeof allSlugStyles)[number]

export const allSlugWhitespaces = ["dash", "underscore", "keep-space"] as const
// Whitespace replacement rule used while formatting slugs.
export type SlugWhitespace = (typeof allSlugWhitespaces)[number]

export const allFrontmatterFieldNames = [
  "title",
  "source",
  "blogKey",
  "sourceId",
  "postId",
  "publishedAt",
  "category",
  "categoryPath",
  "tags",
  "thumbnail",
  "exportedAt",
  "assetPaths",
] as const
// Frontmatter fields supported by the Markdown renderer.
export type FrontmatterFieldName = (typeof allFrontmatterFieldNames)[number]

export const allCategoryModes = ["selected-and-descendants", "exact-selected"] as const
// Category selection mode used when filtering scanned posts.
export type CategoryMode = (typeof allCategoryModes)[number]

export const allImageHandlingModes = ["download", "remote", "download-and-upload"] as const
// Asset strategy for body images and thumbnails.
export type ImageHandlingMode = (typeof allImageHandlingModes)[number]

export const allDownloadFailureModes = ["fail", "use-source", "omit"] as const
// Renderer fallback when an asset download fails.
export type DownloadFailureMode = (typeof allDownloadFailureModes)[number]

export const allStickerAssetModes = ["ignore", "download-original"] as const
// Sticker handling rule for blog sticker assets.
export type StickerAssetMode = (typeof allStickerAssetModes)[number]

export const allThumbnailSources = ["post-list-first", "first-body-image", "none"] as const
// Source used to choose a post thumbnail in frontmatter.
export type ThumbnailSource = (typeof allThumbnailSources)[number]

export const allSameBlogPostModes = ["keep-source", "custom-url", "relative-filepath"] as const
// Rewrite mode for links that point to another post in the same blog.
export type SameBlogPostMode = (typeof allSameBlogPostModes)[number]

// Display metadata for configurable frontmatter fields.
export type FrontmatterFieldMeta = {
  label: string
  description: string
  defaultAlias: string
}

// User-facing export configuration persisted by the local server.
export type ExportOptions = {
  scope: {
    categoryIds: number[]
    categoryMode: CategoryMode
    dateFrom: string | null
    dateTo: string | null
  }
  structure: {
    groupByCategory: boolean
    slugStyle: SlugStyle
    slugWhitespace: SlugWhitespace
    postFolderNameTemplate: string
  }
  frontmatter: {
    enabled: boolean
    fields: Record<FrontmatterFieldName, boolean>
    aliases: Record<FrontmatterFieldName, string>
  }
  blockOutputs: {
    templates: Partial<Record<ExportProfile, Partial<Record<string, string>>>>
  }
  assets: {
    imageHandlingMode: ImageHandlingMode
    compressionEnabled: boolean
    downloadFailureMode: DownloadFailureMode
    stickerAssetMode: StickerAssetMode
    downloadImages: boolean
    downloadThumbnails: boolean
    includeImageCaptions: boolean
    thumbnailSource: ThumbnailSource
  }
  links: {
    sameBlogPostMode: SameBlogPostMode
    sameBlogPostCustomUrlTemplate: string
  }
}

// Persisted export options may contain only the sections saved by the UI.
export type PartialExportOptions = {
  scope?: Partial<ExportOptions["scope"]>
  structure?: Partial<ExportOptions["structure"]>
  frontmatter?: {
    enabled?: boolean
    fields?: Partial<Record<FrontmatterFieldName, boolean>>
    aliases?: Partial<Record<FrontmatterFieldName, string>>
  }
  blockOutputs?: {
    templates?: Partial<Record<ExportProfile, Partial<Record<string, string>>>>
  }
  assets?: Partial<ExportOptions["assets"]>
  links?: Partial<ExportOptions["links"]>
}
