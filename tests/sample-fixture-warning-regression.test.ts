import { describe, expect, it } from "vitest"

import { sampleCorpus } from "../src/shared/sample-corpus.js"

describe("sample fixture unsupported warning regression", () => {
  it("does not use representative unsupported case lookup ids", () => {
    expect(
      sampleCorpus.flatMap((sample) =>
        sample.expectedCapabilityLookupIds.filter((lookupId) => lookupId.startsWith("case:")),
      ),
    ).toEqual([])
  })
})
