import type { ParseSe3PostInput } from "./editors/naver-blog-se3-editor.js"
import { NaverBlogSE3Editor } from "./editors/naver-blog-se3-editor.js"

export const parseSe3Post = (input: ParseSe3PostInput) => new NaverBlogSE3Editor().parse(input)
