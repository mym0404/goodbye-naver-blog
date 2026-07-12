// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PrimerAppProvider } from "../../app/PrimerAppProvider.js"

import { BlogInputPanel } from "./BlogInputPanel.js"

describe("BlogInputPanel", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    )
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("selects a blog from the server-provided catalog", async () => {
    const user = userEvent.setup()
    const onBlogKeyChange = vi.fn()

    render(
      <PrimerAppProvider themePreference="light">
        <BlogInputPanel
          blogs={[
            { key: "naver", label: "Naver" },
            { key: "tistory", label: "Tistory" },
          ]}
          blogKey="naver"
          sourceInput=""
          outputDir="output"
          scanPending={false}
          scanStatus="입력하세요."
          scanStatusTone="default"
          onBlogKeyChange={onBlogKeyChange}
          onSourceIdOrUrlChange={vi.fn()}
          onOutputDirChange={vi.fn()}
          onOutputDirBlur={vi.fn()}
        />
      </PrimerAppProvider>,
    )

    await user.click(screen.getByRole("button", { name: "블로그" }))
    await user.click(screen.getByRole("menuitemradio", { name: "Tistory" }))

    expect(onBlogKeyChange).toHaveBeenCalledWith("tistory")
  })

  it("lists and selects MDX output profiles", async () => {
    const user = userEvent.setup()
    const onProfileChange = vi.fn()

    render(
      <PrimerAppProvider themePreference="light">
        <BlogInputPanel
          blogs={[{ key: "naver", label: "Naver" }]}
          blogKey="naver"
          sourceInput=""
          outputDir="output"
          profile="gfm"
          scanPending={false}
          scanStatus="입력하세요."
          scanStatusTone="default"
          onBlogKeyChange={vi.fn()}
          onSourceIdOrUrlChange={vi.fn()}
          onOutputDirChange={vi.fn()}
          onOutputDirBlur={vi.fn()}
          onProfileChange={onProfileChange}
        />
      </PrimerAppProvider>,
    )

    await user.click(screen.getByRole("button", { name: "출력 형식" }))
    expect(screen.getByRole("menuitemradio", { name: "Fumadocs (MDX)" })).toBeInTheDocument()
    expect(screen.getByRole("menuitemradio", { name: "Docusaurus (MDX)" })).toBeInTheDocument()
    await user.click(screen.getByRole("menuitemradio", { name: "Nextra (MDX)" }))

    expect(onProfileChange).toHaveBeenCalledWith("nextra")
  })
})
