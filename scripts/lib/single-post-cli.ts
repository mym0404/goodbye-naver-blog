import { defaultExportOptions } from "../../src/shared/export-options.js"
import type { ExportOptions } from "../../src/shared/types.js"

const entrypoint = "pnpm exec tsx scripts/export-single-post.ts"

const allowedTopLevelOptionKeys = ["scope", "structure", "frontmatter", "markdown", "assets"] as const
const allowedScopeKeys = ["categoryIds", "categoryMode", "dateFrom", "dateTo"] as const
const allowedStructureKeys = [
  "cleanOutputDir",
  "postDirectoryName",
  "assetDirectoryName",
  "folderStrategy",
  "includeDateInFilename",
  "includeLogNoInFilename",
  "slugStyle",
] as const
const allowedFrontmatterKeys = ["enabled", "fields", "aliases"] as const
const allowedFrontmatterFieldKeys = [
  "title",
  "source",
  "blogId",
  "logNo",
  "publishedAt",
  "category",
  "categoryPath",
  "editorVersion",
  "visibility",
  "tags",
  "thumbnail",
  "video",
  "warnings",
  "exportedAt",
  "assetPaths",
] as const
const allowedMarkdownKeys = [
  "linkStyle",
  "linkCardStyle",
  "formulaStyle",
  "formulaInlineWrapperOpen",
  "formulaInlineWrapperClose",
  "formulaBlockStyle",
  "formulaBlockWrapperOpen",
  "formulaBlockWrapperClose",
  "tableStyle",
  "videoStyle",
  "imageStyle",
  "imageGroupStyle",
  "rawHtmlPolicy",
  "dividerStyle",
  "codeFenceStyle",
  "headingLevelOffset",
] as const
const allowedAssetsKeys = [
  "assetPathMode",
  "imageContentMode",
  "stickerAssetMode",
  "downloadImages",
  "downloadThumbnails",
  "includeImageCaptions",
  "thumbnailSource",
] as const

const categoryModes = ["selected-and-descendants", "exact-selected"] as const
const folderStrategies = ["category-path", "flat"] as const
const slugStyles = ["kebab", "keep-title"] as const
const linkStyles = ["inlined", "referenced"] as const
const linkCardStyles = ["inline", "quote", "html"] as const
const formulaStyles = ["double-dollar", "math-fence"] as const
const formulaBlockStyles = ["wrapper", "math-fence"] as const
const tableStyles = ["gfm-or-html", "html-only"] as const
const videoStyles = ["thumbnail-link", "link-only", "html"] as const
const imageStyles = ["markdown-image", "linked-image", "source-only"] as const
const imageGroupStyles = ["split-images", "html"] as const
const rawHtmlPolicies = ["keep", "omit"] as const
const dividerStyles = ["dash", "asterisk"] as const
const codeFenceStyles = ["backtick", "tilde"] as const
const assetPathModes = ["relative", "remote"] as const
const imageContentModes = ["path", "base64"] as const
const stickerAssetModes = ["ignore", "download-original"] as const
const thumbnailSources = ["post-list-first", "first-body-image", "none"] as const

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const formatContext = (context: string, key: string) => `${context}.${key}`

const usageError = () => new Error(singlePostCliUsage())

const failOptions = (optionsPath: string, message: string): never => {
  throw new Error(`Invalid --options JSON in ${optionsPath}: ${message}`)
}

function assertPlainObject(
  value: unknown,
  context: string,
  optionsPath: string,
): asserts value is Record<string, unknown> {
  if (!isPlainObject(value)) {
    failOptions(optionsPath, `${context} must be an object`)
  }
}

const assertAllowedKeys = (
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
  context: string,
  optionsPath: string,
) => {
  const unexpectedKeys = Object.keys(value).filter((key) => !allowedKeys.includes(key))

  if (unexpectedKeys.length > 0) {
    failOptions(optionsPath, `${context} contains unsupported keys: ${unexpectedKeys.join(", ")}`)
  }
}

function assertBoolean(value: unknown, context: string, optionsPath: string): asserts value is boolean {
  if (typeof value !== "boolean") {
    failOptions(optionsPath, `${context} must be a boolean`)
  }
}

