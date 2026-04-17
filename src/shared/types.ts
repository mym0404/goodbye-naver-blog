export type ExportProfile = "gfm"

export type EditorVersion = 2 | 3 | 4

export type CategorySelectionMode = "selected-and-descendants" | "exact-selected"

export type FolderStrategy = "category-path" | "flat"

export type SlugStyle = "kebab" | "keep-title"

export type FrontmatterFieldName =
  | "title"
  | "source"
  | "blogId"
  | "logNo"
  | "publishedAt"
  | "category"
  | "categoryPath"
  | "editorVersion"
  | "visibility"
  | "tags"
  | "thumbnail"
  | "video"
  | "warnings"
  | "exportedAt"
  | "assetPaths"

export type FrontmatterFieldMeta = {
  label: string
  description: string
  defaultAlias: string
}

export type MarkdownLinkStyle = "inlined" | "referenced"

export type FormulaInlineStyle = "wrapper"

export type FormulaBlockStyle = "wrapper" | "math-fence"

export type TableStyle = "gfm-or-html" | "html-only"

export type ImageStyle = "markdown-image" | "linked-image" | "source-only"

export type ImageGroupStyle = "split-images" | "html"

export type RawHtmlPolicy = "keep" | "omit"

export type DividerStyle = "dash" | "asterisk"

export type CodeFenceStyle = "backtick" | "tilde"

export type AssetPathMode = "relative" | "remote"

export type ThumbnailSource = "post-list-first" | "first-body-image" | "none"

export type ImageContentMode = "path" | "base64"

export type StickerAssetMode = "ignore" | "download-original"

export type OptionDescriptionMap = Record<string, string>

export type ExportOptions = {
  scope: {
    categoryIds: number[]
    categoryMode: CategorySelectionMode
    dateFrom: string | null
    dateTo: string | null
  }
  structure: {
    cleanOutputDir: boolean
    postDirectoryName: string
    assetDirectoryName: string
    folderStrategy: FolderStrategy
    includeDateInFilename: boolean
    includeLogNoInFilename: boolean
    slugStyle: SlugStyle
  }
  frontmatter: {
    enabled: boolean
    fields: Record<FrontmatterFieldName, boolean>
    aliases: Record<FrontmatterFieldName, string>
  }
  markdown: {
    linkStyle: MarkdownLinkStyle
    formulaInlineStyle: FormulaInlineStyle
    formulaInlineWrapperOpen: string
    formulaInlineWrapperClose: string
    formulaBlockStyle: FormulaBlockStyle
    formulaBlockWrapperOpen: string
    formulaBlockWrapperClose: string
    tableStyle: TableStyle
    imageStyle: ImageStyle
    imageGroupStyle: ImageGroupStyle
    rawHtmlPolicy: RawHtmlPolicy
    dividerStyle: DividerStyle
    codeFenceStyle: CodeFenceStyle
    headingLevelOffset: number
  }
  assets: {
    assetPathMode: AssetPathMode
    imageContentMode: ImageContentMode
    stickerAssetMode: StickerAssetMode
    downloadImages: boolean
    downloadThumbnails: boolean
    includeImageCaptions: boolean
    thumbnailSource: ThumbnailSource
  }
}

export type ExportRequest = {
  blogIdOrUrl: string
  outputDir: string
  profile: ExportProfile
  options: ExportOptions
}

export type JobStatus = "queued" | "running" | "completed" | "failed"

export type JobLog = {
  timestamp: string
  message: string
}

export type CategoryInfo = {
  id: number
  name: string
  parentId: number | null
  postCount: number
  isDivider: boolean
  isOpen: boolean
  path: string[]
  depth: number
}

export type PostSummary = {
  blogId: string
  logNo: string
  title: string
  publishedAt: string
  categoryId: number
  categoryName: string
  source: string
  editorVersion: EditorVersion | null
  thumbnailUrl: string | null
}

export type LinkCardData = {
  title: string
  description: string
  url: string
  imageUrl: string | null
}

export type VideoData = {
  title: string
  thumbnailUrl: string | null
  sourceUrl: string
  vid: string | null
  inkey: string | null
  width: number | null
  height: number | null
}

export type TableCell = {
  text: string
  html: string
  colspan: number
  rowspan: number
  isHeader: boolean
}

export type TableRow = TableCell[]

export type MediaKind = "image" | "sticker"

export type ImageData = {
  sourceUrl: string
  originalSourceUrl: string | null
  alt: string
  caption: string | null
  mediaKind: MediaKind
}

export type AstBlock =
  | { type: "paragraph"; text: string }
  | { type: "heading"; level: number; text: string }
  | { type: "quote"; text: string }
  | { type: "divider" }
  | { type: "code"; language: string | null; code: string }
  | { type: "formula"; formula: string; display: boolean }
  | { type: "image"; image: ImageData }
  | { type: "imageGroup"; images: ImageData[] }
  | { type: "video"; video: VideoData }
  | { type: "linkCard"; card: LinkCardData }
  | { type: "table"; rows: TableRow[]; html: string; complex: boolean }
  | { type: "rawHtml"; html: string; reason: string }

export type BlockType = AstBlock["type"]

export type ParserFallbackPolicy =
  | "structured"
  | "best-effort"
  | "markdown-paragraph"
  | "raw-html"
  | "skip"

export type ParserCapability = {
  blockType: BlockType
  supportedEditors: EditorVersion[]
  fallbackPolicy: ParserFallbackPolicy
  sampleIds: string[]
}

export type SampleCorpusEntry = {
  id: string
  blogId: string
  logNo: string
  editorVersion: EditorVersion
  expectedBlockTypes: BlockType[]
  description: string
  notes: string[]
}

export type ParsedPost = {
  editorVersion: EditorVersion
  tags: string[]
  blocks: AstBlock[]
  warnings: string[]
  videos: VideoData[]
}

export type AssetRecord = {
  kind: "image" | "thumbnail"
  sourceUrl: string
  reference: string
  relativePath: string | null
  storageMode: "relative" | "remote" | "base64"
}

export type PostManifestEntry = {
  logNo: string
  title: string
  source: string
  category: {
    id: number
    name: string
    path: string[]
  }
  editorVersion: EditorVersion | null
  status: "success" | "failed"
  outputPath: string | null
  assetPaths: string[]
  warnings: string[]
  warningCount: number
  error: string | null
}

export type ExportJobItem = {
  id: string
  logNo: string
  title: string
  source: string
  category: {
    id: number
    name: string
    path: string[]
  }
  status: "success" | "failed"
  outputPath: string | null
  assetPaths: string[]
  warnings: string[]
  warningCount: number
  error: string | null
  markdown: string | null
  updatedAt: string
}

export type ExportManifest = {
  blogId: string
  profile: ExportProfile
  options: ExportOptions
  selectedCategoryIds: number[]
  startedAt: string
  finishedAt: string | null
  totalPosts: number
  successCount: number
  failureCount: number
  warningCount: number
  categories: CategoryInfo[]
  posts: PostManifestEntry[]
}

export type ScanResult = {
  blogId: string
  totalPostCount: number
  categories: CategoryInfo[]
  posts?: PostSummary[]
}

export type ExportJobState = {
  id: string
  request: ExportRequest
  status: JobStatus
  logs: JobLog[]
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  progress: {
    total: number
    completed: number
    failed: number
    warnings: number
  }
  items: ExportJobItem[]
  manifest: ExportManifest | null
  error: string | null
}
