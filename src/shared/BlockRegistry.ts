import type {
  AstBlock,
  BlockOutputSelection,
  BlockOutputSelectionByType,
  BlockType,
} from "./Types.js"
import type { BlogEditorId, ParserBlockId } from "../modules/blog/BlogTypes.js"
import { blogEditors } from "../modules/blog/BlogRegistry.js"
import { normalizeFormulaWrapperParams } from "./FormulaWrapper.js"

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
  parserBlockId: ParserBlockId
  editorId: BlogEditorId
  astBlockType: BlockType
  label: string
  description: string
  previewBlock: AstBlock
  variants: BlockOutputVariantDefinition[]
  params?: BlockOutputParamDefinition[]
}

const previewImage = {
  sourceUrl: "https://example.com/image.png",
  originalSourceUrl: "https://example.com/image.png",
  alt: "diagram",
  caption: "caption",
  mediaKind: "image",
} as const

const outputParserBlockIds = new Set<ParserBlockId>([
  "naver.se2.textNode",
  "naver.se2.bookWidget",
  "naver.se2.table",
  "naver.se2.divider",
  "naver.se2.quote",
  "naver.se2.heading",
  "naver.se2.code",
  "naver.se2.image",
  "naver.se2.textElement",
  "naver.se3.table",
  "naver.se3.quote",
  "naver.se3.code",
  "naver.se3.image",
  "naver.se3.text",
  "naver.se4.formula",
  "naver.se4.code",
  "naver.se4.linkCard",
  "naver.se4.video",
  "naver.se4.oembed",
  "naver.se4.map",
  "naver.se4.table",
  "naver.se4.imageStrip",
  "naver.se4.imageGroup",
  "naver.se4.sticker",
  "naver.se4.image",
  "naver.se4.heading",
  "naver.se4.divider",
  "naver.se4.quote",
  "naver.se4.text",
  "naver.se4.material",
])

const parserBlockAstTypeMap: Partial<Record<ParserBlockId, BlockType>> = {
  "naver.se2.textNode": "paragraph",
  "naver.se2.bookWidget": "paragraph",
  "naver.se2.table": "table",
  "naver.se2.divider": "divider",
  "naver.se2.quote": "quote",
  "naver.se2.heading": "heading",
  "naver.se2.code": "code",
  "naver.se2.image": "image",
  "naver.se2.textElement": "paragraph",
  "naver.se3.table": "table",
  "naver.se3.quote": "quote",
  "naver.se3.code": "code",
  "naver.se3.image": "image",
  "naver.se3.text": "paragraph",
  "naver.se4.formula": "formula",
  "naver.se4.code": "code",
  "naver.se4.linkCard": "linkCard",
  "naver.se4.video": "video",
  "naver.se4.oembed": "linkCard",
  "naver.se4.map": "linkCard",
  "naver.se4.table": "table",
  "naver.se4.imageStrip": "imageGroup",
  "naver.se4.imageGroup": "imageGroup",
  "naver.se4.sticker": "image",
  "naver.se4.image": "image",
  "naver.se4.heading": "heading",
  "naver.se4.divider": "divider",
  "naver.se4.quote": "quote",
  "naver.se4.text": "paragraph",
  "naver.se4.material": "paragraph",
}

export const blockOutputFamilyOrder: ParserBlockId[] = blogEditors.flatMap((editor) =>
  editor.supportedBlocks.filter((parserBlockId) => outputParserBlockIds.has(parserBlockId)),
)

export const defaultBlockOutputSelections: {
  [Key in BlockType]: BlockOutputSelection<Key>
} = {
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
}

type BaseBlockOutputFamilyDefinition = Omit<BlockOutputFamilyDefinition, "parserBlockId" | "editorId" | "astBlockType"> & {
  astBlockType: BlockType
}

