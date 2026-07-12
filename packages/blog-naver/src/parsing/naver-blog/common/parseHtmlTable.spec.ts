import { load } from "cheerio"
import { expect, it } from "vitest"

import { parseHtmlTable } from "./parseHtmlTable.js"

it("rewrites links in both Markdown cells and complex HTML", () => {
  const $ = load(
    '<table><tr><td rowspan="2"><a href="/post/1">Post</a></td></tr><tr><td>Body</td></tr></table>',
  )
  const parsed = parseHtmlTable({
    $,
    table: $("table"),
    resolveLinkUrl: (url) => `https://example.com${url}`,
  })

  expect(parsed.rows[0]?.[0]?.text).toBe("[Post](https://example.com/post/1)")
  expect(parsed.html).toContain('href="https://example.com/post/1"')
  expect(parsed.complex).toBe(true)
})
