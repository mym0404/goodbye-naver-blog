import {
  blockOutputFamilyDefinitions,
  blockOutputFamilyOrder,
  resolveBlockOutputSelection,
} from "../../src/shared/block-registry.js"
import { defaultExportOptions } from "../../src/shared/export-options.js"
import { parserCapabilities } from "../../src/shared/parser-capabilities.js"
import type {
  BlockOutputSelection,
  BlockOutputSelectionByType,
  ExportOptions,
  ParserCapabilityId,
} from "../../src/shared/types.js"

const entrypoint = "pnpm exec tsx scripts/export-single-post.ts"

const allowedTopLevelOptionKeys = ["scope", "structure", "frontmatter", "markdown", "blockOutputs", "unsupportedBlockCases", "assets", "links"] as const
type SupportedBlockOutputType = keyof BlockOutputSelectionByType
const allowedScopeKeys = ["categoryIds", "categoryMode", "dateFrom", "dateTo"] as const
const allowedStructureKeys = [
  "groupByCategory",
  "includeDateInPostFolderName",
  "includeLogNoInPostFolderName",
  "postDirectoryName",
  "assetDirectoryName",
  "slugStyle",
  "slugWhitespace",
  "postFolderNameMode",
  "postFolderNameCustomTemplate",
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
] as const
const allowedBlockOutputsKeys = ["defaults", "overrides"] as const
const allowedAssetsKeys = [
  "imageHandlingMode",
  "compressionEnabled",
  "stickerAssetMode",
  "downloadImages",
  "downloadThumbnails",
  "includeImageCaptions",
  "thumbnailSource",
] as const
const allowedLinksKeys = ["sameBlogPostMode", "sameBlogPostCustomUrlTemplate"] as const

const categoryModes = ["selected-and-descendants", "exact-selected"] as const
const slugStyles = ["kebab", "snake", "keep-title"] as const
const slugWhitespaces = ["dash", "underscore", "keep-space"] as const
const postFolderNameModes = ["preset", "custom-template"] as const
const linkStyles = ["inlined", "referenced"] as const
const imageHandlingModes = ["download", "remote", "download-and-upload"] as const
const stickerAssetModes = ["ignore", "download-original"] as const
const thumbnailSources = ["post-list-first", "first-body-image", "none"] as const
const sameBlogPostModes = ["keep-source", "custom-url", "relative-filepath"] as const
const parserCapabilityIdSet = new Set(parserCapabilities.map((capability) => capability.id))
const parserCapabilityBlockTypeMap = new Map(
  parserCapabilities.map((capability) => [capability.id, capability.blockType]),
)
const blockOutputFamilyDefinitionMap = new Map(
  blockOutputFamilyDefinitions.map((definition) => [definition.blockType, definition]),
)

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

  if ("groupByCategory" in value) {
    const groupByCategory = value.groupByCategory
    assertBoolean(groupByCategory, "structure.groupByCategory", optionsPath)
    structure.groupByCategory = groupByCategory
  }

  if ("includeDateInPostFolderName" in value) {
    const includeDateInPostFolderName = value.includeDateInPostFolderName
    assertBoolean(
      includeDateInPostFolderName,
      "structure.includeDateInPostFolderName",
      optionsPath,
    )
    structure.includeDateInPostFolderName = includeDateInPostFolderName
  }

  if ("includeLogNoInPostFolderName" in value) {
    const includeLogNoInPostFolderName = value.includeLogNoInPostFolderName
    assertBoolean(
      includeLogNoInPostFolderName,
      "structure.includeLogNoInPostFolderName",
      optionsPath,
    )
    structure.includeLogNoInPostFolderName = includeLogNoInPostFolderName
  }

  if ("postDirectoryName" in value) {
    failOptions(
      optionsPath,
      "structure.postDirectoryName is no longer supported; posts now export to per-post folders with index.md",
    )
  }

  if ("assetDirectoryName" in value) {
    failOptions(
      optionsPath,
      "structure.assetDirectoryName is no longer supported; assets now live beside each post's index.md",
    )
  }

  if ("slugStyle" in value) {
    const slugStyle = value.slugStyle
    assertEnum(slugStyle, slugStyles, "structure.slugStyle", optionsPath)
    structure.slugStyle = slugStyle
  }

  if ("slugWhitespace" in value) {
    const slugWhitespace = value.slugWhitespace
    assertEnum(slugWhitespace, slugWhitespaces, "structure.slugWhitespace", optionsPath)
    structure.slugWhitespace = slugWhitespace
  }

  if ("postFolderNameMode" in value) {
    const postFolderNameMode = value.postFolderNameMode
    assertEnum(postFolderNameMode, postFolderNameModes, "structure.postFolderNameMode", optionsPath)
    structure.postFolderNameMode = postFolderNameMode
  }

  if ("postFolderNameCustomTemplate" in value) {
    const postFolderNameCustomTemplate = value.postFolderNameCustomTemplate
    assertString(postFolderNameCustomTemplate, "structure.postFolderNameCustomTemplate", optionsPath)
    structure.postFolderNameCustomTemplate = postFolderNameCustomTemplate
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

  return markdown
}

