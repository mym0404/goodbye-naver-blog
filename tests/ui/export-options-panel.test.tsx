// @vitest-environment jsdom

import { fireEvent, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "../../src/shared/export-options.js"
import type { ExportOptions } from "../../src/shared/types.js"
import { ExportOptionsPanel } from "../../src/ui/features/options/export-options-panel.js"
import type { ExportPreviewResult } from "../../src/ui/lib/api.js"

const preview: ExportPreviewResult = {
  candidatePost: {
    blogId: "mym0404",
    logNo: "1",
    title: "테스트 글",
    publishedAt: "2026-04-11T04:00:00.000Z",
    categoryId: 101,
    categoryName: "NestJS",
    source: "https://blog.naver.com/mym0404/1",
    editorVersion: 4,
    thumbnailUrl: null,
  },
  markdown: `---
postTitle: "테스트 글"
---

# 제목`,
  markdownFilePath: "posts/NestJS/test.md",
  editorVersion: 4,
  blockTypes: ["heading"],
  parserWarnings: ["parser warning"],
  reviewerWarnings: [],
  renderWarnings: [],
  assetPaths: [],
}

const query = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector(selector)

  if (!(element instanceof HTMLElement)) {
    throw new Error(`missing element: ${selector}`)
  }

  return element as T
}

