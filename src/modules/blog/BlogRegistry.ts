import type { BlogDefinition, BlogEditorDefinition, BlogEditorId } from "./BlogTypes.js"

export const blogEditors = [
  {
    id: "naver.se2",
    blogId: "naver",
    supportedBlocks: [
      "naver.se2.textNode",
      "naver.se2.bookWidget",
      "naver.se2.container",
      "naver.se2.table",
      "naver.se2.divider",
      "naver.se2.lineBreak",
      "naver.se2.quote",
      "naver.se2.heading",
      "naver.se2.code",
      "naver.se2.inlineGifVideoFallback",
      "naver.se2.image",
      "naver.se2.spacer",
      "naver.se2.textElement",
      "naver.se2.fallback",
    ],
  },
  {
    id: "naver.se3",
    blogId: "naver",
    supportedBlocks: [
      "naver.se3.documentTitle",
      "naver.se3.table",
      "naver.se3.quote",
      "naver.se3.code",
      "naver.se3.image",
      "naver.se3.representativeUnsupported",
      "naver.se3.text",
      "naver.se3.fallback",
    ],
  },
  {
    id: "naver.se4",
    blogId: "naver",
    supportedBlocks: [
      "naver.se4.documentTitle",
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
      "naver.se4.fallback",
    ],
  },
] as const satisfies BlogEditorDefinition[]

export const blogs = [
  {
    id: "naver",
    editors: blogEditors.map((editor) => editor.id),
  },
] as const satisfies BlogDefinition[]

const blogEditorMap = new Map(blogEditors.map((editor) => [editor.id, editor]))

export const getBlogEditorDefinition = (editorId: BlogEditorId) => blogEditorMap.get(editorId)
