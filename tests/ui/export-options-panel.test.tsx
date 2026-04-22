// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import "@testing-library/jest-dom/vitest"

import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "../../src/shared/export-options.js"
import type { ExportOptions } from "../../src/shared/types.js"
import { ExportOptionsPanel } from "../../src/ui/features/options/export-options-panel.js"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  )
  Object.defineProperty(HTMLElement.prototype, "hasPointerCapture", {
    configurable: true,
    value: vi.fn(() => false),
  })
  Object.defineProperty(HTMLElement.prototype, "setPointerCapture", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, "releasePointerCapture", {
    configurable: true,
    value: vi.fn(),
  })
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  })
})

const query = <T extends HTMLElement>(selector: string) => {
  const element = document.querySelector(selector)

  if (!(element instanceof HTMLElement)) {
    throw new Error(`missing element: ${selector}`)
  }

  return element as T
}

const selectOption = async ({
  user,
  trigger,
  value,
}: {
  user: ReturnType<typeof userEvent.setup>
  trigger: string
  value: string
}) => {
  await user.click(query<HTMLElement>(trigger))

  await waitFor(() => {
    expect(document.querySelector(`[data-slot="select-item"][data-value="${value}"]`)).not.toBeNull()
  })

  await user.click(query<HTMLElement>(`[data-slot="select-item"][data-value="${value}"]`))
}

