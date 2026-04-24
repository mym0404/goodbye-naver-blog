import type {
  BlockType,
  ExportOptions,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
  OptionDescriptionMap,
  ParserCapabilityId,
} from "./types.js"
import {
  blockOutputFamilyOrder,
  defaultBlockOutputSelections,
  resolveBlockOutputSelection,
} from "./block-registry.js"
import { parserCapabilities } from "./parser-capabilities.js"

export type PartialExportOptions = {
  scope?: Partial<ExportOptions["scope"]>
  structure?: Partial<ExportOptions["structure"]>
  frontmatter?: {
    enabled?: boolean
    fields?: Partial<Record<FrontmatterFieldName, boolean>>
    aliases?: Partial<Record<FrontmatterFieldName, string>>
  }
  markdown?: Partial<ExportOptions["markdown"]>
  blockOutputs?: {
    defaults?: Partial<ExportOptions["blockOutputs"]["defaults"]>
    overrides?: Partial<ExportOptions["blockOutputs"]["overrides"]>
  }
  assets?: Partial<ExportOptions["assets"]>
  links?: Partial<ExportOptions["links"]>
}

export const frontmatterFieldOrder: FrontmatterFieldName[] = [
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
]

export const frontmatterFieldMeta: Record<FrontmatterFieldName, FrontmatterFieldMeta> = {
  title: {
    label: "title",
    description: "글 제목을 기록합니다.",
    defaultAlias: "title",
  },
  source: {
    label: "source",
    description: "원본 네이버 글 URL을 기록합니다.",
    defaultAlias: "source",
  },
  blogId: {
    label: "blogId",
    description: "블로그 식별자를 기록합니다.",
    defaultAlias: "blogId",
  },
  logNo: {
    label: "logNo",
    description: "네이버 글 번호를 숫자로 기록합니다.",
    defaultAlias: "logNo",
  },
  publishedAt: {
    label: "publishedAt",
    description: "발행 시각을 ISO 문자열로 기록합니다.",
    defaultAlias: "publishedAt",
  },
  category: {
    label: "category",
    description: "현재 카테고리 이름을 기록합니다.",
    defaultAlias: "category",
  },
  categoryPath: {
    label: "categoryPath",
    description: "상위 카테고리 경로를 배열로 기록합니다.",
    defaultAlias: "categoryPath",
  },
  editorVersion: {
    label: "editorVersion",
    description: "파싱된 에디터 버전을 기록합니다.",
    defaultAlias: "editorVersion",
  },
  visibility: {
    label: "visibility",
    description: "현재 공개 범위를 기록합니다.",
    defaultAlias: "visibility",
  },
  tags: {
    label: "tags",
    description: "본문에서 읽은 태그 목록을 기록합니다.",
    defaultAlias: "tags",
  },
  thumbnail: {
    label: "thumbnail",
    description: "대표 썸네일 경로 또는 URL을 기록합니다.",
    defaultAlias: "thumbnail",
  },
  video: {
    label: "video",
    description: "추출된 비디오 메타데이터를 기록합니다.",
    defaultAlias: "video",
  },
  warnings: {
    label: "warnings",
    description: "렌더링 중 발생한 경고 목록을 기록합니다.",
    defaultAlias: "warnings",
  },
  exportedAt: {
    label: "exportedAt",
    description: "내보낸 시각을 ISO 문자열로 기록합니다.",
    defaultAlias: "exportedAt",
  },
  assetPaths: {
    label: "assetPaths",
    description: "생성된 자산 경로 목록을 기록합니다.",
    defaultAlias: "assetPaths",
  },
}

export const frontmatterAliasPattern = /^[A-Za-z_][A-Za-z0-9_-]*$/

