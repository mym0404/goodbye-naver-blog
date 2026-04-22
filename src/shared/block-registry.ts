import type {
  AstBlock,
  BlockOutputSelection,
  BlockType,
  EditorVersion,
  ParserCapability,
  ParserCapabilityId,
  ParserFallbackPolicy,
  ParserCapabilityVerificationMode,
} from "./types.js"
import { normalizeFormulaWrapperParams } from "./formula-wrapper.js"

export const getParserCapabilityId = ({
  editorVersion,
  blockType,
}: {
  editorVersion: EditorVersion
  blockType: BlockType
}): ParserCapabilityId => `se${editorVersion}-${blockType}`

type ParserCapabilityCatalogEntry = Omit<ParserCapability, "id">

const se2ParserTestFilePaths = ["tests/parser/se2-parser.test.ts"]
const se3ParserTestFilePaths = ["tests/parser/se3-parser.test.ts"]
const se4ParserTestFilePaths = ["tests/parser/se4-parser.test.ts"]

const createCapabilityEntry = ({
  editorVersion,
  blockType,
  fallbackPolicy,
  verificationMode,
  sampleIds,
  testFilePaths,
}: {
  editorVersion: EditorVersion
  blockType: BlockType
  fallbackPolicy: ParserFallbackPolicy
  verificationMode: ParserCapabilityVerificationMode
  sampleIds: string[]
  testFilePaths: string[]
}) =>
  ({
    editorVersion,
    blockType,
    fallbackPolicy,
    verificationMode,
    sampleIds,
    testFilePaths,
  }) satisfies ParserCapabilityCatalogEntry

export const parserCapabilityCatalog: ParserCapabilityCatalogEntry[] = [
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "paragraph",
    fallbackPolicy: "best-effort",
    verificationMode: "sample-fixture",
    sampleIds: ["se2-legacy", "se2-code-image-autolayout", "se2-table-rawhtml-navigation"],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 3,
    blockType: "paragraph",
    fallbackPolicy: "best-effort",
    verificationMode: "sample-fixture",
    sampleIds: ["se3-legacy", "se3-quote-imagegroup-note9", "se3-quote-table-vita"],
    testFilePaths: se3ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "paragraph",
    fallbackPolicy: "best-effort",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-formula-code-linkcard", "se4-heading-itinerary", "se4-image-group"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "heading",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "parser-fixture",
    sampleIds: [],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "heading",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-heading-itinerary"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "quote",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "parser-fixture",
    sampleIds: [],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 3,
    blockType: "quote",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se3-quote-imagegroup-note9", "se3-quote-table-vita"],
    testFilePaths: se3ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "quote",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-quote-formula-code"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "divider",
    fallbackPolicy: "structured",
    verificationMode: "parser-fixture",
    sampleIds: [],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "divider",
    fallbackPolicy: "structured",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-formula-code-linkcard", "se4-image-group", "se4-heading-itinerary"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "code",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se2-code-image-autolayout"],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 3,
    blockType: "code",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "parser-fixture",
    sampleIds: [],
    testFilePaths: se3ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "code",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-formula-code-linkcard", "se4-quote-formula-code"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "formula",
    fallbackPolicy: "skip",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-formula-code-linkcard", "se4-quote-formula-code"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "image",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se2-code-image-autolayout", "se2-table-rawhtml-navigation"],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 3,
    blockType: "image",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se3-quote-imagegroup-note9", "se3-quote-table-vita"],
    testFilePaths: se3ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "image",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-video-table", "se4-image-legacy-link", "se4-quote-formula-code", "se4-heading-itinerary"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "imageGroup",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se2-thumburl-image-group"],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 3,
    blockType: "imageGroup",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se3-quote-imagegroup-note9"],
    testFilePaths: se3ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "imageGroup",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-image-group", "se4-heading-itinerary"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "video",
    fallbackPolicy: "skip",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-video-table"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "linkCard",
    fallbackPolicy: "markdown-paragraph",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-formula-code-linkcard", "se4-quote-formula-code", "se4-heading-itinerary"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "table",
    fallbackPolicy: "raw-html",
    verificationMode: "sample-fixture",
    sampleIds: ["se2-table-rawhtml-navigation"],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 3,
    blockType: "table",
    fallbackPolicy: "raw-html",
    verificationMode: "sample-fixture",
    sampleIds: ["se3-quote-table-vita"],
    testFilePaths: se3ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "table",
    fallbackPolicy: "raw-html",
    verificationMode: "sample-fixture",
    sampleIds: ["se4-video-table", "se4-heading-itinerary"],
    testFilePaths: se4ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 2,
    blockType: "rawHtml",
    fallbackPolicy: "raw-html",
    verificationMode: "sample-fixture",
    sampleIds: ["se2-table-rawhtml-navigation"],
    testFilePaths: se2ParserTestFilePaths,
  }),
  createCapabilityEntry({
    editorVersion: 4,
    blockType: "rawHtml",
    fallbackPolicy: "raw-html",
    verificationMode: "parser-fixture",
    sampleIds: [],
    testFilePaths: se4ParserTestFilePaths,
  }),
]

