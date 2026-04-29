import type {
  BlockOutputSelection,
  BlockOutputSelectionByType,
  BlockType,
  ExportOptions,
  OutputOption,
} from "./Types.js"

const fallbackBlockOutputSelections: {
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

const getDefaultOutputOption = (outputOptions: readonly OutputOption[]) =>
  outputOptions.find((option) => option.isDefault) ?? outputOptions[0]

const createSelectionFromOutputOption = (option: OutputOption): BlockOutputSelection => {
  const params = Object.fromEntries(
    (option.params ?? [])
      .filter((param) => param.defaultValue !== undefined)
      .map((param) => [param.key, param.defaultValue]),
  )

  return {
    variant: option.id,
    ...(Object.keys(params).length > 0 ? { params } : {}),
  } as BlockOutputSelection
}

export const resolveBlockOutputSelection = <Block extends BlockType>({
  blockType,
  outputOptions,
  blockOutputs,
  selectionKey,
}: {
  blockType: Block
  outputOptions?: readonly OutputOption[]
  blockOutputs?: {
    defaults?: ExportOptions["blockOutputs"]["defaults"]
  }
  selectionKey?: string
}): BlockOutputSelectionByType[Block] => {
  const nextSelection = selectionKey
    ? blockOutputs?.defaults?.[selectionKey] as BlockOutputSelection<Block> | undefined
    : undefined

  const defaultOption = outputOptions ? getDefaultOutputOption(outputOptions) : undefined
  const baseSelection = defaultOption
    ? createSelectionFromOutputOption(defaultOption)
    : fallbackBlockOutputSelections[blockType]

  const selection = mergeBlockOutputSelection({
    baseSelection,
    nextSelection,
  })

  return selection as BlockOutputSelectionByType[Block]
}