const validateBlockOutputSelection = <Block extends SupportedBlockOutputType>({
  value,
  context,
  optionsPath,
  blockType,
}: {
  value: unknown
  context: string
  optionsPath: string
  blockType: Block
}) => {
  assertPlainObject(value, context, optionsPath)
  assertAllowedKeys(value, ["variant", "params"], context, optionsPath)

  const definition =
    blockOutputFamilyDefinitionMap.get(blockType) ??
    failOptions(optionsPath, `${context} references unknown block type: ${blockType}`)

  const nextSelection = resolveBlockOutputSelection({
    blockType,
  })

  if ("variant" in value) {
    const variant = value.variant
    assertString(variant, `${context}.variant`, optionsPath)

    if (!definition.variants.some((item) => item.id === variant)) {
      failOptions(
        optionsPath,
        `${context}.variant must be one of: ${definition.variants.map((item) => item.id).join(", ")}`,
      )
    }

    nextSelection.variant = variant as BlockOutputSelection<Block>["variant"]
  }

  if ("params" in value) {
    const paramsValue = value.params
    assertPlainObject(paramsValue, `${context}.params`, optionsPath)

    const allowedParamKeys = new Set(definition.params?.map((param) => param.key) ?? [])
    assertAllowedKeys(
      paramsValue,
      Array.from(allowedParamKeys),
      `${context}.params`,
      optionsPath,
    )

    nextSelection.params = {
      ...(nextSelection.params ?? {}),
    }

    for (const [paramKey, paramValue] of Object.entries(paramsValue)) {
      const paramDefinition =
        definition.params?.find((param) => param.key === paramKey) ??
        failOptions(optionsPath, `${context}.params.${paramKey} is not supported`)

      if (paramDefinition.input === "number") {
        assertFiniteNumber(paramValue, `${context}.params.${paramKey}`, optionsPath)
      } else {
        assertString(paramValue, `${context}.params.${paramKey}`, optionsPath)
      }

      nextSelection.params[paramKey] = paramValue
    }
  }

  return nextSelection as BlockOutputSelection<Block>
}

const assignBlockOutputDefault = <Block extends SupportedBlockOutputType>({
  defaults,
  blockType,
  selection,
}: {
  defaults: ExportOptions["blockOutputs"]["defaults"]
  blockType: Block
  selection: BlockOutputSelection<Block>
}) => {
  defaults[blockType] = selection
}

const assignBlockOutputOverride = <CapabilityId extends ParserCapabilityId>({
  overrides,
  capabilityId,
  selection,
}: {
  overrides: ExportOptions["blockOutputs"]["overrides"]
  capabilityId: CapabilityId
  selection: ExportOptions["blockOutputs"]["overrides"][CapabilityId]
}) => {
  overrides[capabilityId] = selection
}

const validateBlockOutputsOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "blockOutputs", optionsPath)
  assertAllowedKeys(value, allowedBlockOutputsKeys, "blockOutputs", optionsPath)

  const blockOutputs = defaultExportOptions().blockOutputs

  if ("defaults" in value) {
    const defaultsValue = value.defaults
    assertPlainObject(defaultsValue, "blockOutputs.defaults", optionsPath)
    assertAllowedKeys(defaultsValue, blockOutputFamilyOrder, "blockOutputs.defaults", optionsPath)

    const nextDefaults: ExportOptions["blockOutputs"]["defaults"] = {
      ...blockOutputs.defaults,
    }

    for (const blockType of blockOutputFamilyOrder) {
      if (blockType in defaultsValue) {
        assignBlockOutputDefault({
          defaults: nextDefaults,
          blockType,
          selection: validateBlockOutputSelection({
            value: defaultsValue[blockType],
            context: `blockOutputs.defaults.${blockType}`,
            optionsPath,
            blockType,
          }),
        })
      }
    }

    blockOutputs.defaults = nextDefaults
  }

  if ("overrides" in value) {
    const overridesValue = value.overrides
    assertPlainObject(overridesValue, "blockOutputs.overrides", optionsPath)
    assertAllowedKeys(
      overridesValue,
      Array.from(parserCapabilityIdSet),
      "blockOutputs.overrides",
      optionsPath,
    )

    const nextOverrides: ExportOptions["blockOutputs"]["overrides"] = {
      ...blockOutputs.overrides,
    }

    for (const [capabilityId, selection] of Object.entries(overridesValue)) {
      const typedCapabilityId = capabilityId as ParserCapabilityId
      const blockType =
        parserCapabilityBlockTypeMap.get(typedCapabilityId) ??
        failOptions(optionsPath, `blockOutputs.overrides.${capabilityId} references unknown capability`)

      assignBlockOutputOverride({
        overrides: nextOverrides,
        capabilityId: typedCapabilityId,
        selection: validateBlockOutputSelection({
          value: selection,
          context: `blockOutputs.overrides.${capabilityId}`,
          optionsPath,
          blockType,
        }) as ExportOptions["blockOutputs"]["overrides"][typeof typedCapabilityId],
      })
    }

    blockOutputs.overrides = nextOverrides
  }

  return blockOutputs
}

const validateAssetsOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "assets", optionsPath)
  assertAllowedKeys(value, allowedAssetsKeys, "assets", optionsPath)

  const assets = defaultExportOptions().assets

  if ("imageHandlingMode" in value) {
    const imageHandlingMode = value.imageHandlingMode
    assertEnum(imageHandlingMode, imageHandlingModes, "assets.imageHandlingMode", optionsPath)
    assets.imageHandlingMode = imageHandlingMode
  }

  if ("compressionEnabled" in value) {
    const compressionEnabled = value.compressionEnabled
    assertBoolean(compressionEnabled, "assets.compressionEnabled", optionsPath)
    assets.compressionEnabled = compressionEnabled
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

const validateLinksOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "links", optionsPath)
  assertAllowedKeys(value, allowedLinksKeys, "links", optionsPath)

  const links = defaultExportOptions().links

  if ("sameBlogPostMode" in value) {
    const sameBlogPostMode = value.sameBlogPostMode
    assertEnum(sameBlogPostMode, sameBlogPostModes, "links.sameBlogPostMode", optionsPath)
    links.sameBlogPostMode = sameBlogPostMode
  }

  if ("sameBlogPostCustomUrlTemplate" in value) {
    const sameBlogPostCustomUrlTemplate = value.sameBlogPostCustomUrlTemplate
    assertString(sameBlogPostCustomUrlTemplate, "links.sameBlogPostCustomUrlTemplate", optionsPath)
    links.sameBlogPostCustomUrlTemplate = sameBlogPostCustomUrlTemplate
  }

  return links
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

  if ("blockOutputs" in value) {
    options.blockOutputs = validateBlockOutputsOptions(value.blockOutputs, optionsPath)
  }

  if ("assets" in value) {
    options.assets = validateAssetsOptions(value.assets, optionsPath)
  }

  if ("links" in value) {
    options.links = validateLinksOptions(value.links, optionsPath)
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