type BlockOutputParamDefinition = {
  key: string
  label: string
  description: string
  input: "text" | "number"
  whenVariants?: string[]
}

type BlockOutputVariantDefinition = {
  id: string
  label: string
  description: string
}

export type BlockOutputFamilyDefinition = {
  blockType: BlockType
  label: string
  description: string
  previewCapabilityId: ParserCapabilityId
  previewBlock: AstBlock
  variants: BlockOutputVariantDefinition[]
  params?: BlockOutputParamDefinition[]
}

export type BlockOutputCapabilityOverrideDefinition = {
  blockType: BlockType
  capabilityId: ParserCapabilityId
  label: string
  description: string
  previewBlock?: AstBlock
}

const previewImage = {
  sourceUrl: "https://example.com/image.png",
  originalSourceUrl: "https://example.com/image.png",
  alt: "diagram",
  caption: "caption",
  mediaKind: "image",
} as const

export const blockOutputFamilyOrder: BlockType[] = [
  "paragraph",
  "heading",
  "quote",
  "divider",
  "code",
  "formula",
  "image",
  "imageGroup",
  "video",
  "linkCard",
  "table",
  "rawHtml",
]

export const defaultBlockOutputSelections: Record<BlockType, BlockOutputSelection> = {
  paragraph: { variant: "markdown-paragraph" },
  heading: {
    variant: "markdown-heading",
    params: {
      levelOffset: 0,
    },
  },
  quote: { variant: "blockquote" },
  divider: { variant: "dash-rule" },
  code: { variant: "backtick-fence" },
  formula: {
    variant: "wrapper",
    params: {
      inlineWrapper: "$",
      blockWrapper: "$$",
    },
  },
  image: { variant: "markdown-image" },
  imageGroup: { variant: "split-images" },
  video: { variant: "source-link" },
  linkCard: { variant: "title-link" },
  table: { variant: "gfm-or-html" },
  rawHtml: { variant: "omit" },
}

