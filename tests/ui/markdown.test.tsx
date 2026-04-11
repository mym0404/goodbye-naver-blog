// @vitest-environment jsdom

import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import "@testing-library/jest-dom/vitest"

import { MarkdownDocument, splitFrontmatter } from "../../src/ui/lib/markdown.js"

describe("MarkdownDocument", () => {
  it("splits frontmatter and keeps body content separate", () => {
    const result = splitFrontmatter(`---
title: demo
tags:
  - one
---

# Heading`)

    expect(result.frontmatter).toEqual({
      title: "demo",
      tags: ["one"],
    })
    expect(result.body).toContain("# Heading")
  })

  it("renders structured markdown and omits raw html blocks", () => {
    render(
      <MarkdownDocument
        markdown={`---
title: demo
---

| a | b |
| - | - |
| 1 | 2 |

> note

\`\`\`ts
const value = 1
\`\`\`

<div>hidden html</div>`}
      />,
    )

    expect(screen.getByText("Frontmatter")).toBeInTheDocument()
    expect(screen.getByText("title:")).toBeInTheDocument()
    expect(screen.getByText("demo")).toBeInTheDocument()
    expect(screen.getByRole("table")).toBeInTheDocument()
    expect(screen.getByText("note")).toBeInTheDocument()
    expect(screen.getByText("const value = 1")).toBeInTheDocument()
    expect(screen.queryByText("hidden html")).not.toBeInTheDocument()
  })
})
