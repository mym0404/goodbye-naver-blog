import { defaultExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { describe, expect, it } from "vitest"

import {
  createInitialManifest,
  createPostUploadSummary,
} from "../manifest/ExportManifestProgress.js"

import { getOutputAdapter } from "./OutputAdapters.js"

const createSuccessfulManifest = ({
  profile,
  outputPath,
}: {
  profile: "fumadocs" | "docusaurus" | "nextra"
  outputPath: string
}) => {
  const manifest = createInitialManifest({
    resumeManifest: null,
    blogKey: "naver",
    sourceId: "sample",
    profile,
    options: defaultExportOptions(),
    categories: [],
    totalPosts: 1,
    uploadEnabled: false,
  })
  manifest.posts.push({
    blogKey: "naver",
    sourceId: "sample",
    postId: "1",
    title: "First post",
    source: "https://example.com/1",
    category: { id: 1, name: "Guides", path: ["Guides"] },
    status: "success",
    outputPath,
    assetPaths: [],
    upload: createPostUploadSummary([]),
    error: null,
  })

  return manifest
}

describe("output adapters", () => {
  it("keeps GFM documents unchanged", () => {
    const adapter = getOutputAdapter("gfm")

    expect(adapter.renderDocument({ frontmatter: "title: Test\n", body: "Body" })).toBe(
      "---\ntitle: Test\n---\n\nBody\n",
    )
    expect(adapter.contentRootSegments).toEqual([])
    expect(adapter.documentFileName).toBe("index.md")
  })

  it("adds only imports required by the rendered Fumadocs components", () => {
    const adapter = getOutputAdapter("fumadocs")
    const document = adapter.renderDocument({
      frontmatter: "title: Test\n",
      body: '<Accordions><Accordion title="Quote">Text</Accordion></Accordions>\n<InlineTOC />',
    })

    expect(document).toBe(
      "---\ntitle: Test\n---\n\n" +
        "import { Accordion, Accordions } from 'fumadocs-ui/components/accordion';\n" +
        "import { InlineTOC } from 'fumadocs-ui/components/inline-toc';\n\n" +
        '<Accordions><Accordion title="Quote">Text</Accordion></Accordions>\n<InlineTOC />\n',
    )
    expect(document).not.toContain("components/tabs")
  })

  it("uses URL-safe ASCII paths without changing GFM segments", () => {
    expect(getOutputAdapter("gfm").formatPathSegment("검증 문서")).toBe("검증 문서")
    expect(getOutputAdapter("fumadocs").formatPathSegment("검증_문서")).toBe(
      "~EA~B2~80~EC~A6~9D_~EB~AC~B8~EC~84~9C",
    )
    expect(getOutputAdapter("fumadocs").formatPathSegment("~EA")).toBe("~7EEA")
    expect(getOutputAdapter("docusaurus").formatPathSegment("검증_문서")).toBe(
      "~EA~B2~80~EC~A6~9D_~EB~AC~B8~EC~84~9C",
    )
    expect(getOutputAdapter("nextra").formatPathSegment("검증_문서")).toBe(
      "~EA~B2~80~EC~A6~9D_~EB~AC~B8~EC~84~9C",
    )
    expect(getOutputAdapter("docusaurus").formatPathSegment("문서(test)")).toBe(
      "~EB~AC~B8~EC~84~9C~28test~29",
    )
  })

  it("escapes source MDX controls before component detection", () => {
    const adapter = getOutputAdapter("fumadocs")
    const props = adapter.prepareBlockProps({
      text: "<Tabs>{globalThis.process}</Tabs>",
      code: "const value = { safe: true }",
    })
    const document = adapter.renderDocument({ frontmatter: null, body: String(props.text) })

    expect(props.text).toBe("&lt;Tabs&gt;&#123;globalThis.process&#125;&lt;/Tabs&gt;")
    expect(props.code).toBe("const value = { safe: true }")
    expect(document).not.toContain("components/tabs")
  })

  it("creates deterministic metadata for successful pages", () => {
    const manifest = createSuccessfulManifest({
      profile: "fumadocs",
      outputPath: "content/docs/guides/first-post/index.mdx",
    })

    expect(getOutputAdapter("fumadocs").createSupportFiles(manifest)).toEqual([
      {
        relativePath: "content/docs/meta.json",
        content: '{\n  "title": "sample",\n  "pages": [\n    "guides"\n  ]\n}\n',
      },
      {
        relativePath: "content/docs/guides/meta.json",
        content: '{\n  "title": "Guides",\n  "pages": [\n    "first-post"\n  ]\n}\n',
      },
    ])
  })

  it("renders Docusaurus documents and category metadata", () => {
    const adapter = getOutputAdapter("docusaurus")
    const document = adapter.renderDocument({
      frontmatter: "title: Test\n",
      body: "<TOCInline toc={toc} />\n\n:::note[Quote]\nText\n:::",
    })
    const manifest = createSuccessfulManifest({
      profile: "docusaurus",
      outputPath: "docs/guides/first-post/index.mdx",
    })

    expect(document).toContain("import TOCInline from '@theme/TOCInline';")
    expect(document).toContain("<TOCInline toc={toc} />")
    expect(adapter.assetRootSegments).toEqual(["static"])
    expect(adapter.createSupportFiles(manifest)).toEqual([
      {
        relativePath: "docs/guides/_category_.json",
        content: '{\n  "label": "Guides"\n}\n',
      },
    ])
  })

  it("renders Nextra documents and navigation metadata", () => {
    const adapter = getOutputAdapter("nextra")
    const document = adapter.renderDocument({
      frontmatter: "title: Test\nasIndexPage: Wrong\n",
      body: "<Callout>Text</Callout>",
    })
    const manifest = createSuccessfulManifest({
      profile: "nextra",
      outputPath: "content/guides/first-post/index.mdx",
    })

    expect(document).toContain("asIndexPage: true")
    expect(document.match(/^asIndexPage:/gm)).toHaveLength(1)
    expect(document).toContain("import { Callout } from 'nextra/components';")
    expect(adapter.createSupportFiles(manifest)).toEqual([
      {
        relativePath: "content/index.mdx",
        content: '---\ntitle: "sample"\n---\n\n# sample\n',
      },
      {
        relativePath: "content/_meta.js",
        content: 'export default {\n  "index": "sample",\n  "guides": "Guides"\n}\n',
      },
      {
        relativePath: "content/guides/_meta.js",
        content: 'export default {\n  "first-post": "First post"\n}\n',
      },
    ])
  })
})