export const optionDescriptions: OptionDescriptionMap = {
  "scope-categoryMode": "선택한 카테고리만 내보낼지, 하위 카테고리까지 함께 포함할지 정합니다.",
  "scope-dateFrom": "이 날짜 이후에 발행한 글만 범위에 포함합니다.",
  "scope-dateTo": "이 날짜 이전에 발행한 글까지만 범위에 포함합니다.",
  "structure-groupByCategory": "카테고리 경로를 출력 폴더 구조에 유지할지 정합니다.",
  "structure-includeDateInPostFolderName": "글 폴더 이름 앞부분에 발행 날짜를 붙입니다.",
  "structure-includeLogNoInPostFolderName": "글 폴더 이름에 네이버 logNo를 함께 넣습니다.",
  "structure-slugStyle": "글 제목 slug와 카테고리 경로를 kebab-case, snake_case, 원본 제목 유지 중 어떤 방식으로 쓸지 정합니다.",
  "structure-slugWhitespace": "slug와 카테고리 이름 안 공백과 치환된 구분 문자를 -, _, 공백 유지 중에서 정합니다.",
  "structure-postFolderNameMode": "기본 규칙을 쓸지, 지원 변수를 조합한 커스텀 템플릿으로 글 폴더 이름을 만들지 정합니다.",
  "structure-postFolderNameCustomTemplate": "지원 변수 {slug}, {category}, {title}, {logNo}, {blogId}, {date}, {year}, {YYYY}, {YY}, {month}, {MM}, {M}, {day}, {DD}, {D}를 조합해 글 폴더 이름을 만듭니다.",
  "frontmatter-enabled": "YAML frontmatter 블록 자체를 Markdown 파일 상단에 넣을지 정합니다.",
  "markdown-linkStyle": "일반 링크를 inline 형식으로 쓸지 reference 형식으로 분리할지 정합니다.",
  "assets-imageHandlingMode": "이미지를 로컬로 유지할지, 원본 URL을 유지할지, 내보낸 뒤 업로드까지 이어갈지 정합니다.",
  "assets-compressionEnabled": "다운로드한 로컬 이미지 파일에 안전한 압축을 적용할지 정합니다.",
  "assets-downloadFailureMode": "이미지 다운로드가 실패했을 때 경고 후 원본 URL 유지, 경고 없이 원본 URL 유지, 경고 후 이미지 생략, 경고 없이 이미지 생략 중에서 정합니다.",
  "assets-stickerAssetMode": "네이버 스티커를 기본적으로 무시할지, 원본 자산 URL로 내려받아 본문에 포함할지 정합니다.",
  "assets-downloadImages": "본문 이미지 파일을 실제로 다운로드할지 정합니다.",
  "assets-downloadThumbnails": "썸네일과 비디오 썸네일 파일을 실제로 다운로드할지 정합니다.",
  "assets-includeImageCaptions": "이미지 아래에 캡션 텍스트를 Markdown으로 함께 남깁니다.",
  "assets-thumbnailSource": "frontmatter thumbnail 값에 무엇을 넣을지 고릅니다. 글 목록 대표 썸네일, 본문 첫 이미지, 또는 저장 안 함 중에서 선택합니다.",
  "links-sameBlogPostMode": "현재 export 중인 같은 블로그의 다른 글 링크를 그대로 둘지, 커스텀 URL이나 상대경로로 바꿀지 정합니다.",
  "links-sameBlogPostCustomUrlTemplate": "지원 변수 {slug}, {category}, {title}, {logNo}, {blogId}, {date}, {year}, {YYYY}, {YY}, {month}, {MM}, {M}, {day}, {DD}, {D}를 넣어 커스텀 URL을 만듭니다.",
}

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
        `${fieldName} alias는 영문자 또는 _로 시작하고 영문자, 숫자, -, _만 사용할 수 있습니다.`,
      )
      continue
    }

    const existingOwner = aliasOwners.get(exportKey)

    if (existingOwner) {
      errors.push(`${existingOwner}와 ${fieldName}가 같은 alias "${exportKey}"를 사용하고 있습니다.`)
      continue
    }

    aliasOwners.set(exportKey, fieldName)
  }

  return errors
}

