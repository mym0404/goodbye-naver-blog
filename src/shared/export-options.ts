import type {
  ExportOptions,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
  OptionDescriptionMap,
} from "./types.js"

export type PartialExportOptions = {
  scope?: Partial<ExportOptions["scope"]>
  structure?: Partial<ExportOptions["structure"]>
  frontmatter?: {
    enabled?: boolean
    fields?: Partial<Record<FrontmatterFieldName, boolean>>
    aliases?: Partial<Record<FrontmatterFieldName, string>>
  }
  markdown?: Partial<ExportOptions["markdown"]>
  assets?: Partial<ExportOptions["assets"]>
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
    description: "현재 export visibility를 기록합니다.",
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
    description: "export 시각을 ISO 문자열로 기록합니다.",
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
  "structure-cleanOutputDir": "export 전에 출력 폴더를 비우고 이번 결과만 다시 생성합니다.",
  "structure-groupByCategory": "카테고리 경로를 출력 폴더 구조에 유지할지 정합니다.",
  "structure-includeDateInPostFolderName": "글 폴더 이름 앞부분에 발행 날짜를 붙입니다.",
  "structure-includeLogNoInPostFolderName": "글 폴더 이름에 네이버 logNo를 함께 넣습니다.",
  "structure-slugStyle": "제목을 안전한 slug로 바꿀지 원문 제목을 최대한 유지할지 정합니다.",
  "frontmatter-enabled": "YAML frontmatter 블록 자체를 Markdown 파일 상단에 넣을지 정합니다.",
  "markdown-linkStyle": "일반 링크를 inline 형식으로 쓸지 reference 형식으로 분리할지 정합니다.",
  "markdown-formulaInlineWrapperOpen": "인라인 수식 앞에 붙일 래퍼 문자열입니다. 기본값은 `$`입니다.",
  "markdown-formulaInlineWrapperClose": "인라인 수식 뒤에 붙일 래퍼 문자열입니다. 기본값은 `$`입니다.",
  "markdown-formulaBlockStyle": "블록 수식을 wrapper 문자열로 감쌀지 `math` fence를 사용할지 정합니다.",
  "markdown-formulaBlockWrapperOpen": "블록 수식 시작 래퍼 문자열입니다. 기본값은 `$$`입니다.",
  "markdown-formulaBlockWrapperClose": "블록 수식 종료 래퍼 문자열입니다. 기본값은 `$$`입니다.",
  "markdown-tableStyle": "단순 표는 Markdown으로 유지하고 복잡한 표는 가능한 텍스트를 최대한 보존합니다.",
  "markdown-imageStyle": "이미지를 일반 Markdown 이미지, 원본 링크 감싸기, 링크만 남기기 중에서 고릅니다.",
  "markdown-imageGroupStyle": "이미지 묶음을 개별 이미지로 풀어서 렌더링하는 방식을 제어합니다.",
  "markdown-dividerStyle": "구분선을 `---` 또는 `***` 중 어떤 문자로 출력할지 정합니다.",
  "markdown-codeFenceStyle": "코드 블록 fence 문자를 backtick 또는 tilde로 정합니다.",
  "markdown-headingLevelOffset": "제목 레벨을 전체적으로 올리거나 내려서 다른 문서 구조에 맞춥니다.",
  "assets-imageHandlingMode": "이미지를 로컬로 유지할지, 원본 URL을 유지할지, export 뒤 업로드까지 이어갈지 정합니다.",
  "assets-compressionEnabled": "다운로드한 로컬 이미지 파일에 안전한 압축을 적용할지 정합니다.",
  "assets-imageContentMode": "본문에 들어가는 이미지를 파일 경로로 참조할지 base64 data URL로 직접 임베딩할지 정합니다.",
  "assets-stickerAssetMode": "네이버 스티커를 기본적으로 무시할지, 원본 자산 URL로 내려받아 본문에 포함할지 정합니다.",
  "assets-downloadImages": "본문 이미지 파일을 실제로 다운로드할지 정합니다.",
  "assets-downloadThumbnails": "썸네일과 비디오 썸네일 파일을 실제로 다운로드할지 정합니다.",
  "assets-includeImageCaptions": "이미지 아래에 캡션 텍스트를 Markdown으로 함께 남깁니다.",
  "assets-thumbnailSource": "frontmatter thumbnail 값을 글 목록 썸네일, 본문 첫 미디어, 또는 제외 중에서 고릅니다.",
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
    cleanOutputDir: true,
    groupByCategory: true,
    includeDateInPostFolderName: true,
    includeLogNoInPostFolderName: false,
    slugStyle: "kebab",
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
    formulaInlineStyle: "wrapper",
    formulaInlineWrapperOpen: "$",
    formulaInlineWrapperClose: "$",
    formulaBlockStyle: "wrapper",
    formulaBlockWrapperOpen: "$$",
    formulaBlockWrapperClose: "$$",
    tableStyle: "gfm-or-html",
    imageStyle: "markdown-image",
    imageGroupStyle: "split-images",
    rawHtmlPolicy: "omit",
    dividerStyle: "dash",
    codeFenceStyle: "backtick",
    headingLevelOffset: 0,
  },
  assets: {
    imageHandlingMode: "download",
    compressionEnabled: false,
    imageContentMode: "path",
    stickerAssetMode: "ignore",
    downloadImages: true,
    downloadThumbnails: true,
    includeImageCaptions: true,
    thumbnailSource: "post-list-first",
  },
})

