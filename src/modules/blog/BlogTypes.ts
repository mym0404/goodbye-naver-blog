export type BlogId = "naver"

export type NaverEditorKey = "se2" | "se3" | "se4"

export type BlogEditorId = `${BlogId}.${NaverEditorKey}`

export type ParserBlockId = `${BlogEditorId}.${string}`

export type BlogDefinition = {
  id: BlogId
  editors: BlogEditorId[]
}

export type BlogEditorDefinition = {
  id: BlogEditorId
  blogId: BlogId
  supportedBlocks: ParserBlockId[]
}
