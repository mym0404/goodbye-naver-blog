import type { ExportOptions } from "../../export-options/schema/ExportOptions.js"

// Options passed into parser blocks while converting post HTML.
export type ParserBlockOptions = {
  blockOutputs: ExportOptions["blockOutputs"]
  assets?: ExportOptions["assets"]
  resolveLinkUrl?: (url: string) => string
}
