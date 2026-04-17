import type { ParserCapability } from "./types.js"

export const parserCapabilities: ParserCapability[] = [
  {
    blockType: "paragraph",
    supportedEditors: [2, 3, 4],
    fallbackPolicy: "best-effort",
    sampleIds: ["se2-legacy", "se3-legacy", "se4-formula-code-linkcard"],
  },
  {
    blockType: "heading",
    supportedEditors: [2, 4],
    fallbackPolicy: "markdown-paragraph",
    sampleIds: ["se4-heading-itinerary"],
  },
  {
    blockType: "quote",
    supportedEditors: [2, 3, 4],
    fallbackPolicy: "markdown-paragraph",
    sampleIds: ["se4-quote-formula-code"],
  },
  {
    blockType: "divider",
    supportedEditors: [2, 4],
    fallbackPolicy: "structured",
    sampleIds: ["se4-formula-code-linkcard", "se4-image-group"],
  },
  {
    blockType: "code",
    supportedEditors: [2, 3, 4],
    fallbackPolicy: "markdown-paragraph",
    sampleIds: ["se4-formula-code-linkcard", "se4-quote-formula-code"],
  },
  {
    blockType: "formula",
    supportedEditors: [4],
    fallbackPolicy: "skip",
    sampleIds: ["se4-formula-code-linkcard", "se4-quote-formula-code"],
  },
  {
    blockType: "image",
    supportedEditors: [2, 3, 4],
    fallbackPolicy: "markdown-paragraph",
    sampleIds: ["se4-video-table", "se4-image-legacy-link", "se4-quote-formula-code"],
  },
  {
    blockType: "imageGroup",
    supportedEditors: [2, 3, 4],
    fallbackPolicy: "markdown-paragraph",
    sampleIds: ["se4-image-group", "se2-thumburl-image-group"],
  },
  {
    blockType: "video",
    supportedEditors: [4],
    fallbackPolicy: "skip",
    sampleIds: ["se4-video-table"],
  },
  {
    blockType: "linkCard",
    supportedEditors: [4],
    fallbackPolicy: "markdown-paragraph",
    sampleIds: ["se4-formula-code-linkcard", "se4-quote-formula-code"],
  },
  {
    blockType: "table",
    supportedEditors: [2, 3, 4],
    fallbackPolicy: "raw-html",
    sampleIds: ["se4-video-table"],
  },
  {
    blockType: "rawHtml",
    supportedEditors: [2, 4],
    fallbackPolicy: "raw-html",
    sampleIds: [],
  },
]