const baseBlockOutputFamilyDefinitions: BaseBlockOutputFamilyDefinition[] = [
  {
    astBlockType: "paragraph",
    label: "문단",
    description: "문단 텍스트를 Markdown 본문 줄로 출력합니다.",
    previewBlock: {
      type: "paragraph",
      text: "첫 줄입니다.\n\n둘째 문단입니다.",
    },
    variants: [{ id: "markdown-paragraph", label: "Markdown 문단", description: "정규화된 문단 텍스트를 그대로 출력합니다." }],
  },
  {
    astBlockType: "heading",
    label: "제목",
    description: "제목 레벨과 텍스트를 Markdown heading으로 출력합니다.",
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
    astBlockType: "quote",
    label: "인용문",
    description: "인용문을 `>` prefix로 출력합니다.",
    previewBlock: {
      type: "quote",
      text: "Quoted line\nsecond line",
    },
    variants: [{ id: "blockquote", label: "blockquote", description: "모든 줄 앞에 `>`를 붙입니다." }],
  },
  {
    astBlockType: "divider",
    label: "구분선",
    description: "본문 구분선을 Markdown horizontal rule로 출력합니다.",
    previewBlock: {
      type: "divider",
    },
    variants: [
      { id: "dash-rule", label: "`---`", description: "dash 구분선으로 출력합니다." },
      { id: "asterisk-rule", label: "`***`", description: "asterisk 구분선으로 출력합니다." },
    ],
  },
  {
    astBlockType: "code",
    label: "코드",
    description: "코드를 fenced code block으로 출력합니다.",
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
    astBlockType: "formula",
    label: "수식",
    description: "인라인/블록 수식을 wrapper 또는 math fence로 출력합니다.",
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
    astBlockType: "image",
    label: "이미지",
    description: "이미지를 Markdown 이미지, 링크 감싼 이미지, 링크만 남기기 중 하나로 출력합니다.",
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
    astBlockType: "imageGroup",
    label: "이미지 묶음",
    description: "이미지 묶음을 개별 이미지 블록으로 출력합니다.",
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
    astBlockType: "video",
    label: "비디오",
    description: "비디오를 원문 링크로 출력합니다.",
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
    astBlockType: "linkCard",
    label: "링크 카드",
    description: "링크 카드 제목을 Markdown 링크로 출력합니다.",
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
    astBlockType: "table",
    label: "표",
    description: "표를 GFM 우선 또는 HTML 유지로 출력합니다.",
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
]

const baseBlockOutputFamilyDefinitionMap = new Map(
  baseBlockOutputFamilyDefinitions.map((definition) => [definition.astBlockType, definition]),
)

export const blockOutputFamilyDefinitions: BlockOutputFamilyDefinition[] = blockOutputFamilyOrder.flatMap((parserBlockId) => {
  const astBlockType = parserBlockAstTypeMap[parserBlockId]
  const editorId = parserBlockId.split(".").slice(0, 2).join(".") as BlogEditorId
  if (!astBlockType) {
    return []
  }

  const baseDefinition = baseBlockOutputFamilyDefinitionMap.get(astBlockType)

  return baseDefinition
    ? [
        {
          ...baseDefinition,
          parserBlockId,
          editorId,
          astBlockType,
        },
      ]
    : []
})

const blockOutputFamilyDefinitionMap = new Map(
  blockOutputFamilyDefinitions.map((definition) => [definition.parserBlockId, definition]),
)

const astBlockTypeDefaultParserBlockIdMap = new Map(
  blockOutputFamilyDefinitions.map((definition) => [definition.astBlockType, definition.parserBlockId]),
)

export const getBlockOutputFamilyDefinition = (parserBlockId: ParserBlockId) =>
  blockOutputFamilyDefinitionMap.get(parserBlockId)

export const getDefaultParserBlockIdForAstBlockType = (blockType: BlockType) =>
  astBlockTypeDefaultParserBlockIdMap.get(blockType)

const mergeBlockOutputSelection = ({
  baseSelection,
  nextSelection,
}: {
  baseSelection: BlockOutputSelection
  nextSelection?: BlockOutputSelection
}) => {
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
  baseSelection: BlockOutputSelection<"formula">
  nextSelection?: BlockOutputSelection<"formula">
}) => {
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

export const resolveBlockOutputSelection = <Block extends BlockType>({
  blockType,
  parserBlockId,
  blockOutputs,
}: {
  blockType: Block
  parserBlockId?: ParserBlockId
  blockOutputs?: {
    defaults?: Partial<Record<ParserBlockId, BlockOutputSelection>>
  }
}): BlockOutputSelectionByType[Block] => {
  const selectionParserBlockId = parserBlockId ?? getDefaultParserBlockIdForAstBlockType(blockType)

  if (blockType === "formula") {
    const baseSelection = mergeFormulaBlockOutputSelection({
      baseSelection: defaultBlockOutputSelections.formula,
      nextSelection: selectionParserBlockId
        ? (blockOutputs?.defaults?.[selectionParserBlockId] as BlockOutputSelection<"formula"> | undefined)
        : undefined,
    })

    return baseSelection as BlockOutputSelectionByType[Block]
  }

  const baseSelection = mergeBlockOutputSelection({
    baseSelection: defaultBlockOutputSelections[blockType],
    nextSelection: selectionParserBlockId
      ? (blockOutputs?.defaults?.[selectionParserBlockId] as BlockOutputSelection<Block> | undefined)
      : undefined,
  })

  return baseSelection as BlockOutputSelectionByType[Block]
}
