import type { ExportProfile } from "../export-job/schema/ExportProfile.js"

import type {
  ExportOptions,
  FrontmatterFieldName,
  PartialExportOptions,
} from "./schema/ExportOptions.js"

import { allExportProfiles } from "../export-job/schema/ExportProfile.js"

import { defaultExportOptions as createDefaultExportOptions } from "./DefaultExportOptions.js"
import {
  frontmatterFieldMeta as configuredFrontmatterFieldMeta,
  frontmatterFieldOrder as configuredFrontmatterFieldOrder,
} from "./FrontmatterFields.js"
import { optionDescriptions as configuredOptionDescriptions } from "./OptionDescriptions.js"

export const frontmatterFieldOrder = configuredFrontmatterFieldOrder

export const frontmatterFieldMeta = configuredFrontmatterFieldMeta

const frontmatterAliasPattern = /^[A-Za-z_][A-Za-z0-9_-]*$/

export const optionDescriptions = configuredOptionDescriptions

export const getDefaultSlugWhitespace = (slugStyle: ExportOptions["structure"]["slugStyle"]) => {
  switch (slugStyle) {
    case "kebab":
      return "dash" as const
    case "snake":
      return "underscore" as const
    case "keep-title":
      return "keep-space" as const
  }
}

export const getFrontmatterExportKey = ({
  fieldName,
  alias,
}: {
  fieldName: FrontmatterFieldName
  alias: string
}) => alias.trim() || fieldName

export const validateFrontmatterAliases = ({
  enabled,
  fields,
  aliases,
}: ExportOptions["frontmatter"]) => {
  if (!enabled) {
    return []
  }

  const aliasOwners = new Map<string, FrontmatterFieldName>()
  const errors: string[] = []

  for (const fieldName of frontmatterFieldOrder) {
    if (!fields[fieldName]) {
      continue
    }

    const alias = aliases[fieldName]?.trim() ?? ""
    const exportKey = getFrontmatterExportKey({
      fieldName,
      alias,
    })

    if (alias && !frontmatterAliasPattern.test(alias)) {
      errors.push(
        `${fieldName} alias는 영문자 또는 _로 시작해야 하며 영문자, 숫자, -, _만 사용할 수 있습니다.`,
      )
      continue
    }

    const existingOwner = aliasOwners.get(exportKey)

    if (existingOwner) {
      errors.push(
        `${existingOwner}와 ${fieldName}가 같은 alias "${exportKey}"를 사용하고 있습니다.`,
      )
      continue
    }

    aliasOwners.set(exportKey, fieldName)
  }

  return errors
}

export const defaultExportOptions = createDefaultExportOptions

const pickFrontmatterRecord = <Value>(
  values: Partial<Record<FrontmatterFieldName, Value>> | undefined,
) => {
  const entries = frontmatterFieldOrder.flatMap((fieldName) => {
    const value = values?.[fieldName]

    return value === undefined ? [] : [[fieldName, value] as const]
  })

  return Object.fromEntries(entries) as Partial<Record<FrontmatterFieldName, Value>>
}

export const sanitizePersistedExportOptions = (
  options?: PartialExportOptions,
): PartialExportOptions => {
  const sanitized: PartialExportOptions = {}

  if (options?.scope) {
    const scope: NonNullable<PartialExportOptions["scope"]> = {}

    if (options.scope.categoryMode) {
      scope.categoryMode = options.scope.categoryMode
    }

    if ("dateFrom" in options.scope) {
      scope.dateFrom = options.scope.dateFrom ?? null
    }

    if ("dateTo" in options.scope) {
      scope.dateTo = options.scope.dateTo ?? null
    }

    if (Object.keys(scope).length > 0) {
      sanitized.scope = scope
    }
  }

  if (options?.structure) {
    sanitized.structure = {
      groupByCategory: options.structure.groupByCategory,
      slugStyle: options.structure.slugStyle,
      slugWhitespace: options.structure.slugWhitespace,
      postFolderNameTemplate: options.structure.postFolderNameTemplate,
    }

    Object.keys(sanitized.structure).forEach((key) => {
      if (
        sanitized.structure &&
        sanitized.structure[key as keyof typeof sanitized.structure] === undefined
      ) {
        delete sanitized.structure[key as keyof typeof sanitized.structure]
      }
    })

    if (sanitized.structure && Object.keys(sanitized.structure).length === 0) {
      delete sanitized.structure
    }
  }

  if (options?.frontmatter) {
    const frontmatter: NonNullable<PartialExportOptions["frontmatter"]> = {}

    if (typeof options.frontmatter.enabled === "boolean") {
      frontmatter.enabled = options.frontmatter.enabled
    }

    if (options.frontmatter.fields) {
      const fields = pickFrontmatterRecord(options.frontmatter.fields)

      if (Object.keys(fields).length > 0) {
        frontmatter.fields = fields
      }
    }

    if (options.frontmatter.aliases) {
      const aliases = pickFrontmatterRecord(options.frontmatter.aliases)

      if (Object.keys(aliases).length > 0) {
        frontmatter.aliases = aliases
      }
    }

    if (Object.keys(frontmatter).length > 0) {
      sanitized.frontmatter = frontmatter
    }
  }

  if (options?.blockOutputs) {
    const blockOutputs: NonNullable<PartialExportOptions["blockOutputs"]> = {}

    if (options.blockOutputs.templates) {
      blockOutputs.templates = Object.fromEntries(
        allExportProfiles.flatMap((profile) => {
          const templates = pickBlockTemplates(options.blockOutputs?.templates?.[profile])

          return Object.keys(templates).length > 0 ? [[profile, templates]] : []
        }),
      )
    }

    if (Object.keys(blockOutputs).length > 0) {
      sanitized.blockOutputs = blockOutputs
    }
  }

  if (options?.assets) {
    sanitized.assets = {
      ...options.assets,
    }
  }

  if (options?.links) {
    sanitized.links = {
      ...options.links,
    }
  }

  return sanitized
}