export const blockOutputFamilyDefinitions: BlockOutputFamilyDefinition[] = [
  {
    blockType: "paragraph",
    label: "문단",
    description: "문단 텍스트를 Markdown 본문 줄로 출력합니다.",
    previewCapabilityId: "se4-paragraph",
    previewBlock: {
      type: "paragraph",
      text: "첫 줄입니다.\n\n둘째 문단입니다.",
    },
    variants: [{ id: "markdown-paragraph", label: "Markdown 문단", description: "정규화된 문단 텍스트를 그대로 출력합니다." }],
  },
  {
    blockType: "heading",
    label: "제목",
    description: "제목 레벨과 텍스트를 Markdown heading으로 출력합니다.",
    previewCapabilityId: "se4-heading",
    previewBlock: {
      type: "heading",
      level: 2,
      text: "Section title",
    },
    variants: [{ id: "markdown-heading", label: "Markdown heading", description: "ATX heading(`#`) 형식으로 출력합니다." }],
    params: [
      {
        key: "levelOffset",
        label: "제목 레벨 오프셋",
        description: "원본 제목 레벨에 더하거나 빼는 값입니다.",
        input: "number",
      },
    ],
  },
  {
    blockType: "quote",
    label: "인용문",
    description: "인용문을 `>` prefix로 출력합니다.",
    previewCapabilityId: "se4-quote",
    previewBlock: {
      type: "quote",
      text: "Quoted line\nsecond line",
    },
    variants: [{ id: "blockquote", label: "blockquote", description: "모든 줄 앞에 `>`를 붙입니다." }],
  },
  {
    blockType: "divider",
    label: "구분선",
    description: "본문 구분선을 Markdown horizontal rule로 출력합니다.",
    previewCapabilityId: "se4-divider",
    previewBlock: {
      type: "divider",
    },
    variants: [
      { id: "dash-rule", label: "`---`", description: "dash 구분선으로 출력합니다." },
      { id: "asterisk-rule", label: "`***`", description: "asterisk 구분선으로 출력합니다." },
    ],
  },
  {
    blockType: "code",
    label: "코드",
    description: "코드를 fenced code block으로 출력합니다.",
    previewCapabilityId: "se4-code",
    previewBlock: {
      type: "code",
      language: "ts",
      code: "const value = 1",
    },
    variants: [
      { id: "backtick-fence", label: "``` fence", description: "backtick fence를 사용합니다." },
      { id: "tilde-fence", label: "~~~ fence", description: "tilde fence를 사용합니다." },
    ],
  },
  {
    blockType: "formula",
    label: "수식",
    description: "인라인/블록 수식을 wrapper 또는 math fence로 출력합니다.",
    previewCapabilityId: "se4-formula",
    previewBlock: {
      type: "formula",
      formula: "x^2 + y^2 = z^2",
      display: true,
    },
    variants: [
      { id: "wrapper", label: "custom wrapper", description: "인라인과 블록 수식을 wrapper 문자열로 감쌉니다." },
      { id: "math-fence", label: "```math fence", description: "블록 수식은 `math` fence, 인라인 수식은 wrapper로 출력합니다." },
    ],
    params: [
      {
        key: "inlineWrapper",
        label: "인라인 wrapper",
        description: "예: `$`, `\\(...\\)`",
        input: "text",
      },
      {
        key: "blockWrapper",
        label: "블록 wrapper",
        description: "예: `$$`, `\\[...\\]`",
        input: "text",
        whenVariants: ["wrapper"],
      },
    ],
  },
  {
    blockType: "image",
    label: "이미지",
    description: "이미지를 Markdown 이미지, 링크 감싼 이미지, 링크만 남기기 중 하나로 출력합니다.",
    previewCapabilityId: "se4-image",
    previewBlock: {
      type: "image",
      image: previewImage,
    },
    variants: [
      { id: "markdown-image", label: "일반 Markdown 이미지", description: "이미지를 `![alt](url)` 형식으로 출력합니다." },
      { id: "linked-image", label: "원본 링크 감싸기", description: "이미지를 원본 링크로 감싼 뒤 출력합니다." },
      { id: "source-only", label: "링크만 남기기", description: "이미지 대신 링크 텍스트만 남깁니다." },
    ],
  },
  {
    blockType: "imageGroup",
    label: "이미지 묶음",
    description: "이미지 묶음을 개별 이미지 블록으로 출력합니다.",
    previewCapabilityId: "se4-imageGroup",
    previewBlock: {
      type: "imageGroup",
      images: [
        previewImage,
        {
          ...previewImage,
          sourceUrl: "https://example.com/image-2.png",
          originalSourceUrl: "https://example.com/image-2.png",
          alt: "detail",
        },
      ],
    },
    variants: [{ id: "split-images", label: "개별 이미지로 분해", description: "이미지 하나씩 순서대로 출력합니다." }],
  },
  {
    blockType: "video",
    label: "비디오",
    description: "비디오를 원문 링크로 출력합니다.",
    previewCapabilityId: "se4-video",
    previewBlock: {
      type: "video",
      video: {
        title: "Demo video",
        thumbnailUrl: "https://example.com/video-thumb.png",
        sourceUrl: "https://example.com/video",
        vid: "vid",
        inkey: "inkey",
        width: 640,
        height: 360,
      },
    },
    variants: [{ id: "source-link", label: "원문 링크", description: "비디오 제목을 원문 URL 링크로 출력합니다." }],
  },
  {
    blockType: "linkCard",
    label: "링크 카드",
    description: "링크 카드 제목을 Markdown 링크로 출력합니다.",
    previewCapabilityId: "se4-linkCard",
    previewBlock: {
      type: "linkCard",
      card: {
        title: "External article",
        description: "preview text",
        url: "https://example.com/article",
        imageUrl: "https://example.com/cover.png",
      },
    },
    variants: [{ id: "title-link", label: "제목 링크", description: "카드 제목을 링크로 출력합니다." }],
  },
  {
    blockType: "table",
    label: "표",
    description: "표를 GFM 우선 또는 HTML 유지로 출력합니다.",
    previewCapabilityId: "se4-table",
    previewBlock: {
      type: "table",
      complex: false,
      html: "<table><tr><th>col</th></tr><tr><td>value</td></tr></table>",
      rows: [
        [{ text: "col", html: "col", colspan: 1, rowspan: 1, isHeader: true }],
        [{ text: "value", html: "value", colspan: 1, rowspan: 1, isHeader: false }],
      ],
    },
    variants: [
      { id: "gfm-or-html", label: "GFM 우선", description: "단순 표는 GFM, 복잡한 표는 HTML fallback으로 처리합니다." },
      { id: "html-only", label: "원본 HTML 유지", description: "표를 HTML fragment로 유지합니다." },
    ],
  },
  {
    blockType: "rawHtml",
    label: "Raw HTML",
    description: "구조화하지 못한 HTML을 생략하거나 Markdown fallback으로 출력합니다.",
    previewCapabilityId: "se2-rawHtml",
    previewBlock: {
      type: "rawHtml",
      html: "<div><strong>Legacy block</strong><br>with text</div>",
      reason: "se2:legacy-fragment",
    },
    variants: [
      { id: "omit", label: "생략 + diagnostic", description: "본문에서는 생략하고 diagnostic에만 남깁니다." },
      { id: "markdown-fallback", label: "Markdown fallback", description: "추출 가능한 텍스트를 Markdown으로 남깁니다." },
    ],
  },
]

