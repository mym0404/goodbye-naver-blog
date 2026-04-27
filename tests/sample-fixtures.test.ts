import { describe, expect, it } from "vitest"

import {
  listSampleFixtures,
  loadSampleFixture,
  renderSampleFixture,
} from "../scripts/harness/lib/sample-fixtures.js"

const samples = await listSampleFixtures()

describe("sample fixtures", () => {
  it("discovers fixture directories", () => {
    expect(samples.length).toBeGreaterThan(0)
  })

  describe.each(samples)("$id", (sample) => {
    it("renders the expected markdown", async () => {
      const fixture = await loadSampleFixture(sample)
      const rendered = await renderSampleFixture({
        sample,
        html: fixture.html,
      })

      expect(rendered.normalizedMarkdown).toBe(fixture.expectedMarkdown)
      expect(rendered.normalizedMarkdown).not.toContain("(undefined)")
      expect(new Set(rendered.rendered.assetRecords.map((record) => record.reference)).size).toBe(
        rendered.rendered.assetRecords.length,
      )
      expect(rendered.rendered.assetRecords.some((record) => !record.reference)).toBe(false)
    })
  })
})