function assertString(value: unknown, context: string, optionsPath: string): asserts value is string {
  if (typeof value !== "string") {
    failOptions(optionsPath, `${context} must be a string`)
  }
}

function assertFiniteNumber(
  value: unknown,
  context: string,
  optionsPath: string,
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    failOptions(optionsPath, `${context} must be a finite number`)
  }
}

function assertNullableString(
  value: unknown,
  context: string,
  optionsPath: string,
): asserts value is string | null {
  if (value !== null && typeof value !== "string") {
    failOptions(optionsPath, `${context} must be a string or null`)
  }
}

function assertNumberArray(
  value: unknown,
  context: string,
  optionsPath: string,
): asserts value is number[] {
  const items: unknown[] | null = Array.isArray(value) ? value : null

  if (items === null) {
    failOptions(optionsPath, `${context} must be an array of numbers`)
  } else {
    items.forEach((item, index) => {
      if (typeof item !== "number" || !Number.isFinite(item)) {
        failOptions(optionsPath, `${formatContext(context, String(index))} must be a finite number`)
      }
    })
  }
}

function assertEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[],
  context: string,
  optionsPath: string,
): asserts value is T {
  if (typeof value !== "string" || !allowedValues.some((allowedValue) => allowedValue === value)) {
    failOptions(optionsPath, `${context} must be one of: ${allowedValues.join(", ")}`)
  }
}

const validateScopeOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "scope", optionsPath)
  assertAllowedKeys(value, allowedScopeKeys, "scope", optionsPath)

  const scope = defaultExportOptions().scope

  if ("categoryIds" in value) {
    const categoryIds = value.categoryIds
    assertNumberArray(categoryIds, "scope.categoryIds", optionsPath)
    scope.categoryIds = categoryIds
  }

  if ("categoryMode" in value) {
    const categoryMode = value.categoryMode
    assertEnum(categoryMode, categoryModes, "scope.categoryMode", optionsPath)
    scope.categoryMode = categoryMode
  }

  if ("dateFrom" in value) {
    const dateFrom = value.dateFrom
    assertNullableString(dateFrom, "scope.dateFrom", optionsPath)
    scope.dateFrom = dateFrom
  }

  if ("dateTo" in value) {
    const dateTo = value.dateTo
    assertNullableString(dateTo, "scope.dateTo", optionsPath)
    scope.dateTo = dateTo
  }

  return scope
}

const validateStructureOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "structure", optionsPath)
  assertAllowedKeys(value, allowedStructureKeys, "structure", optionsPath)

  const structure = defaultExportOptions().structure

  if ("cleanOutputDir" in value) {
    const cleanOutputDir = value.cleanOutputDir
    assertBoolean(cleanOutputDir, "structure.cleanOutputDir", optionsPath)
    structure.cleanOutputDir = cleanOutputDir
  }

  if ("postDirectoryName" in value) {
    const postDirectoryName = value.postDirectoryName
    assertString(postDirectoryName, "structure.postDirectoryName", optionsPath)
    structure.postDirectoryName = postDirectoryName
  }

  if ("assetDirectoryName" in value) {
    const assetDirectoryName = value.assetDirectoryName
    assertString(assetDirectoryName, "structure.assetDirectoryName", optionsPath)
    structure.assetDirectoryName = assetDirectoryName
  }

  if ("folderStrategy" in value) {
    const folderStrategy = value.folderStrategy
    assertEnum(folderStrategy, folderStrategies, "structure.folderStrategy", optionsPath)
    structure.folderStrategy = folderStrategy
  }

  if ("includeDateInFilename" in value) {
    const includeDateInFilename = value.includeDateInFilename
    assertBoolean(includeDateInFilename, "structure.includeDateInFilename", optionsPath)
    structure.includeDateInFilename = includeDateInFilename
  }

  if ("includeLogNoInFilename" in value) {
    const includeLogNoInFilename = value.includeLogNoInFilename
    assertBoolean(includeLogNoInFilename, "structure.includeLogNoInFilename", optionsPath)
    structure.includeLogNoInFilename = includeLogNoInFilename
  }

  if ("slugStyle" in value) {
    const slugStyle = value.slugStyle
    assertEnum(slugStyle, slugStyles, "structure.slugStyle", optionsPath)
    structure.slugStyle = slugStyle
  }

  return structure
}

const validateFrontmatterOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "frontmatter", optionsPath)
  assertAllowedKeys(value, allowedFrontmatterKeys, "frontmatter", optionsPath)

  const frontmatter = defaultExportOptions().frontmatter

  if ("enabled" in value) {
    const enabled = value.enabled
    assertBoolean(enabled, "frontmatter.enabled", optionsPath)
    frontmatter.enabled = enabled
  }

  if ("fields" in value) {
    const fieldsValue = value.fields
    assertPlainObject(fieldsValue, "frontmatter.fields", optionsPath)
    assertAllowedKeys(fieldsValue, allowedFrontmatterFieldKeys, "frontmatter.fields", optionsPath)

    const fields = { ...frontmatter.fields }

    for (const key of allowedFrontmatterFieldKeys) {
      if (key in fieldsValue) {
        const fieldValue = fieldsValue[key]
        assertBoolean(fieldValue, `frontmatter.fields.${key}`, optionsPath)
        fields[key] = fieldValue
      }
    }

    frontmatter.fields = fields
  }

  if ("aliases" in value) {
    const aliasesValue = value.aliases
    assertPlainObject(aliasesValue, "frontmatter.aliases", optionsPath)
    assertAllowedKeys(aliasesValue, allowedFrontmatterFieldKeys, "frontmatter.aliases", optionsPath)

    const aliases = { ...frontmatter.aliases }

    for (const key of allowedFrontmatterFieldKeys) {
      if (key in aliasesValue) {
        const aliasValue = aliasesValue[key]
        assertString(aliasValue, `frontmatter.aliases.${key}`, optionsPath)
        aliases[key] = aliasValue
      }
    }

    frontmatter.aliases = aliases
  }

  return frontmatter
}

const validateMarkdownOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "markdown", optionsPath)
  assertAllowedKeys(value, allowedMarkdownKeys, "markdown", optionsPath)

  const markdown = defaultExportOptions().markdown

  if ("linkStyle" in value) {
    const linkStyle = value.linkStyle
    assertEnum(linkStyle, linkStyles, "markdown.linkStyle", optionsPath)
    markdown.linkStyle = linkStyle
  }

  if ("linkCardStyle" in value) {
    const linkCardStyle = value.linkCardStyle
    assertEnum(linkCardStyle, linkCardStyles, "markdown.linkCardStyle", optionsPath)
    markdown.linkCardStyle = linkCardStyle
  }

  if ("formulaStyle" in value) {
    const formulaStyle = value.formulaStyle
    assertEnum(formulaStyle, formulaStyles, "markdown.formulaStyle", optionsPath)
    markdown.formulaBlockStyle = formulaStyle === "math-fence" ? "math-fence" : "wrapper"
    markdown.formulaBlockWrapperOpen = "$$"
    markdown.formulaBlockWrapperClose = "$$"
  }

  if ("formulaInlineWrapperOpen" in value) {
    assertString(value.formulaInlineWrapperOpen, "markdown.formulaInlineWrapperOpen", optionsPath)
    markdown.formulaInlineWrapperOpen = value.formulaInlineWrapperOpen
  }

  if ("formulaInlineWrapperClose" in value) {
    assertString(value.formulaInlineWrapperClose, "markdown.formulaInlineWrapperClose", optionsPath)
    markdown.formulaInlineWrapperClose = value.formulaInlineWrapperClose
  }

  if ("formulaBlockStyle" in value) {
    const formulaBlockStyle = value.formulaBlockStyle
    assertEnum(formulaBlockStyle, formulaBlockStyles, "markdown.formulaBlockStyle", optionsPath)
    markdown.formulaBlockStyle = formulaBlockStyle
  }

  if ("formulaBlockWrapperOpen" in value) {
    assertString(value.formulaBlockWrapperOpen, "markdown.formulaBlockWrapperOpen", optionsPath)
    markdown.formulaBlockWrapperOpen = value.formulaBlockWrapperOpen
  }

  if ("formulaBlockWrapperClose" in value) {
    assertString(value.formulaBlockWrapperClose, "markdown.formulaBlockWrapperClose", optionsPath)
    markdown.formulaBlockWrapperClose = value.formulaBlockWrapperClose
  }

  if ("tableStyle" in value) {
    const tableStyle = value.tableStyle
    assertEnum(tableStyle, tableStyles, "markdown.tableStyle", optionsPath)
    markdown.tableStyle = tableStyle
  }

  if ("videoStyle" in value) {
    const videoStyle = value.videoStyle
    assertEnum(videoStyle, videoStyles, "markdown.videoStyle", optionsPath)
    markdown.videoStyle = videoStyle
  }

  if ("imageStyle" in value) {
    const imageStyle = value.imageStyle
    assertEnum(imageStyle, imageStyles, "markdown.imageStyle", optionsPath)
    markdown.imageStyle = imageStyle
  }

  if ("imageGroupStyle" in value) {
    const imageGroupStyle = value.imageGroupStyle
    assertEnum(imageGroupStyle, imageGroupStyles, "markdown.imageGroupStyle", optionsPath)
    markdown.imageGroupStyle = imageGroupStyle
  }

  if ("rawHtmlPolicy" in value) {
    const rawHtmlPolicy = value.rawHtmlPolicy
    assertEnum(rawHtmlPolicy, rawHtmlPolicies, "markdown.rawHtmlPolicy", optionsPath)
    markdown.rawHtmlPolicy = rawHtmlPolicy
  }

  if ("dividerStyle" in value) {
    const dividerStyle = value.dividerStyle
    assertEnum(dividerStyle, dividerStyles, "markdown.dividerStyle", optionsPath)
    markdown.dividerStyle = dividerStyle
  }

  if ("codeFenceStyle" in value) {
    const codeFenceStyle = value.codeFenceStyle
    assertEnum(codeFenceStyle, codeFenceStyles, "markdown.codeFenceStyle", optionsPath)
    markdown.codeFenceStyle = codeFenceStyle
  }

  if ("headingLevelOffset" in value) {
    const headingLevelOffset = value.headingLevelOffset
    assertFiniteNumber(headingLevelOffset, "markdown.headingLevelOffset", optionsPath)
    markdown.headingLevelOffset = headingLevelOffset
  }

  return markdown
}

const validateAssetsOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "assets", optionsPath)
  assertAllowedKeys(value, allowedAssetsKeys, "assets", optionsPath)

  const assets = defaultExportOptions().assets

  if ("assetPathMode" in value) {
    const assetPathMode = value.assetPathMode
    assertEnum(assetPathMode, assetPathModes, "assets.assetPathMode", optionsPath)
    assets.assetPathMode = assetPathMode
  }

  if ("imageContentMode" in value) {
    const imageContentMode = value.imageContentMode
    assertEnum(imageContentMode, imageContentModes, "assets.imageContentMode", optionsPath)
    assets.imageContentMode = imageContentMode
  }

  if ("stickerAssetMode" in value) {
    const stickerAssetMode = value.stickerAssetMode
    assertEnum(stickerAssetMode, stickerAssetModes, "assets.stickerAssetMode", optionsPath)
    assets.stickerAssetMode = stickerAssetMode
  }

  if ("downloadImages" in value) {
    const downloadImages = value.downloadImages
    assertBoolean(downloadImages, "assets.downloadImages", optionsPath)
    assets.downloadImages = downloadImages
  }

  if ("downloadThumbnails" in value) {
    const downloadThumbnails = value.downloadThumbnails
    assertBoolean(downloadThumbnails, "assets.downloadThumbnails", optionsPath)
    assets.downloadThumbnails = downloadThumbnails
  }

  if ("includeImageCaptions" in value) {
    const includeImageCaptions = value.includeImageCaptions
    assertBoolean(includeImageCaptions, "assets.includeImageCaptions", optionsPath)
    assets.includeImageCaptions = includeImageCaptions
  }

  if ("thumbnailSource" in value) {
    const thumbnailSource = value.thumbnailSource
    assertEnum(thumbnailSource, thumbnailSources, "assets.thumbnailSource", optionsPath)
    assets.thumbnailSource = thumbnailSource
  }

  return assets
}

