import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"

import type { ExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"

const allowedTopLevelOptionKeys = [
  "scope",
  "structure",
  "frontmatter",
  "blockOutputs",
  "assets",
  "links",
] as const
const allowedScopeKeys = ["categoryIds", "categoryMode", "dateFrom", "dateTo"] as const
const allowedStructureKeys = [
  "groupByCategory",
  "slugStyle",
  "slugWhitespace",
  "postFolderNameTemplate",
] as const
const allowedFrontmatterKeys = ["enabled", "fields", "aliases"] as const
const allowedFrontmatterFieldKeys = [
  "title",
  "source",
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
const allowedBlockTemplateKeys = ["templates"] as const
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
const imageHandlingModes = ["download", "remote", "download-and-upload"] as const
const stickerAssetModes = ["ignore", "download-original"] as const
const thumbnailSources = ["post-list-first", "first-body-image", "none"] as const
const sameBlogPostModes = ["keep-source", "custom-url", "relative-filepath"] as const

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const formatContext = (context: string, key: string) => `${context}.${key}`

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

function assertBoolean(
  value: unknown,
  context: string,
  optionsPath: string,
): asserts value is boolean {
  if (typeof value !== "boolean") {
    failOptions(optionsPath, `${context} must be a boolean`)
  }
}

function assertString(
  value: unknown,
  context: string,
  optionsPath: string,
): asserts value is string {
  if (typeof value !== "string") {
    failOptions(optionsPath, `${context} must be a string`)
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
    return
  }

  items.forEach((item, index) => {
    if (typeof item !== "number" || !Number.isFinite(item)) {
      failOptions(optionsPath, `${formatContext(context, String(index))} must be a finite number`)
    }
  })
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

  if ("postFolderNameTemplate" in value) {
    const postFolderNameTemplate = value.postFolderNameTemplate
    assertString(postFolderNameTemplate, "structure.postFolderNameTemplate", optionsPath)
    structure.postFolderNameTemplate = postFolderNameTemplate
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

const validateBlockTemplateOptions = (value: unknown, optionsPath: string) => {
  assertPlainObject(value, "blockOutputs", optionsPath)
  assertAllowedKeys(value, allowedBlockTemplateKeys, "blockOutputs", optionsPath)

  const blockOutputs = defaultExportOptions().blockOutputs

  if ("templates" in value) {
    const templatesValue = value.templates
    assertPlainObject(templatesValue, "blockOutputs.templates", optionsPath)

    const templates: Partial<Record<string, string>> = {}

    for (const [templateKey, template] of Object.entries(templatesValue)) {
      assertString(template, `blockOutputs.templates.${templateKey}`, optionsPath)

      if (templateKey.trim()) {
        if (!templateKey.includes(":")) {
          failOptions(
            optionsPath,
            `blockOutputs.templates contains unsupported keys: ${templateKey}`,
          )
        }

        templates[templateKey] = template
      }
    }

    blockOutputs.templates = { gfm: templates }
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

  if ("blockOutputs" in value) {
    options.blockOutputs = validateBlockTemplateOptions(value.blockOutputs, optionsPath)
  }

  if ("assets" in value) {
    options.assets = validateAssetsOptions(value.assets, optionsPath)
  }

  if ("links" in value) {
    options.links = validateLinksOptions(value.links, optionsPath)
  }

  return options
}

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