export const blockOutputCapabilityOverrideDefinitions: BlockOutputCapabilityOverrideDefinition[] = [
  {
    blockType: "formula",
    capabilityId: "se4-formula",
    label: "SE4 수식",
    description: "ONE 수식 블록만 다른 출력 정책을 줄 때 사용합니다.",
  },
  {
    blockType: "rawHtml",
    capabilityId: "se2-rawHtml",
    label: "SE2 rawHtml",
    description: "SE2 fallback HTML 블록만 따로 처리할 때 사용합니다.",
  },
  {
    blockType: "rawHtml",
    capabilityId: "se4-rawHtml",
    label: "SE4 rawHtml",
    description: "SE4 fallback HTML 블록만 따로 처리할 때 사용합니다.",
  },
]

const blockOutputFamilyDefinitionMap = new Map(
  blockOutputFamilyDefinitions.map((definition) => [definition.blockType, definition]),
)

const blockOutputCapabilityOverrideDefinitionMap = new Map(
  blockOutputCapabilityOverrideDefinitions.map((definition) => [definition.capabilityId, definition]),
)

export const getBlockOutputFamilyDefinition = (blockType: BlockType) =>
  blockOutputFamilyDefinitionMap.get(blockType)

export const getBlockOutputCapabilityOverrideDefinition = (capabilityId: ParserCapabilityId) =>
  blockOutputCapabilityOverrideDefinitionMap.get(capabilityId)

const mergeBlockOutputSelection = ({
  baseSelection,
  nextSelection,
}: {
  baseSelection: BlockOutputSelection
  nextSelection?: BlockOutputSelection
}): BlockOutputSelection => {
  const params = {
    ...(baseSelection.params ?? {}),
    ...(nextSelection?.params ?? {}),
  }

  return {
    variant: nextSelection?.variant ?? baseSelection.variant,
    ...(Object.keys(params).length > 0 ? { params } : {}),
  }
}

const formulaParamKeys = new Set([
  "inlineWrapper",
  "blockWrapper",
  "inlineOpen",
  "inlineClose",
  "blockOpen",
  "blockClose",
])

const mergeFormulaBlockOutputSelection = ({
  baseSelection,
  nextSelection,
}: {
  baseSelection: BlockOutputSelection
  nextSelection?: BlockOutputSelection
}): BlockOutputSelection => {
  const baseParams = normalizeFormulaWrapperParams({
    params: baseSelection.params,
  })
  const nextParams = nextSelection?.params
  const normalizedFormulaParams = normalizeFormulaWrapperParams({
    params: nextParams,
    fallbackInlineWrapper: baseParams.inlineWrapper,
    fallbackBlockWrapper: baseParams.blockWrapper,
  })
  const extraParams = Object.fromEntries(
    Object.entries({
      ...(baseSelection.params ?? {}),
      ...(nextParams ?? {}),
    }).filter(([key]) => !formulaParamKeys.has(key)),
  )
  const params = {
    ...extraParams,
    ...normalizedFormulaParams,
  }

  return {
    variant: nextSelection?.variant ?? baseSelection.variant,
    ...(Object.keys(params).length > 0 ? { params } : {}),
  }
}

export const resolveBlockOutputSelection = ({
  blockType,
  capabilityId,
  blockOutputs,
}: {
  blockType: BlockType
  capabilityId?: ParserCapabilityId
  blockOutputs?: {
    defaults?: Partial<Record<BlockType, BlockOutputSelection>>
    overrides?: Partial<Record<ParserCapabilityId, BlockOutputSelection>>
  }
}) => {
  const baseSelection = blockType === "formula"
    ? mergeFormulaBlockOutputSelection({
        baseSelection: defaultBlockOutputSelections[blockType],
        nextSelection: blockOutputs?.defaults?.[blockType],
      })
    : mergeBlockOutputSelection({
        baseSelection: defaultBlockOutputSelections[blockType],
        nextSelection: blockOutputs?.defaults?.[blockType],
      })

  if (!capabilityId) {
    return baseSelection
  }

  const overrideSelection = blockOutputs?.overrides?.[capabilityId]

  if (!overrideSelection) {
    return baseSelection
  }

  return blockType === "formula"
    ? mergeFormulaBlockOutputSelection({
        baseSelection,
        nextSelection: overrideSelection,
      })
    : mergeBlockOutputSelection({
        baseSelection,
        nextSelection: overrideSelection,
      })
}
