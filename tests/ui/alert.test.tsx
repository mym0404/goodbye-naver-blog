// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import "@testing-library/jest-dom/vitest"

import { Alert, AlertDescription, AlertTitle } from "../../src/ui/components/ui/alert.js"

describe("Alert", () => {
  it("renders title, description, and destructive variant semantics", () => {
    render(
      <Alert variant="destructive">
        <AlertTitle>오류</AlertTitle>
        <AlertDescription>설정을 다시 확인하세요.</AlertDescription>
      </Alert>,
    )

    const alert = screen.getByRole("alert")

    expect(alert).toHaveTextContent("오류")
    expect(alert).toHaveTextContent("설정을 다시 확인하세요.")
    expect(alert.className).toContain("text-destructive")
  })
})
