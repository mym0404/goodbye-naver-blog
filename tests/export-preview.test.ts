import { describe, expect, it } from "vitest"

import { buildExportPreview } from "../src/modules/exporter/export-preview.js"
import { defaultExportOptions } from "../src/shared/export-options.js"
import type { ScanResult } from "../src/shared/types.js"

describe("buildExportPreview", () => {
  it("renders a selected candidate post without leaving literal html in markdown", async () => {
    const options = defaultExportOptions()

    options.scope.categoryIds = [10]
    options.markdown.tableStyle = "html-only"
    options.markdown.imageGroupStyle = "html"
    options.markdown.rawHtmlPolicy = "omit"

    const preview = await buildExportPreview({
      blogIdOrUrl: "mym0404",
      outputDir: "/tmp/output",
      options,
      createFetcher: async () => ({
        scanBlog: async () =>
          ({
            blogId: "mym0404",
            totalPostCount: 2,
            categories: [
              {
                id: 10,
                name: "NestJS",
                parentId: null,
                postCount: 2,
                isDivider: false,
                isOpen: true,
                path: ["NestJS"],
                depth: 0,
              },
            ],
          }) satisfies ScanResult,
        getAllPosts: async () => [
          {
            blogId: "mym0404",
            logNo: "1",
            title: "첫 번째 글",
            publishedAt: "2024-03-04T13:00:00+09:00",
            categoryId: 10,
            categoryName: "NestJS",
            source: "https://blog.naver.com/mym0404/1",
            editorVersion: 4,
            thumbnailUrl: null,
          },
        ],
        fetchPostHtml: async () => `
          <html>
            <body>
              <div id="viewTypeSelector">
                <p>본문입니다.</p>
                <p><a href="https://example.com/article">External article</a></p>
                <table>
                  <tr><th>col</th></tr>
                  <tr><td>value</td></tr>
                </table>
              </div>
            </body>
          </html>
        `,
      }),
    })

    expect(preview.candidatePost.title).toBe("첫 번째 글")
    expect(preview.markdownFilePath).toBe("/tmp/output/posts/NestJS/2024-03-04-첫-번째-글.md")
    expect(preview.markdown).toContain("본문입니다.")
    expect(preview.markdown).toContain("External article")
    expect(preview.markdown).toContain("col")
    expect(preview.markdown).toContain("value")
    expect(preview.markdown).not.toContain("<table")
    expect(preview.markdown).not.toContain("<div")
    expect(preview.markdown).not.toContain("<img")
    expect(preview.markdown).not.toContain("<figure")
  })
})
