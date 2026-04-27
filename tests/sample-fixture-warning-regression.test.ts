import { describe, expect, it } from "vitest"

import { sampleCorpus } from "../src/shared/SampleCorpus.js"

describe("sample fixture unsupported warning regression", () => {
  it("does not use representative unsupported parser block ids", () => {
    expect(
      sampleCorpus.flatMap((sample) =>
        sample.expectedParserBlockIds.filter((parserBlockId) => parserBlockId.startsWith("case:")),
      ),
    ).toEqual([])
  })
})