const coerceAssetOptions = (options: ExportOptions["assets"]) => {
  if (options.imageContentMode === "base64") {
    return {
      ...options,
      imageHandlingMode: "download",
      downloadImages: true,
    } satisfies ExportOptions["assets"]
  }

  if (options.imageHandlingMode === "download-and-upload") {
    return {
      ...options,
      downloadImages: true,
      downloadThumbnails: true,
    } satisfies ExportOptions["assets"]
  }

  return options
}

export const cloneExportOptions = (options?: PartialExportOptions) => {
  const defaults = defaultExportOptions()

  const clonedOptions = {
    scope: {
      ...defaults.scope,
      ...options?.scope,
      categoryIds: options?.scope?.categoryIds ?? defaults.scope.categoryIds,
    },
    structure: {
      ...defaults.structure,
      ...options?.structure,
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
      formulaInlineStyle: options?.markdown?.formulaInlineStyle ?? defaults.markdown.formulaInlineStyle,
      formulaInlineWrapperOpen:
        options?.markdown?.formulaInlineWrapperOpen ?? defaults.markdown.formulaInlineWrapperOpen,
      formulaInlineWrapperClose:
        options?.markdown?.formulaInlineWrapperClose ?? defaults.markdown.formulaInlineWrapperClose,
      formulaBlockStyle: options?.markdown?.formulaBlockStyle ?? defaults.markdown.formulaBlockStyle,
      formulaBlockWrapperOpen:
        options?.markdown?.formulaBlockWrapperOpen ?? defaults.markdown.formulaBlockWrapperOpen,
      formulaBlockWrapperClose:
        options?.markdown?.formulaBlockWrapperClose ?? defaults.markdown.formulaBlockWrapperClose,
      tableStyle: options?.markdown?.tableStyle ?? defaults.markdown.tableStyle,
      imageStyle: options?.markdown?.imageStyle ?? defaults.markdown.imageStyle,
      imageGroupStyle: options?.markdown?.imageGroupStyle ?? defaults.markdown.imageGroupStyle,
      rawHtmlPolicy: options?.markdown?.rawHtmlPolicy ?? defaults.markdown.rawHtmlPolicy,
      dividerStyle: options?.markdown?.dividerStyle ?? defaults.markdown.dividerStyle,
      codeFenceStyle: options?.markdown?.codeFenceStyle ?? defaults.markdown.codeFenceStyle,
      headingLevelOffset:
        options?.markdown?.headingLevelOffset ?? defaults.markdown.headingLevelOffset,
    },
    assets: {
      imageHandlingMode:
        options?.assets?.imageHandlingMode ?? defaults.assets.imageHandlingMode,
      compressionEnabled:
        options?.assets?.compressionEnabled ?? defaults.assets.compressionEnabled,
      imageContentMode: options?.assets?.imageContentMode ?? defaults.assets.imageContentMode,
      stickerAssetMode: options?.assets?.stickerAssetMode ?? defaults.assets.stickerAssetMode,
      downloadImages: options?.assets?.downloadImages ?? defaults.assets.downloadImages,
      downloadThumbnails:
        options?.assets?.downloadThumbnails ?? defaults.assets.downloadThumbnails,
      includeImageCaptions:
        options?.assets?.includeImageCaptions ?? defaults.assets.includeImageCaptions,
      thumbnailSource: options?.assets?.thumbnailSource ?? defaults.assets.thumbnailSource,
    },
  } satisfies ExportOptions

  clonedOptions.assets = coerceAssetOptions(clonedOptions.assets)

  const frontmatterErrors = validateFrontmatterAliases(clonedOptions.frontmatter)

  if (frontmatterErrors.length > 0) {
    throw new Error(frontmatterErrors.join(" "))
  }

  return clonedOptions
}
