import { describe, expect, it } from "vitest"

import {
  getParserCapabilityId,
  getParserCapabilityLookupIds,
  parserCapabilities,
} from "../src/shared/parser-capabilities.js"

describe("parserCapabilities", () => {
  it("does not declare rawHtml as a parser capability", () => {
    expect(parserCapabilities.some((capability) => capability.id.includes("rawHtml"))).toBe(false)
    expect(parserCapabilities.some((capability) => capability.blockType === "paragraph")).toBe(true)
  })

  it("does not attach representative unsupported case rules", () => {
    expect(
      parserCapabilities.some((capability) =>
        Object.hasOwn(capability, "unsupportedBlockCaseResolutions"),
      ),
    ).toBe(false)
  })

  it("reports capability lookup ids from structured blocks only", () => {
    const lookupIds = getParserCapabilityLookupIds({
      editorVersion: 3,
      blocks: [
        { type: "paragraph", text: "intro" },
        { type: "divider" },
        { type: "paragraph", text: "body" },
      ],
      warnings: ["SE3 블록을 구조화하지 못해 원본 HTML로 보존했습니다: se_component se_oglink"],
    })

    expect(lookupIds).toEqual([
      getParserCapabilityId({ editorVersion: 3, blockType: "paragraph" }),
      getParserCapabilityId({ editorVersion: 3, blockType: "divider" }),
    ])
  })
})