export const defaultExportOptions = (): ExportOptions => ({
  scope: {
    categoryIds: [],
    categoryMode: "selected-and-descendants",
    dateFrom: null,
    dateTo: null,
  },
  structure: {
    groupByCategory: true,
    includeDateInPostFolderName: true,
    includeLogNoInPostFolderName: false,
    slugStyle: "snake",
    slugWhitespace: "underscore",
    postFolderNameMode: "preset",
    postFolderNameCustomTemplate: "",
  },
  frontmatter: {
    enabled: true,
    fields: {
      title: true,
      source: true,
      blogId: true,
      logNo: true,
      publishedAt: true,
      category: true,
      categoryPath: true,
      editorVersion: true,
      visibility: true,
      tags: true,
      thumbnail: true,
      video: true,
      warnings: true,
      exportedAt: true,
      assetPaths: false,
    },
    aliases: {
      title: "",
      source: "",
      blogId: "",
      logNo: "",
      publishedAt: "",
      category: "",
      categoryPath: "",
      editorVersion: "",
      visibility: "",
      tags: "",
      thumbnail: "",
      video: "",
      warnings: "",
      exportedAt: "",
      assetPaths: "",
    },
  },
  markdown: {
    linkStyle: "inlined",
  },
  blockOutputs: {
    defaults: Object.fromEntries(
      blockOutputFamilyOrder.map((blockType) => [blockType, defaultBlockOutputSelections[blockType]]),
    ) as ExportOptions["blockOutputs"]["defaults"],
    overrides: {},
  },
  assets: {
    imageHandlingMode: "download-and-upload",
    compressionEnabled: true,
    downloadFailureMode: "warn-and-use-source",
    stickerAssetMode: "ignore",
    downloadImages: true,
    downloadThumbnails: true,
    includeImageCaptions: true,
    thumbnailSource: "post-list-first",
  },
  links: {
    sameBlogPostMode: "keep-source",
    sameBlogPostCustomUrlTemplate: "",
  },
})

