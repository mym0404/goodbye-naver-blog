import type { CheerioAPI } from "cheerio"

import type { ExportOptions, ParsedPost } from "../../../shared/types.js"
import type { ParserBlock } from "../blocks/parser-node.js"

export type BaseEditorParseInput = {
  $: CheerioAPI
  sourceUrl?: string
  tags: string[]
  options: Pick<ExportOptions, "markdown"> &
    {
      resolveLinkUrl?: (url: string) => string
    }
}

export abstract class BaseEditor<TInput extends BaseEditorParseInput = BaseEditorParseInput> {
  protected readonly supportedBlocks: readonly ParserBlock[] = []

  abstract parse(input: TInput): ParsedPost
}
