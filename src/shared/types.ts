export type ExportProfile = "gfm"

export type EditorVersion = 2 | 3 | 4

export type ThemePreference = "dark" | "light"

export type CategorySelectionMode = "selected-and-descendants" | "exact-selected"

export type SlugStyle = "kebab" | "snake" | "keep-title"

export type SlugWhitespace = "dash" | "underscore" | "keep-space"

export type PostFolderNameMode = "preset" | "custom-template"

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

export type ImageHandlingMode = "download" | "remote" | "download-and-upload"

export type AssetDownloadFailureMode = "warn-and-use-source" | "warn-and-omit"

export type ThumbnailSource = "post-list-first" | "first-body-image" | "none"

export type StickerAssetMode = "ignore" | "download-original"

export type SameBlogPostLinkMode = "keep-source" | "custom-url" | "relative-filepath"

export type OptionDescriptionMap = Record<string, string>

export type UploadProviderValue = string | number | boolean

export type UploadProviderInputType = "text" | "password" | "number" | "select" | "checkbox"

export type UploadProviderOptionValue = string | number

export type UploadProviderFieldOption = {
  label: string
  value: UploadProviderOptionValue
}

export type UploadProviderFieldDefinition = {
  key: string
  label: string
  description: string
  inputType: UploadProviderInputType
  required: boolean
  defaultValue: UploadProviderValue | null
  placeholder: string
  options?: UploadProviderFieldOption[]
}

export type UploadProviderDefinition = {
  key: string
  label: string
  description: string
  fields: UploadProviderFieldDefinition[]
}

export type UploadProviderCatalogResponse = {
  defaultProviderKey: string | null
  providers: UploadProviderDefinition[]
}

export type ExportJobPollingConfig = {
  defaultPollMs: number
  fastPollMs: number
  uploadBurstPollMs: number
  uploadBurstAttempts: number
}

export type UploadTerminalReason = "skipped-no-candidates"

export type UploadRewriteStatus = "pending" | "completed" | "failed"

export type UploadSummary = {
  status:
    | "not-requested"
    | "upload-ready"
    | "uploading"
    | "upload-completed"
    | "upload-failed"
    | "skipped"
  eligiblePostCount: number
  candidateCount: number
  uploadedCount: number
  failedCount: number
  terminalReason: UploadTerminalReason | null
}

export type UploadCandidate = {
  kind: "image" | "thumbnail"
  sourceUrl: string
  localPath: string
  markdownReference: string
}

export type PostUploadSummary = {
  eligible: boolean
  candidateCount: number
  uploadedCount: number
  failedCount: number
  candidates: UploadCandidate[]
  uploadedUrls: string[]
  rewriteStatus: UploadRewriteStatus
  rewrittenAt: string | null
}

export type ExportOptions = {
  scope: {
    categoryIds: number[]
    categoryMode: CategorySelectionMode
    dateFrom: string | null
    dateTo: string | null
  }
  structure: {
    groupByCategory: boolean
    includeDateInPostFolderName: boolean
    includeLogNoInPostFolderName: boolean
    slugStyle: SlugStyle
    slugWhitespace: SlugWhitespace
    postFolderNameMode: PostFolderNameMode
    postFolderNameCustomTemplate: string
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
    imageHandlingMode: ImageHandlingMode
    compressionEnabled: boolean
    downloadFailureMode: AssetDownloadFailureMode
    stickerAssetMode: StickerAssetMode
    downloadImages: boolean
    downloadThumbnails: boolean
    includeImageCaptions: boolean
    thumbnailSource: ThumbnailSource
  }
  links: {
    sameBlogPostMode: SameBlogPostLinkMode
    sameBlogPostCustomUrlTemplate: string
  }
}

export type ExportRequest = {
  blogIdOrUrl: string
  outputDir: string
  profile: ExportProfile
  options: ExportOptions
}

export type JobStatus =
  | "queued"
  | "running"
  | "upload-ready"
  | "uploading"
  | "upload-completed"
  | "upload-failed"
  | "completed"
  | "failed"

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

export type ParserCapabilityId = `se${EditorVersion}-${BlockType}`

export type ParserCapabilityVerificationMode = "sample-fixture" | "parser-fixture"

export type ParserCapability = {
  id: ParserCapabilityId
  editorVersion: EditorVersion
  blockType: BlockType
  fallbackPolicy: ParserFallbackPolicy
  verificationMode: ParserCapabilityVerificationMode
  sampleIds: string[]
}

export type SampleCorpusEntry = {
  id: string
  blogId: string
  logNo: string
  editorVersion: EditorVersion
  expectedCapabilityIds: ParserCapabilityId[]
  post: {
    title: string
    publishedAt: string
    categoryId: number
    categoryName: string
    categoryPath: string[]
    thumbnailUrl: string | null
    source: string
  }
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
  storageMode: "relative" | "remote"
  uploadCandidate: UploadCandidate | null
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
  upload: PostUploadSummary
  warnings: string[]
  warningCount: number
  error: string | null
  externalPreviewUrl?: string | null
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
  editorVersion?: EditorVersion | null
  status: "success" | "failed"
  outputPath: string | null
  assetPaths: string[]
  upload: PostUploadSummary
  warnings: string[]
  warningCount: number
  error: string | null
  externalPreviewUrl?: string | null
  updatedAt: string
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
  resumeAvailable?: boolean
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
  upload: UploadSummary
  items: ExportJobItem[]
  manifest: ExportManifest | null
  error: string | null
}

export type ExportResumePhase = "export" | "upload-ready" | "uploading" | "result"

export type ExportResumeSummary = {
  status: JobStatus
  outputDir: string
  totalPosts: number
  completedCount: number
  failedCount: number
  uploadCandidateCount: number
  uploadedCount: number
}

export type ExportManifestJobState = {
  id: string
  phase: ExportResumePhase
  request: ExportRequest
  status: JobStatus
  logs: JobLog[]
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  updatedAt: string
  progress: ExportJobState["progress"]
  upload: UploadSummary
  items: ExportJobItem[]
  error: string | null
  scanResult: ScanResult | null
  summary: ExportResumeSummary
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
  upload: UploadSummary
  categories: CategoryInfo[]
  posts: PostManifestEntry[]
  job?: ExportManifestJobState
}