export const sanitizePersistedExportOptions = (options?: PartialExportOptions): PartialExportOptions => {
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
      includeDateInPostFolderName: options.structure.includeDateInPostFolderName,
      includeLogNoInPostFolderName: options.structure.includeLogNoInPostFolderName,
      slugStyle: options.structure.slugStyle,
      slugWhitespace: options.structure.slugWhitespace,
      postFolderNameMode: options.structure.postFolderNameMode,
      postFolderNameCustomTemplate: options.structure.postFolderNameCustomTemplate,
    }

    Object.keys(sanitized.structure).forEach((key) => {
      if (sanitized.structure && sanitized.structure[key as keyof typeof sanitized.structure] === undefined) {
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
      frontmatter.fields = {
        ...options.frontmatter.fields,
      }
    }

    if (options.frontmatter.aliases) {
      frontmatter.aliases = {
        ...options.frontmatter.aliases,
      }
    }

    if (Object.keys(frontmatter).length > 0) {
      sanitized.frontmatter = frontmatter
    }
  }

  if (options?.markdown) {
    const markdown: PartialExportOptions["markdown"] = {}

    if (options.markdown.linkStyle) {
      markdown.linkStyle = options.markdown.linkStyle
    }

    if (Object.keys(markdown).length > 0) {
      sanitized.markdown = markdown
    }
  }

  if (options?.blockOutputs) {
    const blockOutputs: NonNullable<PartialExportOptions["blockOutputs"]> = {}

    if (options.blockOutputs.defaults) {
      blockOutputs.defaults = Object.fromEntries(
        Object.entries(options.blockOutputs.defaults).filter(([blockType]) =>
          blockOutputFamilyOrder.includes(blockType as BlockType),
        ),
      ) as NonNullable<PartialExportOptions["blockOutputs"]>["defaults"]
    }

    if (options.blockOutputs.overrides) {
      blockOutputs.overrides = Object.fromEntries(
        Object.entries(options.blockOutputs.overrides).filter(([capabilityId]) =>
          parserCapabilityBlockTypeMap.has(capabilityId as ParserCapabilityId),
        ),
      ) as NonNullable<PartialExportOptions["blockOutputs"]>["overrides"]
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
  if (options.imageHandlingMode === "download-and-upload") {
    return {
      ...options,
      downloadImages: true,
      downloadThumbnails: true,
    } satisfies ExportOptions["assets"]
  }

  return options
}

const parserCapabilityBlockTypeMap = new Map(
  parserCapabilities.map((capability) => [capability.id, capability.blockType]),
)

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

const buildDefaultBlockOutputs = (options?: PartialExportOptions["blockOutputs"]) =>
  Object.fromEntries(
    blockOutputFamilyOrder.map((blockType) => [
      blockType,
      resolveBlockOutputSelection({
        blockType,
        blockOutputs: options,
      }),
    ]),
  ) as ExportOptions["blockOutputs"]["defaults"]

const buildBlockOutputOverrides = ({
  defaults,
  overrides,
}: {
  defaults: ExportOptions["blockOutputs"]["defaults"]
  overrides?: NonNullable<PartialExportOptions["blockOutputs"]>["overrides"]
}) => {
  const resolvedOverrides: ExportOptions["blockOutputs"]["overrides"] = {}

  for (const [capabilityId, selection] of Object.entries(overrides ?? {})) {
    const typedCapabilityId = capabilityId as ParserCapabilityId
    const blockType = parserCapabilityBlockTypeMap.get(typedCapabilityId)

    if (!blockType || !selection) {
      continue
    }

    assignBlockOutputOverride({
      overrides: resolvedOverrides,
      capabilityId: typedCapabilityId,
      selection: resolveBlockOutputSelection({
        blockType,
        capabilityId: typedCapabilityId,
        blockOutputs: {
          defaults,
          overrides: {
            [typedCapabilityId]: selection,
          },
        },
      }) as ExportOptions["blockOutputs"]["overrides"][typeof typedCapabilityId],
    })
  }

  return resolvedOverrides
}

export const cloneExportOptions = (options?: PartialExportOptions) => {
  const defaults = defaultExportOptions()
  const slugStyle = options?.structure?.slugStyle ?? defaults.structure.slugStyle
  const slugWhitespace = options?.structure?.slugWhitespace ?? getDefaultSlugWhitespace(slugStyle)
  const resolvedBlockOutputDefaults = buildDefaultBlockOutputs(options?.blockOutputs)

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
        ...options?.frontmatter?.fields,
      },
      aliases: {
        ...defaults.frontmatter.aliases,
        ...options?.frontmatter?.aliases,
      },
    },
    markdown: {
      linkStyle: options?.markdown?.linkStyle ?? defaults.markdown.linkStyle,
    },
    blockOutputs: {
      defaults: resolvedBlockOutputDefaults,
      overrides: buildBlockOutputOverrides({
        defaults: resolvedBlockOutputDefaults,
        overrides: options?.blockOutputs?.overrides,
      }),
    },
    assets: {
      imageHandlingMode:
        options?.assets?.imageHandlingMode ?? defaults.assets.imageHandlingMode,
      compressionEnabled:
        options?.assets?.compressionEnabled ?? defaults.assets.compressionEnabled,
      downloadFailureMode:
        options?.assets?.downloadFailureMode ?? defaults.assets.downloadFailureMode,
      stickerAssetMode: options?.assets?.stickerAssetMode ?? defaults.assets.stickerAssetMode,
      downloadImages: options?.assets?.downloadImages ?? defaults.assets.downloadImages,
      downloadThumbnails:
        options?.assets?.downloadThumbnails ?? defaults.assets.downloadThumbnails,
      includeImageCaptions:
        options?.assets?.includeImageCaptions ?? defaults.assets.includeImageCaptions,
      thumbnailSource: options?.assets?.thumbnailSource ?? defaults.assets.thumbnailSource,
    },
    links: {
      sameBlogPostMode:
        options?.links?.sameBlogPostMode ?? defaults.links.sameBlogPostMode,
      sameBlogPostCustomUrlTemplate:
        options?.links?.sameBlogPostCustomUrlTemplate ?? defaults.links.sameBlogPostCustomUrlTemplate,
    },
  } satisfies ExportOptions

  clonedOptions.assets = coerceAssetOptions(clonedOptions.assets)

  const frontmatterErrors = validateFrontmatterAliases(clonedOptions.frontmatter)

  if (frontmatterErrors.length > 0) {
    throw new Error(frontmatterErrors.join(" "))
  }

  return clonedOptions
}
