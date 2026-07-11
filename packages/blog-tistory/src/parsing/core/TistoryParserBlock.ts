import type { ParsedBlock } from "@exitpress/domain/parser/schema/ParsedPost.js"
import type { ParserBlockOptions } from "@exitpress/domain/parser/schema/ParserBlockOptions.js"
import type { TemplatePropType } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"
import type { Cheerio, CheerioAPI } from "cheerio"
import type { AnyNode } from "domhandler"

export type TistoryParserBlockContext = {
  $: CheerioAPI
  $node: Cheerio<AnyNode>
  node: AnyNode
  path: string
  options: ParserBlockOptions
  parseChildren: (node: AnyNode, path: string) => ParsedBlock[]
}

export type TistoryParserBlockTemplateDefinition = {
  readonly label: string
  readonly presets: readonly {
    readonly id: string
    readonly label: string
    readonly template: string
  }[]
  readonly props: Readonly<
    Record<string, { readonly label: string; readonly type: TemplatePropType }>
  >
}

export abstract class TistoryParserBlock {
  abstract readonly id: string
  abstract readonly label: string
  abstract readonly templateDefinition: TistoryParserBlockTemplateDefinition

  abstract match(context: TistoryParserBlockContext): boolean
  abstract convert(context: TistoryParserBlockContext): ParsedBlock[]
}
