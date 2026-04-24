import { describe, expect, it } from "vitest"

import { unsupportedBlockFixtureEvidence } from "../scripts/harness/lib/unsupported-block-fixture-evidence.js"

describe("unsupported block fixture evidence", () => {
  it("keeps representative unsupported fixture evidence disabled", () => {
    expect(unsupportedBlockFixtureEvidence).toEqual([])
  })
})
