import { load } from "cheerio"

import type { ExportOptions } from "../../shared/Types.js"
import { unique } from "../../shared/Utils.js"
import { NaverBlog } from "../blog/NaverBlog.js"

const extractTags = (html: string) => {
  const $ = load(html)

  const tags = $(".post_tag a, .tag_area a, a[href*='PostTag']")
    .toArray()
    .map((node) => $(node).text().trim())
    .filter(Boolean)

  return unique(tags)
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
  const tags = extractTags(html)
  const $ = load(html)

  return new NaverBlog().parsePost({
    $,
    html,
    sourceUrl,
    tags,
    options,
  })
}