const validateSinglePostOptionsJson = (value: unknown, optionsPath: string): ExportOptions => {
  assertPlainObject(value, "root", optionsPath)
  assertAllowedKeys(value, allowedTopLevelOptionKeys, "root", optionsPath)

  const options = defaultExportOptions()

  if ("scope" in value) {
    options.scope = validateScopeOptions(value.scope, optionsPath)
  }

  if ("structure" in value) {
    options.structure = validateStructureOptions(value.structure, optionsPath)
  }

  if ("frontmatter" in value) {
    options.frontmatter = validateFrontmatterOptions(value.frontmatter, optionsPath)
  }

  if ("markdown" in value) {
    options.markdown = validateMarkdownOptions(value.markdown, optionsPath)
  }

  if ("assets" in value) {
    options.assets = validateAssetsOptions(value.assets, optionsPath)
  }

  return options
}

export const singlePostCliUsage = () =>
  `Usage: ${entrypoint} --blogId my-blog --logNo 123456789012 --outputDir ./output [--report ./output/report.json] [--manualReviewMarkdownPath ./output/post.md] [--metadataCachePath ./output/metadata-cache.json] [--options ./config/single-post.json] [--stdout]`

export const parseSinglePostCliArgs = (args: string[]) => {
  let blogId: string | null = null
  let logNo: string | null = null
  let outputDir: string | null = null
  let reportPath: string | null = null
  let manualReviewMarkdownPath: string | null = null
  let metadataCachePath: string | null = null
  let optionsPath: string | null = null
  let stdout = false

  const readValue = (index: number) => {
    const value = args[index + 1]

    if (!value || value.startsWith("--")) {
      throw usageError()
    }

    return value
  }

  for (let index = 0; index < args.length; index++) {
    const arg = args[index]

    if (arg === "--blogId") {
      blogId = readValue(index)
      index++
      continue
    }

    if (arg === "--logNo") {
      logNo = readValue(index)
      index++
      continue
    }

    if (arg === "--outputDir") {
      outputDir = readValue(index)
      index++
      continue
    }

    if (arg === "--report") {
      reportPath = readValue(index)
      index++
      continue
    }

    if (arg === "--manualReviewMarkdownPath") {
      manualReviewMarkdownPath = readValue(index)
      index++
      continue
    }

    if (arg === "--metadataCachePath") {
      metadataCachePath = readValue(index)
      index++
      continue
    }

    if (arg === "--options") {
      optionsPath = readValue(index)
      index++
      continue
    }

    if (arg === "--stdout") {
      stdout = true
      continue
    }

    throw usageError()
  }

  if (!blogId || !logNo || !outputDir) {
    throw usageError()
  }

  return {
    blogId,
    logNo,
    outputDir,
    reportPath,
    manualReviewMarkdownPath,
    metadataCachePath,
    optionsPath,
    stdout,
  }
}

export const renderSinglePostSummary = ({
  blogId,
  logNo,
  editorVersion,
  blockTypes,
  exporterMarkdownFilePath,
  manualReviewMarkdownFilePath,
  metadataCachePath,
  parserWarnings,
  reviewerWarnings,
  renderWarnings,
}: {
  blogId: string
  logNo: string
  editorVersion: number
  blockTypes: string[]
  exporterMarkdownFilePath: string
  manualReviewMarkdownFilePath: string | null
  metadataCachePath: string | null
  parserWarnings: string[]
  reviewerWarnings: string[]
  renderWarnings: string[]
}) =>
  [
    `blogId: ${blogId}`,
    `logNo: ${logNo}`,
    `editorVersion: ${editorVersion}`,
    `blockTypes: ${blockTypes.join(", ") || "(none)"}`,
    `parserWarnings: ${parserWarnings.length}`,
    `reviewerWarnings: ${reviewerWarnings.length}`,
    `renderWarnings: ${renderWarnings.length}`,
    `exporterMarkdownFilePath: ${exporterMarkdownFilePath}`,
    `manualReviewMarkdownFilePath: ${manualReviewMarkdownFilePath ?? "(not provided)"}`,
    `metadataCachePath: ${metadataCachePath ?? "(not provided)"}`,
  ].join("\n")

export const readSinglePostOptions = async ({
  optionsPath,
  readFile,
}: {
  optionsPath: string
  readFile: (path: string, encoding: "utf8") => Promise<string>
}) => {
  const text = await readFile(optionsPath, "utf8")

  let parsed: unknown

  try {
    parsed = JSON.parse(text)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    failOptions(optionsPath, `invalid JSON: ${message}`)
  }

  return validateSinglePostOptionsJson(parsed, optionsPath)
}
