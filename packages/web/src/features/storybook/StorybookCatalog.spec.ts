import { parsePostHtml } from "@exitpress/blog-naver/parsing/naver-blog/core/PostParser.js"
import { NaverBlog } from "@exitpress/blog-naver/parsing/naver-blog/NaverBlog.js"
import {
  getTistoryBlockTemplateDefinitions,
  parseTistoryPostHtml,
} from "@exitpress/blog-tistory/parsing/TistoryPostParser.js"
import { resolveParsedBlockAssetsForRender } from "@exitpress/engine/exporting/assets/ParsedBlockAssetResolver.js"
import { renderBlockTemplates } from "@exitpress/engine/markdown/util/renderBlockTemplates.js"
import { load } from "cheerio"
import { describe, expect, it } from "vitest"

import type { ParserBlockInspection } from "@exitpress/blog-naver/parsing/naver-blog/core/ParserBlockDiagnostics.js"

import { storybookCaptureAssets } from "./StorybookAssets.js"
import { storybookCatalog } from "./StorybookCatalog.js"

const storybookOptions = { blockOutputs: { templates: {} } }
const tistoryTemplateDefinitions = getTistoryBlockTemplateDefinitions()
const defaultBlockTemplates = Object.fromEntries(
  [...new NaverBlog().getBlockTemplateDefinitions(), ...tistoryTemplateDefinitions].map(
    (definition) => [definition.key, definition.presets[0].template],
  ),
)

const renderExpectedStoryMarkdown = async (story: {
  inputHtml: string
  sourceUrl: string
  editorType: string
}) => {
  const parsedPost =
    story.editorType === "tistory"
      ? parseTistoryPostHtml({ html: story.inputHtml, options: storybookOptions })
      : parsePostHtml({
          html: story.inputHtml,
          sourceUrl: story.sourceUrl,
          options: storybookOptions,
        })
  const resolved = await resolveParsedBlockAssetsForRender({
    blocks: parsedPost.blocks,
    resolveAsset: async ({ role, sourceUrl }) => ({
      reference: sourceUrl,
      record: {
        kind: role,
        sourceUrl,
        reference: sourceUrl,
        relativePath: null,
        storageMode: "remote",
        uploadCandidate: null,
      },
    }),
  })
  const markdown = renderBlockTemplates(
    resolved.blocks.map((block) => ({
      template: defaultBlockTemplates[block.blockId] ?? "",
      props: block.props,
    })),
  )

  return markdown || "Markdown 출력 없음"
}

const flattenInspections = (inspections: ParserBlockInspection[]): ParserBlockInspection[] =>
  inspections.flatMap((inspection) => [
    inspection,
    ...flattenInspections(inspection.children ?? []),
  ])

describe("storybook catalog", () => {
  it("renders every storybook story with markdown and committed capture assets", async () => {
    const blog = new NaverBlog()
    const stories = storybookCatalog.flatMap((group) => group.stories)

    expect(storybookCatalog.map((group) => group.editorLabel)).toEqual([
      "SmartEditor 4",
      "SmartEditor 3",
      "SmartEditor 2",
      "Tistory",
    ])
    expect(stories).toHaveLength(67)
    expect(stories.every((story) => story.inputHtml.trim())).toBe(true)
    expect(stories.every((story) => story.markdown.trim())).toBe(true)
    expect(stories.every((story) => story.templateDefinition)).toBe(true)
    expect(stories.every((story) => !Object.hasOwn(story, "group"))).toBe(true)
    expect(new Set(stories.map((story) => story.storyKey)).size).toBe(stories.length)
    expect(new Set(stories.map((story) => story.screenshotSrc)).size).toBe(stories.length)
    expect(Object.keys(storybookCaptureAssets).sort()).toEqual(
      stories.map((story) => story.storyKey).sort(),
    )
    expect(stories.every((story) => !Object.hasOwn(story, "markdownVariants"))).toBe(true)

    stories
      .filter((story) => story.editorType !== "tistory")
      .forEach((story) => {
        const editor = blog.getEditorForHtml(story.inputHtml)
        const $ = load(story.inputHtml)
        const matchedInspection = editor
          ? flattenInspections(
              editor.inspect({
                $,
                sourceUrl: story.sourceUrl,
                tags: [],
                options: storybookOptions,
              }),
            ).find((inspection) => inspection.path === story.inspectPath)
          : undefined

        expect(editor?.type).toBe(story.editorType)
        expect(matchedInspection).toMatchObject({
          matchedBlockId: story.blockId,
          matchedBlockLabel: story.blockLabel,
        })
      })

    stories.forEach((story) => {
      expect(storybookCaptureAssets[story.storyKey]).toBe(story.screenshotSrc)
    })

    const tistoryStories = stories.filter((story) => story.editorType === "tistory")

    expect(tistoryStories.map((story) => `tistory:${story.blockId}`)).toEqual(
      tistoryTemplateDefinitions.map((definition) => definition.key),
    )

    tistoryStories.forEach((story) => {
      const parsed = parseTistoryPostHtml({ html: story.inputHtml, options: storybookOptions })

      if (story.blockId === "ignore") {
        expect(parsed.blocks).toEqual([])
      } else if (story.blockId === "container") {
        expect(parsed.blocks.length).toBeGreaterThan(0)
      } else {
        expect(parsed.blocks.some((block) => block.blockId === `tistory:${story.blockId}`)).toBe(
          true,
        )
      }
    })

    await Promise.all(
      stories.map(async (story) => {
        expect(story.markdown).toBe(await renderExpectedStoryMarkdown(story))
      }),
    )
  })
})
