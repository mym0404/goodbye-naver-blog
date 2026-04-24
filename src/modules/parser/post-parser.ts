import { load } from "cheerio"

import type { EditorVersion, ExportOptions } from "../../shared/types.js"
import { unique } from "../../shared/utils.js"
import { withParsedPostBody } from "./blocks/body-node-utils.js"
import { NaverBlogSE2Editor } from "./editors/naver-blog-se2-editor.js"
import { NaverBlogSE3Editor } from "./editors/naver-blog-se3-editor.js"
import { NaverBlogSE4Editor } from "./editors/naver-blog-se4-editor.js"

const editorVersionPattern = /smartEditorVersion["']?\s*:\s*["']?(\d+)["']?/i

const extractTags = (html: string) => {
  const $ = load(html)

  const tags = $(".post_tag a, .tag_area a, a[href*='PostTag']")
    .toArray()
    .map((node) => $(node).text().trim())
    .filter(Boolean)

  return unique(tags)
}

export const detectEditorVersionFromHtml = (html: string): EditorVersion => {
  const versionMatch = html.replaceAll("&#034;", "\"").match(editorVersionPattern)

  if (versionMatch?.[1] === "2") {
    return 2
  }

  if (versionMatch?.[1] === "3") {
    return 3
  }

  if (versionMatch?.[1] === "4") {
    return 4
  }

  if (html.includes('class="se-component')) {
    return 4
  }

  if (html.includes('class="se_component')) {
    return 3
  }

  return 2
}

export const parsePostHtml = ({
  html,
  sourceUrl,
  options,
}: {
  html: string
  sourceUrl: string
  options: Pick<ExportOptions, "markdown"> & {
    resolveLinkUrl?: (url: string) => string
  }
}) => {
  const editorVersion = detectEditorVersionFromHtml(html)
  const tags = extractTags(html)
  const $ = load(html)

  if (editorVersion === 4) {
    return withParsedPostBody(
      new NaverBlogSE4Editor().parse({
        $,
        sourceUrl,
        tags,
        options,
      }),
    )
  }

  if (editorVersion === 3) {
    return withParsedPostBody(
      new NaverBlogSE3Editor().parse({
        $,
        tags,
        options,
      }),
    )
  }

  return withParsedPostBody(
    new NaverBlogSE2Editor().parse({
      $,
      tags,
      options,
    }),
  )
}
