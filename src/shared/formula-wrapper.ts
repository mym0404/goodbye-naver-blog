import type { BlockOutputParamValue } from "./types.js"

const FORMULA_WRAPPER_SEPARATOR = "..."
const FORMULA_WRAPPER_ALT_SEPARATOR = "…"

const hasOwn = (params: Record<string, BlockOutputParamValue> | undefined, key: string) =>
  Boolean(params) && Object.prototype.hasOwnProperty.call(params, key)

const toStringValue = (value: BlockOutputParamValue | undefined, fallback: string) => {
  if (typeof value === "string") {
    return value
  }

  return fallback
}

export const composeFormulaWrapper = ({
  open,
  close,
}: {
  open: string
  close: string
}) => (open === close ? open : `${open}${FORMULA_WRAPPER_SEPARATOR}${close}`)

export const splitFormulaWrapper = ({
  wrapper,
  fallbackOpen,
  fallbackClose,
}: {
  wrapper: string
  fallbackOpen: string
  fallbackClose: string
}) => {
  if (!wrapper) {
    return {
      open: fallbackOpen,
      close: fallbackClose,
    }
  }

  const separator = wrapper.includes(FORMULA_WRAPPER_SEPARATOR)
    ? FORMULA_WRAPPER_SEPARATOR
    : wrapper.includes(FORMULA_WRAPPER_ALT_SEPARATOR)
      ? FORMULA_WRAPPER_ALT_SEPARATOR
      : null

  if (!separator) {
    return {
      open: wrapper,
      close: wrapper,
    }
  }

  const [open, ...rest] = wrapper.split(separator)
  const close = rest.join(separator)

  return {
    open,
    close,
  }
}

export const normalizeFormulaWrapperParams = ({
  params,
  fallbackInlineWrapper = "$",
  fallbackBlockWrapper = "$$",
}: {
  params?: Record<string, BlockOutputParamValue>
  fallbackInlineWrapper?: string
  fallbackBlockWrapper?: string
}) => {
  const fallbackInline = splitFormulaWrapper({
    wrapper: fallbackInlineWrapper,
    fallbackOpen: "$",
    fallbackClose: "$",
  })
  const fallbackBlock = splitFormulaWrapper({
    wrapper: fallbackBlockWrapper,
    fallbackOpen: "$$",
    fallbackClose: "$$",
  })

  const inline = hasOwn(params, "inlineWrapper")
    ? splitFormulaWrapper({
        wrapper: toStringValue(params?.inlineWrapper, fallbackInlineWrapper),
        fallbackOpen: fallbackInline.open,
        fallbackClose: fallbackInline.close,
      })
    : {
        open: hasOwn(params, "inlineOpen")
          ? toStringValue(params?.inlineOpen, fallbackInline.open)
          : fallbackInline.open,
        close: hasOwn(params, "inlineClose")
          ? toStringValue(params?.inlineClose, fallbackInline.close)
          : fallbackInline.close,
      }

  const block = hasOwn(params, "blockWrapper")
    ? splitFormulaWrapper({
        wrapper: toStringValue(params?.blockWrapper, fallbackBlockWrapper),
        fallbackOpen: fallbackBlock.open,
        fallbackClose: fallbackBlock.close,
      })
    : {
        open: hasOwn(params, "blockOpen")
          ? toStringValue(params?.blockOpen, fallbackBlock.open)
          : fallbackBlock.open,
        close: hasOwn(params, "blockClose")
          ? toStringValue(params?.blockClose, fallbackBlock.close)
          : fallbackBlock.close,
      }

  return {
    inlineWrapper: composeFormulaWrapper(inline),
    blockWrapper: composeFormulaWrapper(block),
  }
}
