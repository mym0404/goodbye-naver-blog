import type { TemplatePropDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"

import {
  getTemplatePropItems,
  getTemplatePropProperties,
  resolveTemplatePropPath,
} from "./TemplatePropDefinitions.js"

type TemplatePropCompletionContext = {
  explicit: boolean
  pos: number
  state: {
    doc: {
      sliceString: (from: number, to: number) => string
    }
  }
}

type TemplatePropCompletion = {
  label: string
  type: string
  detail: string
}

const propKeyPattern = /^[A-Za-z_][A-Za-z0-9_]*$/
const memberExpressionPattern =
  /([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.([A-Za-z_][A-Za-z0-9_]*)?$/
const mapCallbackPattern =
  /\b([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\.map\(\s*\(?\s*([A-Za-z_][A-Za-z0-9_]*)\s*\)?\s*=>/g

const findTemplateVariableStart = ({ source, cursor }: { source: string; cursor: number }) => {
  const openIndex = source.lastIndexOf("{{", cursor)

  if (openIndex === -1) {
    return undefined
  }

  if (source.slice(openIndex + 2, cursor).includes("}}")) {
    return undefined
  }

  const expressionStart = openIndex + 2
  const prefixStart = source.slice(expressionStart, cursor).search(/\S/)

  return prefixStart === -1 ? cursor : expressionStart + prefixStart
}

export const createTemplatePropCompletionSource = (
  props: Record<string, TemplatePropDefinition>,
) => {
  const createOptions = (definitions: Record<string, TemplatePropDefinition>) =>
    Object.entries(definitions).map(([key, prop]) => ({
      label: key,
      type: "variable",
      detail: `${prop.label} · ${prop.type}`,
    })) satisfies TemplatePropCompletion[]

  return (context: TemplatePropCompletionContext) => {
    const source = context.state.doc.sliceString(0, context.pos)
    const expressionStart = findTemplateVariableStart({
      source,
      cursor: context.pos,
    })

    if (expressionStart === undefined) {
      return null
    }

    const expression = source.slice(expressionStart, context.pos)
    const bindings = new Map<string, TemplatePropDefinition>()

    for (const match of expression.matchAll(mapCallbackPattern)) {
      const collection = resolveTemplatePropPath({
        path: match[1] ?? "",
        props,
        bindings,
      })
      const items = collection && getTemplatePropItems(collection)

      if (items && match[2]) {
        bindings.set(match[2], items)
      }
    }

    const memberMatch = expression.match(memberExpressionPattern)
    const owner = memberMatch
      ? resolveTemplatePropPath({ path: memberMatch[1] ?? "", props, bindings })
      : undefined
    const memberProperties = owner && getTemplatePropProperties(owner)
    const prefix = memberProperties ? (memberMatch?.[2] ?? "") : expression
    const definitions = memberProperties ?? props

    if (prefix && !propKeyPattern.test(prefix)) {
      return null
    }

    const options = createOptions(definitions)
    const matchingOptions = options.filter((option) => option.label.startsWith(prefix))

    if (!context.explicit && matchingOptions.length === 0) {
      return null
    }

    return {
      from: context.pos - prefix.length,
      to: context.pos,
      options: matchingOptions,
      validFor: propKeyPattern,
    }
  }
}
