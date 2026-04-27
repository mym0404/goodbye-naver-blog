import { load } from "cheerio"

import type { ExportOptions } from "../../shared/Types.js"
import type { BlogEditorId, NaverEditorKey } from "../blog/BlogTypes.js"
import { unique } from "../../shared/Utils.js"
import { withParsedPostBody } from "./blocks/BodyNodeUtils.js"
import { NaverBlogSE2Editor } from "./editors/NaverBlogSe2Editor.js"
import { NaverBlogSE3Editor } from "./editors/NaverBlogSe3Editor.js"
import { NaverBlogSE4Editor } from "./editors/NaverBlogSe4Editor.js"

const editorVersionPattern = /smartEditorVersion["']?\s*:\s*["']?(\d+)["']?/i

const extractTags = (html: string) => {
  const $ = load(html)

  const tags = $(".post_tag a, .tag_area a, a[href*='PostTag']")
    .toArray()
    .map((node) => $(node).text().trim())
    .filter(Boolean)

  return unique(tags)
}

export const detectNaverEditorKeyFromHtml = (html: string): NaverEditorKey => {
  const versionMatch = html.replaceAll("&#034;", "\"").match(editorVersionPattern)

  if (versionMatch?.[1] === "2") {
    return "se2"
  }

  if (versionMatch?.[1] === "3") {
    return "se3"
  }

  if (versionMatch?.[1] === "4") {
    return "se4"
  }

  if (html.includes('class="se-component')) {
    return "se4"
  }

  if (html.includes('class="se_component')) {
    return "se3"
  }

  return "se2"
}

export const detectEditorVersionFromHtml = (html: string) =>
  Number(detectNaverEditorKeyFromHtml(html).replace("se", ""))

const getNaverEditorId = (editorKey: NaverEditorKey): BlogEditorId => `naver.${editorKey}`

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
  const editorKey = detectNaverEditorKeyFromHtml(html)
  const editorId = getNaverEditorId(editorKey)
  const tags = extractTags(html)
  const $ = load(html)

  if (editorId === "naver.se4") {
    return withParsedPostBody(
      new NaverBlogSE4Editor().parse({
        $,
        sourceUrl,
        tags,
        options,
      }),
    )
  }

  if (editorId === "naver.se3") {
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
