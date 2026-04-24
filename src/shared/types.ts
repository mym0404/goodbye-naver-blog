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

export type BlockOutputParamValue = string | number | boolean

export type ParagraphBlockOutputSelection = {
  variant: "markdown-paragraph"
  params?: Record<string, BlockOutputParamValue>
}

export type HeadingBlockOutputSelection = {
  variant: "markdown-heading"
  params?: {
    levelOffset?: number
  } & Record<string, BlockOutputParamValue>
}

export type QuoteBlockOutputSelection = {
  variant: "blockquote"
  params?: Record<string, BlockOutputParamValue>
}

export type DividerBlockOutputSelection =
  | {
      variant: "dash-rule"
      params?: Record<string, BlockOutputParamValue>
    }
  | {
      variant: "asterisk-rule"
      params?: Record<string, BlockOutputParamValue>
    }

export type CodeBlockOutputSelection =
  | {
      variant: "backtick-fence"
      params?: Record<string, BlockOutputParamValue>
    }
  | {
      variant: "tilde-fence"
      params?: Record<string, BlockOutputParamValue>
    }

export type FormulaBlockOutputSelection =
  | {
      variant: "wrapper"
      params?: {
        inlineWrapper?: string
        blockWrapper?: string
        inlineOpen?: string
        inlineClose?: string
        blockOpen?: string
        blockClose?: string
      } & Record<string, BlockOutputParamValue>
    }
  | {
      variant: "math-fence"
      params?: {
        inlineWrapper?: string
        inlineOpen?: string
        inlineClose?: string
      } & Record<string, BlockOutputParamValue>
    }

export type ImageBlockOutputSelection =
  | {
      variant: "markdown-image"
      params?: Record<string, BlockOutputParamValue>
    }
  | {
      variant: "linked-image"
      params?: Record<string, BlockOutputParamValue>
    }
  | {
      variant: "source-only"
      params?: Record<string, BlockOutputParamValue>
    }

export type ImageGroupBlockOutputSelection = {
  variant: "split-images"
  params?: Record<string, BlockOutputParamValue>
}

export type VideoBlockOutputSelection = {
  variant: "source-link"
  params?: Record<string, BlockOutputParamValue>
}

export type LinkCardBlockOutputSelection = {
  variant: "title-link"
  params?: Record<string, BlockOutputParamValue>
}

export type TableBlockOutputSelection =
  | {
      variant: "gfm-or-html"
      params?: Record<string, BlockOutputParamValue>
    }
  | {
      variant: "html-only"
      params?: Record<string, BlockOutputParamValue>
    }

export type BlockOutputSelectionByType = {
  paragraph: ParagraphBlockOutputSelection
  heading: HeadingBlockOutputSelection
  quote: QuoteBlockOutputSelection
  divider: DividerBlockOutputSelection
  code: CodeBlockOutputSelection
  formula: FormulaBlockOutputSelection
  image: ImageBlockOutputSelection
  imageGroup: ImageGroupBlockOutputSelection
  video: VideoBlockOutputSelection
  linkCard: LinkCardBlockOutputSelection
  table: TableBlockOutputSelection
}

export type BlockOutputSelection<
  Block extends keyof BlockOutputSelectionByType = keyof BlockOutputSelectionByType,
> = BlockOutputSelectionByType[Block]

export type ImageHandlingMode = "download" | "remote" | "download-and-upload"

export type AssetDownloadFailureMode =
  | "warn-and-use-source"
  | "use-source"
  | "omit"
  | "warn-and-omit"

export type ThumbnailSource = "post-list-first" | "first-body-image" | "none"

export type StickerAssetMode = "ignore" | "download-original"

export type SameBlogPostLinkMode = "keep-source" | "custom-url" | "relative-filepath"

export type OptionDescriptionMap = Record<string, string>
export type UnknownRecord = Record<string, unknown>

export type UploadProviderValue = string | number | boolean
export type UploadProviderFields = Record<string, UploadProviderValue>
export type UploadRuntimeConfig = UnknownRecord

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

export type UploadStatus =
  | "not-requested"
  | "upload-ready"
  | "uploading"
  | "upload-completed"
  | "upload-failed"
  | "skipped"

export type UploadSummary = {
  status: UploadStatus
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
  }
  blockOutputs: {
    defaults: Partial<{ [Key in BlockType]: BlockOutputSelection<Key> }>
    overrides: Partial<{ [Key in ParserCapabilityId]: BlockOutputSelectionByType[Key extends `se${EditorVersion}-${infer Block}` ? Extract<Block, keyof BlockOutputSelectionByType> : never] }>
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
  | { type: "divider"; outputSelection?: DividerBlockOutputSelection }
  | { type: "code"; language: string | null; code: string }
  | { type: "formula"; formula: string; display: boolean }
  | { type: "image"; image: ImageData; outputSelection?: ImageBlockOutputSelection }
  | { type: "imageGroup"; images: ImageData[] }
  | { type: "video"; video: VideoData; outputSelection?: VideoBlockOutputSelection }
  | { type: "linkCard"; card: LinkCardData; outputSelection?: LinkCardBlockOutputSelection }
  | { type: "table"; rows: TableRow[]; html: string; complex: boolean }

export type StructuredAstBlock = AstBlock

export type ParsedPostStructuredBodyNode = {
  kind: "block"
  block: StructuredAstBlock
}

export type ParsedPostFallbackHtmlBodyNode = {
  kind: "fallbackHtml"
  html: string
  reason: string
  warnings: string[]
}

export type ParsedPostBodyNode = ParsedPostStructuredBodyNode | ParsedPostFallbackHtmlBodyNode

export type BlockType = AstBlock["type"]

export type ParserFallbackPolicy =
  | "structured"
  | "best-effort"
  | "markdown-paragraph"
  | "raw-html"
  | "skip"

export type ParserCapabilityId = `se${EditorVersion}-${BlockType}`
export type ParserCapabilityLookupId = ParserCapabilityId

export type ParserCapabilityVerificationMode = "sample-fixture" | "parser-fixture"

export type ParserCapability = {
  id: ParserCapabilityId
  editorVersion: EditorVersion
  blockType: BlockType
  fallbackPolicy: ParserFallbackPolicy
  verificationMode: ParserCapabilityVerificationMode
  sampleIds: string[]
  testFilePaths: string[]
}

export type SampleCorpusEntry = {
  id: string
  blogId: string
  logNo: string
  editorVersion: EditorVersion
  expectedCapabilityLookupIds: ParserCapabilityLookupId[]
  expectedWarnings?: {
    parser?: string[]
    reviewer?: string[]
    render?: string[]
  }
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
  body?: ParsedPostBodyNode[]
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
  updatedAt: string
}

export type ScanResult = {
  blogId: string
  totalPostCount: number
  categories: CategoryInfo[]
  posts?: PostSummary[]
}

export type ScanCacheMap = Record<string, ScanResult>

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

export type ExportManifestScanResult = Pick<ScanResult, "blogId" | "totalPostCount">

export type ExportManifestJobState = {
  id: string
  phase: ExportResumePhase
  request: ExportRequest
  status: JobStatus
  createdAt: string
  startedAt: string | null
  finishedAt: string | null
  updatedAt: string
  progress: ExportJobState["progress"]
  upload: UploadSummary
  error: string | null
  scanResult: ExportManifestScanResult | null
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
