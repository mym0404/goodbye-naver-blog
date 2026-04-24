import type { CheerioAPI } from "cheerio"

import type { ExportOptions, ParsedPost } from "../../../shared/types.js"

export type BaseEditorParseInput = {
  $: CheerioAPI
  sourceUrl?: string
  tags: string[]
  options: Pick<ExportOptions, "markdown"> &
    Partial<Pick<ExportOptions, "unsupportedBlockCases">> & {
      resolveLinkUrl?: (url: string) => string
    }
}

export abstract class BaseEditor<TInput extends BaseEditorParseInput = BaseEditorParseInput> {
  abstract parse(input: TInput): ParsedPost
}