describe("ExportOptionsPanel", () => {
  it("wires option updaters across all option steps", async () => {
    const user = userEvent.setup()
    let latestOptions: ExportOptions = defaultExportOptions()
    let latestOutputDir = "./output"
    const onOutputDirChange = vi.fn((value: string) => {
      latestOutputDir = value
    })
    const onOptionsChange = vi.fn((updater: (current: ExportOptions) => ExportOptions) => {
      latestOptions = updater(latestOptions)
    })

    render(
      <ExportOptionsPanel
        step="structure"
        outputDir="./output"
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={['title와 source가 같은 alias "shared"를 사용할 수 없습니다.']}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
      />,
    )

    fireEvent.change(query<HTMLInputElement>("#outputDir"), {
      target: {
        value: "/tmp/export",
      },
    })
    await user.click(query<HTMLInputElement>("#structure-groupByCategory"))
    await user.click(query<HTMLInputElement>("#structure-includeDateInPostFolderName"))
    await user.click(query<HTMLInputElement>("#structure-includeLogNoInPostFolderName"))
    await selectOption({ user, trigger: "#structure-slugStyle", value: "keep-title" })
    await selectOption({ user, trigger: "#structure-slugWhitespace", value: "keep-space" })
    await user.click(query<HTMLInputElement>("#structure-postFolderNameMode-custom-template"))

    cleanup()

    render(
      <ExportOptionsPanel
        step="frontmatter"
        outputDir={latestOutputDir}
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={['title와 source가 같은 alias "shared"를 사용할 수 없습니다.']}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
      />,
    )

    await user.click(query<HTMLInputElement>("#frontmatter-enabled"))
    await user.click(query<HTMLElement>("#frontmatter-field-title"))
    fireEvent.change(query<HTMLInputElement>('[data-frontmatter-field="title"] [data-alias-input="true"]'), {
      target: {
        value: "headline",
      },
    })
    expect(query<HTMLElement>("#frontmatter-status").textContent).toMatch(/같은 alias "shared"/)
    expect(query<HTMLElement>('[data-frontmatter-field="title"] [data-alias-input="true"]')).toHaveAttribute(
      "aria-invalid",
      "true",
    )

    cleanup()

    render(
      <ExportOptionsPanel
        step="markdown"
        outputDir={latestOutputDir}
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
      />,
    )

    await selectOption({ user, trigger: "#markdown-linkStyle", value: "referenced" })
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
    await selectOption({ user, trigger: "#markdown-formulaBlockStyle", value: "math-fence" })
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
    await selectOption({ user, trigger: "#markdown-imageStyle", value: "linked-image" })
    await selectOption({ user, trigger: "#markdown-dividerStyle", value: "asterisk" })
    await selectOption({ user, trigger: "#markdown-codeFenceStyle", value: "tilde" })
    fireEvent.change(query<HTMLInputElement>("#markdown-headingLevelOffset"), {
      target: {
        value: "2",
      },
    })

    cleanup()

    render(
      <ExportOptionsPanel
        step="assets"
        outputDir={latestOutputDir}
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
      />,
    )

    await selectOption({ user, trigger: "#assets-imageHandlingMode", value: "download-and-upload" })
    await user.click(query<HTMLInputElement>("#assets-compressionEnabled"))
    await selectOption({ user, trigger: "#assets-imageHandlingMode", value: "remote" })
    await selectOption({ user, trigger: "#assets-stickerAssetMode", value: "download-original" })
    await user.click(query<HTMLInputElement>("#assets-includeImageCaptions"))
    await selectOption({ user, trigger: "#assets-thumbnailSource", value: "none" })

    cleanup()

    render(
      <ExportOptionsPanel
        step="links"
        outputDir={latestOutputDir}
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
      />,
    )

    await user.click(query<HTMLInputElement>("#links-sameBlogPostMode-custom-url"))

    cleanup()

    render(
      <ExportOptionsPanel
        step="links"
        outputDir={latestOutputDir}
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
      />,
    )

    fireEvent.change(query<HTMLInputElement>("#links-sameBlogPostCustomUrlTemplate"), {
      target: {
        value: "https://myblog/{slug}",
      },
    })

    cleanup()

    render(
      <ExportOptionsPanel
        step="structure"
        outputDir={latestOutputDir}
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={onOutputDirChange}
        onOptionsChange={onOptionsChange}
      />,
    )

    fireEvent.change(query<HTMLInputElement>("#structure-postFolderNameCustomTemplate"), {
      target: {
        value: "{YYYY}_{MM}_{logNo}_{slug}",
      },
    })

    expect(latestOutputDir).toBe("/tmp/export")
    expect(onOptionsChange).toHaveBeenCalled()

    expect(latestOptions.structure.groupByCategory).toBe(false)
    expect(latestOptions.structure.includeDateInPostFolderName).toBe(false)
    expect(latestOptions.structure.includeLogNoInPostFolderName).toBe(true)
    expect(latestOptions.structure.slugStyle).toBe("keep-title")
    expect(latestOptions.structure.slugWhitespace).toBe("keep-space")
    expect(latestOptions.structure.postFolderNameMode).toBe("custom-template")
    expect(latestOptions.structure.postFolderNameCustomTemplate).toBe("{YYYY}_{MM}_{logNo}_{slug}")
    expect(latestOptions.frontmatter.enabled).toBe(false)
    expect(latestOptions.frontmatter.fields.title).toBe(false)
    expect(latestOptions.frontmatter.aliases.title).toBe("headline")
    expect(latestOptions.markdown.linkStyle).toBe("referenced")
    expect(latestOptions.markdown.formulaInlineWrapperOpen).toBe("\\(")
    expect(latestOptions.markdown.formulaInlineWrapperClose).toBe("\\)")
    expect(latestOptions.markdown.formulaBlockStyle).toBe("math-fence")
    expect(latestOptions.markdown.formulaBlockWrapperOpen).toBe("```math")
    expect(latestOptions.markdown.formulaBlockWrapperClose).toBe("```")
    expect(latestOptions.markdown.imageStyle).toBe("linked-image")
    expect(latestOptions.markdown.dividerStyle).toBe("asterisk")
    expect(latestOptions.markdown.codeFenceStyle).toBe("tilde")
    expect(latestOptions.markdown.headingLevelOffset).toBe(2)
    expect(latestOptions.assets.imageHandlingMode).toBe("remote")
    expect(latestOptions.assets.compressionEnabled).toBe(false)
    expect(latestOptions.assets.stickerAssetMode).toBe("download-original")
    expect(latestOptions.assets.downloadImages).toBe(false)
    expect(latestOptions.assets.downloadThumbnails).toBe(false)
    expect(latestOptions.assets.includeImageCaptions).toBe(false)
    expect(latestOptions.assets.thumbnailSource).toBe("none")
    expect(latestOptions.links.sameBlogPostMode).toBe("custom-url")
    expect(latestOptions.links.sameBlogPostCustomUrlTemplate).toBe("https://myblog/{slug}")
    expect(Object.hasOwn(latestOptions.assets, "imageContentMode")).toBe(false)
  })

  it("shows an always-expanded file tree preview in the structure step", () => {
    const options = defaultExportOptions()

    render(
      <ExportOptionsPanel
        step="structure"
        outputDir="./output"
        options={options}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={vi.fn()}
      />,
    )

    const preview = query<HTMLElement>("#structure-file-tree-preview")

    expect(preview.textContent).toContain("./output")
    expect(preview.textContent).toContain("개발_메모")
    expect(preview.textContent).toContain("react")
    expect(preview.textContent).toContain("typescript")
    expect(preview.textContent).toContain("2026-04-11-첫_글")
    expect(preview.textContent).toContain("2026-04-12-둘째_글")
    expect(preview.textContent).toContain("2026-04-14-세_번째_정리")
    expect(preview.textContent).toContain("public")
    expect(preview.textContent).toContain("manifest.json")
    expect(preview.textContent).toContain("b7d3f1-cover.jpg")
  })

  it("updates the structure preview when the folder rule changes", () => {
    const options = defaultExportOptions()

    options.structure.groupByCategory = false
    options.structure.includeLogNoInPostFolderName = true
    options.structure.slugStyle = "keep-title"
    options.structure.slugWhitespace = "keep-space"
    options.assets.imageHandlingMode = "remote"

    render(
      <ExportOptionsPanel
        step="structure"
        outputDir="/tmp/export"
        options={options}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={vi.fn()}
      />,
    )

    const preview = query<HTMLElement>("#structure-file-tree-preview")

    expect(preview.textContent).toContain("/tmp/export")
    expect(preview.textContent).toContain("2026-04-11-223034929697-첫 글")
    expect(preview.textContent).toContain("2026-04-12-223034929698-둘째 글")
    expect(preview.textContent).toContain("2026-04-14-223034929755-세 번째 정리")
    expect(preview.textContent).not.toContain("개발 메모")
    expect(preview.textContent).not.toContain("public")
  })

  it("shows supported variable descriptions and a live preview for custom folder templates", () => {
    const options = defaultExportOptions()

    options.structure.postFolderNameMode = "custom-template"
    options.structure.postFolderNameCustomTemplate = "{YYYY}_{MM}_{logNo}_{slug}"

    render(
      <ExportOptionsPanel
        step="structure"
        outputDir="./output"
        options={options}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={vi.fn()}
      />,
    )

    expect(screen.getAllByText("{slug}").length).toBeGreaterThan(0)
    expect(screen.getByText("제목을 현재 slug 규칙에 맞춰 바꾼 값입니다.")).toBeInTheDocument()
    expect(screen.getByText("카테고리 이름을 현재 slug 규칙에 맞춰 바꾼 값입니다.")).toBeInTheDocument()
    expect(screen.getAllByText("{logNo}").length).toBeGreaterThan(0)
    expect(screen.getByText("네이버 글 번호를 그대로 넣습니다.")).toBeInTheDocument()
    expect(screen.getAllByText("{YYYY}").length).toBeGreaterThan(0)
    expect(screen.getAllByText("발행 연도를 4자리로 넣습니다.").length).toBeGreaterThan(0)
    expect(screen.getAllByText("{MM}").length).toBeGreaterThan(0)
    expect(screen.getAllByText("발행 월을 2자리로 넣습니다.").length).toBeGreaterThan(0)
    expect(query<HTMLElement>("#structure-postFolderNameCustomTemplatePreview").textContent).toBe(
      "2026_04_223034929697_첫_글",
    )
  })

  it("does not render removed link card and video controls", () => {
    render(
      <ExportOptionsPanel
        step="markdown"
        outputDir="./output"
        options={defaultExportOptions()}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText("Link Card Style")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("Video Style")).not.toBeInTheDocument()
    expect(document.querySelector("#markdown-linkCardStyle")).toBeNull()
    expect(document.querySelector("#markdown-videoStyle")).toBeNull()
  })

  it("keeps upload credentials out of the assets step and disables local-only controls in remote mode", () => {
    const options = defaultExportOptions()

    options.assets.imageHandlingMode = "remote"

    render(
      <ExportOptionsPanel
        step="assets"
        outputDir="./output"
        options={options}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={vi.fn()}
      />,
    )

    expect(query<HTMLInputElement>("#assets-compressionEnabled")).toBeDisabled()
    expect(query<HTMLInputElement>("#assets-downloadImages")).toBeDisabled()
    expect(query<HTMLInputElement>("#assets-downloadThumbnails")).toBeDisabled()
    expect(document.querySelector("#assets-imageContentMode")).toBeNull()
    expect(query<HTMLElement>("#assets-imageHandlingMode")).toHaveAttribute("data-value", "remote")
    expect(query<HTMLElement>("#assets-stickerAssetMode")).not.toBeDisabled()
    expect(query<HTMLInputElement>("#assets-includeImageCaptions")).not.toBeDisabled()
    expect(query<HTMLElement>("#assets-thumbnailSource")).not.toBeDisabled()
    expect(screen.queryByLabelText("uploaderKey")).not.toBeInTheDocument()
    expect(screen.queryByLabelText("uploaderConfigJson")).not.toBeInTheDocument()
  })

  it("renders download failure handling in the diagnostics step", async () => {
    const user = userEvent.setup()
    let latestOptions = defaultExportOptions()

    render(
      <ExportOptionsPanel
        step="diagnostics"
        outputDir="./output"
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={(updater) => {
          latestOptions = updater(latestOptions)
        }}
      />,
    )

    await selectOption({ user, trigger: "#assets-downloadFailureMode", value: "warn-and-omit" })

    expect(latestOptions.assets.downloadFailureMode).toBe("warn-and-omit")
  })

  it("shows the custom template input only for custom-url mode in the links step", async () => {
    const user = userEvent.setup()
    let latestOptions = defaultExportOptions()

    render(
      <ExportOptionsPanel
        step="links"
        outputDir="./output"
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={(updater) => {
          latestOptions = updater(latestOptions)
        }}
      />,
    )

    expect(document.querySelector("#links-sameBlogPostCustomUrlTemplate")).toBeNull()

    await user.click(query<HTMLInputElement>("#links-sameBlogPostMode-custom-url"))

    expect(latestOptions.links.sameBlogPostMode).toBe("custom-url")

    cleanup()

    render(
      <ExportOptionsPanel
        step="links"
        outputDir="./output"
        options={latestOptions}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        onOutputDirChange={vi.fn()}
        onOptionsChange={(updater) => {
          latestOptions = updater(latestOptions)
        }}
      />,
    )

    expect(query<HTMLInputElement>("#links-sameBlogPostCustomUrlTemplate").placeholder).toBe("https://myblog/{slug}")
  })

  it("shows supported variable descriptions and a live preview for custom templates", () => {
    const options = defaultExportOptions()

    options.links.sameBlogPostMode = "custom-url"
    options.links.sameBlogPostCustomUrlTemplate = "https://myblog/{category}/{title}/{YYYY}/{MM}/{DD}/{YY}/{M}/{D}/{logNo}/{slug}"

    render(
      <ExportOptionsPanel
        step="links"
        outputDir="./output"
        options={options}
        optionDescriptions={optionDescriptions}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={[]}
        linkTemplatePreviewPost={{
          blogId: "mym0404",
          logNo: "223034929697",
          title: "첫 글",
          publishedAt: "2026-04-11T04:00:00.000Z",
          categoryName: "NestJS",
        }}
        onOutputDirChange={vi.fn()}
        onOptionsChange={vi.fn()}
      />,
    )

    expect(screen.getAllByText("{slug}").length).toBeGreaterThan(0)
    expect(screen.getByText("제목을 현재 slug 규칙에 맞춰 바꾼 값입니다.")).toBeInTheDocument()
    expect(screen.getAllByText("{category}").length).toBeGreaterThan(0)
    expect(screen.getByText("카테고리 이름을 현재 slug 규칙에 맞춰 바꾼 값입니다.")).toBeInTheDocument()
    expect(screen.getAllByText("{title}").length).toBeGreaterThan(0)
    expect(screen.getByText("제목만 path-safe 값으로 넣습니다.")).toBeInTheDocument()
    expect(screen.getAllByText("{date}").length).toBeGreaterThan(0)
    expect(screen.getByText("발행일을 YYYY-MM-DD 형식으로 넣습니다.")).toBeInTheDocument()
    expect(screen.getAllByText("{YY}").length).toBeGreaterThan(0)
    expect(screen.getByText("발행 연도 뒤 2자리만 넣습니다.")).toBeInTheDocument()
    expect(screen.getAllByText("{D}").length).toBeGreaterThan(0)
    expect(screen.getByText("발행 일을 1~31 숫자로 넣습니다.")).toBeInTheDocument()
    expect(query<HTMLElement>("#links-sameBlogPostCustomUrlPreview").textContent).toBe(
      "https://myblog/nestjs/첫-글/2026/04/11/26/4/11/223034929697/첫_글",
    )
  })
})
