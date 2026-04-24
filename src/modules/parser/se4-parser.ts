import type { ParseSe4PostInput } from "./editors/naver-blog-se4-editor.js"
import { NaverBlogSE4Editor } from "./editors/naver-blog-se4-editor.js"

export const parseSe4Post = (input: ParseSe4PostInput) => new NaverBlogSE4Editor().parse(input)
