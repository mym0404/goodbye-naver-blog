import type { ParseSe2PostInput } from "./editors/naver-blog-se2-editor.js"
import { NaverBlogSE2Editor } from "./editors/naver-blog-se2-editor.js"

export const parseSe2Post = (input: ParseSe2PostInput) => new NaverBlogSE2Editor().parse(input)