const coerceAssetOptions = (options: ExportOptions["assets"]) => {
  const downloadFailureMode =
    options.downloadFailureMode === "use-source" || options.downloadFailureMode === "omit"
      ? options.downloadFailureMode
      : "fail"
  const coercedOptions = {
    ...options,
    downloadFailureMode,
  } satisfies ExportOptions["assets"]

  if (coercedOptions.imageHandlingMode === "download-and-upload") {
    return {
      ...coercedOptions,
      downloadImages: true,
      downloadThumbnails: true,
    } satisfies ExportOptions["assets"]
  }

  return coercedOptions
}

const pickBlockTemplates = (templates?: Partial<Record<string, string>>) =>
  Object.fromEntries(
    Object.entries(templates ?? {}).filter(
      (entry): entry is [string, string] =>
        Boolean(entry[0].trim()) && typeof entry[1] === "string",
    ),
  ) satisfies Partial<Record<string, string>>

export const getBlockOutputTemplates = (
  options: Pick<ExportOptions, "blockOutputs">,
  profile: ExportProfile,
) => options.blockOutputs.templates[profile] ?? {}

export const cloneExportOptions = (options?: PartialExportOptions) => {
  const defaults = defaultExportOptions()
  const slugStyle = options?.structure?.slugStyle ?? defaults.structure.slugStyle
  const slugWhitespace = options?.structure?.slugWhitespace ?? getDefaultSlugWhitespace(slugStyle)

  const clonedOptions = {
    scope: {
      ...defaults.scope,
      ...options?.scope,
      categoryIds: options?.scope?.categoryIds ?? defaults.scope.categoryIds,
    },
    structure: {
      ...defaults.structure,
      ...options?.structure,
      slugStyle,
      slugWhitespace,
    },
    frontmatter: {
      enabled: options?.frontmatter?.enabled ?? defaults.frontmatter.enabled,
      fields: {
        ...defaults.frontmatter.fields,
        ...pickFrontmatterRecord(options?.frontmatter?.fields),
      },
      aliases: {
        ...defaults.frontmatter.aliases,
        ...pickFrontmatterRecord(options?.frontmatter?.aliases),
      },
    },
    blockOutputs: {
      templates: Object.fromEntries(
        allExportProfiles.map((profile) => [
          profile,
          pickBlockTemplates(options?.blockOutputs?.templates?.[profile]),
        ]),
      ) as ExportOptions["blockOutputs"]["templates"],
    },
    assets: {
      imageHandlingMode: options?.assets?.imageHandlingMode ?? defaults.assets.imageHandlingMode,
      compressionEnabled: options?.assets?.compressionEnabled ?? defaults.assets.compressionEnabled,
      downloadFailureMode:
        options?.assets?.downloadFailureMode ?? defaults.assets.downloadFailureMode,
      stickerAssetMode: options?.assets?.stickerAssetMode ?? defaults.assets.stickerAssetMode,
      downloadImages: options?.assets?.downloadImages ?? defaults.assets.downloadImages,
      downloadThumbnails: options?.assets?.downloadThumbnails ?? defaults.assets.downloadThumbnails,
      includeImageCaptions:
        options?.assets?.includeImageCaptions ?? defaults.assets.includeImageCaptions,
      thumbnailSource: options?.assets?.thumbnailSource ?? defaults.assets.thumbnailSource,
    },
    links: {
      sameBlogPostMode: options?.links?.sameBlogPostMode ?? defaults.links.sameBlogPostMode,
      sameBlogPostCustomUrlTemplate:
        options?.links?.sameBlogPostCustomUrlTemplate ??
        defaults.links.sameBlogPostCustomUrlTemplate,
    },
  } satisfies ExportOptions

  clonedOptions.assets = coerceAssetOptions(clonedOptions.assets)

  const frontmatterErrors = validateFrontmatterAliases(clonedOptions.frontmatter)

  if (frontmatterErrors.length > 0) {
    throw new Error(frontmatterErrors.join(" "))
  }

  return clonedOptions
}