describe("ExportOptionsPanel", () => {
  it("wires preview controls and option updaters across all groups", async () => {
    const user = userEvent.setup()
    let latestOptions: ExportOptions = defaultExportOptions()
    let latestOutputDir = "./output"
    const onPreview = vi.fn()
    const onPreviewModeChange = vi.fn()
    const onSubmit = vi.fn()
    const onOutputDirChange = vi.fn((value: string) => {
      latestOutputDir = value
    })
    const onOptionsChange = vi.fn((updater: (current: ExportOptions) => ExportOptions) => {
      latestOptions = updater(latestOptions)
    })

    render(
      <ExportOptionsPanel
        outputDir="./output"
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={['title와 source가 같은 alias "shared"를 사용할 수 없습니다.']}
        preview={preview}
        previewDirty
        previewStatus="preview status"
        previewMode="source"
        previewPending={false}
        exportPending={false}
        disabled={false}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
        onPreview={onPreview}
        onPreviewModeChange={onPreviewModeChange}
        onSubmit={onSubmit}
      />,
    )

    fireEvent.change(query<HTMLInputElement>("#outputDir"), {
      target: {
        value: "/tmp/export",
      },
    })
    await user.click(screen.getByRole("button", { name: "예시 보기" }))
    await user.click(screen.getByTitle("같이보기"))
    await user.click(screen.getByTitle("결과보기"))
    await user.click(screen.getByRole("button", { name: "선택한 카테고리 내보내기" }))

    await user.click(screen.getByRole("tab", { name: "범위" }))
    await user.selectOptions(query<HTMLSelectElement>("#scope-categoryMode"), "exact-selected")
    fireEvent.change(query<HTMLInputElement>("#scope-dateFrom"), {
      target: {
        value: "2024-01-01",
      },
    })
    fireEvent.change(query<HTMLInputElement>("#scope-dateTo"), {
      target: {
        value: "2024-12-31",
      },
    })

    await user.click(screen.getByRole("tab", { name: "구조" }))
    await user.click(query<HTMLInputElement>("#structure-cleanOutputDir"))
    fireEvent.change(query<HTMLInputElement>("#structure-postDirectoryName"), {
      target: {
        value: "notes",
      },
    })
    fireEvent.change(query<HTMLInputElement>("#structure-assetDirectoryName"), {
      target: {
        value: "images",
      },
    })
    await user.selectOptions(query<HTMLSelectElement>("#structure-folderStrategy"), "flat")
    await user.click(query<HTMLInputElement>("#structure-includeDateInFilename"))
    await user.click(query<HTMLInputElement>("#structure-includeLogNoInFilename"))
    await user.selectOptions(query<HTMLSelectElement>("#structure-slugStyle"), "keep-title")

    await user.click(query<HTMLInputElement>("#frontmatter-enabled"))
    await user.click(query<HTMLInputElement>('[data-frontmatter-field="title"] input[type="checkbox"]'))
    fireEvent.change(query<HTMLInputElement>('[data-frontmatter-field="title"] [data-alias-input="true"]'), {
      target: {
        value: "headline",
      },
    })
    expect(query<HTMLElement>("#frontmatter-status").textContent).toMatch(/같은 alias "shared"/)

    await user.click(screen.getByRole("tab", { name: "Markdown" }))
    await user.selectOptions(query<HTMLSelectElement>("#markdown-linkStyle"), "referenced")
    await user.selectOptions(query<HTMLSelectElement>("#markdown-linkCardStyle"), "quote")
    fireEvent.change(query<HTMLInputElement>("#markdown-formulaInlineWrapperOpen"), {
      target: {
        value: "\\(",
      },
    })
    fireEvent.change(query<HTMLInputElement>("#markdown-formulaInlineWrapperClose"), {
      target: {
        value: "\\)",
      },
    })
    await user.selectOptions(query<HTMLSelectElement>("#markdown-formulaBlockStyle"), "math-fence")
    fireEvent.change(query<HTMLInputElement>("#markdown-formulaBlockWrapperOpen"), {
      target: {
        value: "```math",
      },
    })
    fireEvent.change(query<HTMLInputElement>("#markdown-formulaBlockWrapperClose"), {
      target: {
        value: "```",
      },
    })
    await user.selectOptions(query<HTMLSelectElement>("#markdown-videoStyle"), "link-only")
    await user.selectOptions(query<HTMLSelectElement>("#markdown-imageStyle"), "linked-image")
    await user.selectOptions(query<HTMLSelectElement>("#markdown-dividerStyle"), "asterisk")
    await user.selectOptions(query<HTMLSelectElement>("#markdown-codeFenceStyle"), "tilde")
    fireEvent.change(query<HTMLInputElement>("#markdown-headingLevelOffset"), {
      target: {
        value: "2",
      },
    })

    await user.click(screen.getByRole("tab", { name: "Assets" }))
    await user.selectOptions(query<HTMLSelectElement>("#assets-assetPathMode"), "remote")
    await user.selectOptions(query<HTMLSelectElement>("#assets-imageContentMode"), "base64")
    await user.selectOptions(query<HTMLSelectElement>("#assets-stickerAssetMode"), "download-original")
    await user.click(query<HTMLInputElement>("#assets-downloadImages"))
    await user.click(query<HTMLInputElement>("#assets-downloadThumbnails"))
    await user.click(query<HTMLInputElement>("#assets-includeImageCaptions"))
    await user.selectOptions(query<HTMLSelectElement>("#assets-thumbnailSource"), "none")

    expect(onPreview).toHaveBeenCalledTimes(1)
    expect(onPreviewModeChange).toHaveBeenCalledWith("split")
    expect(onPreviewModeChange).toHaveBeenCalledWith("rendered")
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(latestOutputDir).toBe("/tmp/export")
    expect(onOptionsChange).toHaveBeenCalled()

    expect(latestOptions.scope.categoryMode).toBe("exact-selected")
    expect(latestOptions.scope.dateFrom).toBe("2024-01-01")
    expect(latestOptions.scope.dateTo).toBe("2024-12-31")
    expect(latestOptions.structure.cleanOutputDir).toBe(false)
    expect(latestOptions.structure.postDirectoryName).toBe("notes")
    expect(latestOptions.structure.assetDirectoryName).toBe("images")
    expect(latestOptions.structure.folderStrategy).toBe("flat")
    expect(latestOptions.structure.includeDateInFilename).toBe(false)
    expect(latestOptions.structure.includeLogNoInFilename).toBe(false)
    expect(latestOptions.structure.slugStyle).toBe("keep-title")
    expect(latestOptions.frontmatter.enabled).toBe(false)
    expect(latestOptions.frontmatter.fields.title).toBe(false)
    expect(latestOptions.frontmatter.aliases.title).toBe("headline")
    expect(latestOptions.markdown.linkStyle).toBe("referenced")
    expect(latestOptions.markdown.linkCardStyle).toBe("quote")
    expect(latestOptions.markdown.formulaInlineWrapperOpen).toBe("\\(")
    expect(latestOptions.markdown.formulaInlineWrapperClose).toBe("\\)")
    expect(latestOptions.markdown.formulaBlockStyle).toBe("math-fence")
    expect(latestOptions.markdown.formulaBlockWrapperOpen).toBe("```math")
    expect(latestOptions.markdown.formulaBlockWrapperClose).toBe("```")
    expect(latestOptions.markdown.videoStyle).toBe("link-only")
    expect(latestOptions.markdown.imageStyle).toBe("linked-image")
    expect(latestOptions.markdown.dividerStyle).toBe("asterisk")
    expect(latestOptions.markdown.codeFenceStyle).toBe("tilde")
    expect(latestOptions.markdown.headingLevelOffset).toBe(2)
    expect(latestOptions.assets.assetPathMode).toBe("remote")
    expect(latestOptions.assets.imageContentMode).toBe("base64")
    expect(latestOptions.assets.stickerAssetMode).toBe("download-original")
    expect(latestOptions.assets.downloadImages).toBe(false)
    expect(latestOptions.assets.downloadThumbnails).toBe(false)
    expect(latestOptions.assets.includeImageCaptions).toBe(false)
    expect(latestOptions.assets.thumbnailSource).toBe("none")
  })
})
