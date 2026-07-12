// @vitest-environment jsdom

import "@testing-library/jest-dom/vitest"
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { PrimerAppProvider } from "../../../app/PrimerAppProvider.js"

import { WizardHeader } from "./WizardHeader.js"

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
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
  vi.stubGlobal(
    "IntersectionObserver",
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

describe("WizardHeader", () => {
  it("keeps the title plain and places the responsive menu in the right action area", () => {
    render(
      <PrimerAppProvider themePreference="dark">
        <WizardHeader
          title="카테고리 선택"
          themePreference="dark"
          headerStatus="ready"
          summaryCards={[]}
          onThemeChange={vi.fn()}
        />
      </PrimerAppProvider>,
    )

    const titleArea = screen.getByRole("heading", { name: "카테고리 선택" }).parentElement
    const menuButton = screen.getByRole("button", { name: "메뉴 열기" })

    expect(titleArea).toHaveAttribute("data-component", "TitleArea")
    expect(titleArea).not.toContainElement(
      document.querySelector('[data-component="PH_LeadingVisual"]'),
    )
    expect(document.querySelector('[data-component="PH_LeadingAction"]')).not.toBeInTheDocument()
    expect(menuButton.closest('[data-component="PH_Actions"]')).toBeInTheDocument()
    expect(menuButton.querySelector(".octicon-three-bars")).toBeInTheDocument()
  })
})
