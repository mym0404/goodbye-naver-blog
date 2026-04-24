import { sampleCorpus } from "../../src/shared/sample-corpus.js"
import {
  loadSampleFixture,
  renderSampleFixture,
} from "./lib/sample-fixtures.js"

const formatWarnings = (warnings: string[]) => warnings.join(" | ")

const expectedWarnings = ({
  sample,
  surface,
}: {
  sample: (typeof sampleCorpus)[number]
  surface: "parser" | "reviewer" | "render"
}) => sample.expectedWarnings?.[surface] ?? []

const run = async () => {
  const failures: string[] = []

  for (const sample of sampleCorpus) {
    const fixture = await loadSampleFixture(sample)
    const rendered = await renderSampleFixture({
      sample,
      html: fixture.html,
    })

    for (const expectedCapabilityLookupId of sample.expectedCapabilityLookupIds) {
      if (!rendered.observedCapabilityLookupIds.includes(expectedCapabilityLookupId)) {
        failures.push(`${sample.id}: missing expected capability lookup ${expectedCapabilityLookupId}`)
      }
    }

    if (rendered.normalizedMarkdown !== fixture.expectedMarkdown) {
      failures.push(`${sample.id}: rendered markdown does not match expected.md`)
    }

    const expectedParserWarnings = expectedWarnings({ sample, surface: "parser" })
    const expectedReviewerWarnings = expectedWarnings({ sample, surface: "reviewer" })
    const expectedRenderWarnings = expectedWarnings({ sample, surface: "render" })

    if (formatWarnings(rendered.parsedPost.warnings) !== formatWarnings(expectedParserWarnings)) {
      failures.push(
        `${sample.id}: parser warnings mismatch (expected: ${formatWarnings(expectedParserWarnings)}, actual: ${formatWarnings(rendered.parsedPost.warnings)})`,
      )
    }

    if (formatWarnings(rendered.reviewWarnings) !== formatWarnings(expectedReviewerWarnings)) {
      failures.push(
        `${sample.id}: reviewer warnings mismatch (expected: ${formatWarnings(expectedReviewerWarnings)}, actual: ${formatWarnings(rendered.reviewWarnings)})`,
      )
    }

    if (formatWarnings(rendered.rendered.warnings) !== formatWarnings(expectedRenderWarnings)) {
      failures.push(
        `${sample.id}: render warnings mismatch (expected: ${formatWarnings(expectedRenderWarnings)}, actual: ${formatWarnings(rendered.rendered.warnings)})`,
      )
    }

    if (rendered.normalizedMarkdown.includes("(undefined)")) {
      failures.push(`${sample.id}: rendered markdown must not contain undefined asset references`)
    }

    if (
      new Set(rendered.rendered.assetRecords.map((record) => record.reference)).size !==
      rendered.rendered.assetRecords.length
    ) {
      failures.push(`${sample.id}: asset records must not contain duplicate references`)
    }

    if (rendered.rendered.assetRecords.some((record) => !record.reference)) {
      failures.push(`${sample.id}: asset records must have a renderable reference`)
    }
  }

  if (failures.length > 0) {
    throw new Error(failures.join("\n"))
  }

  console.log(`samples:verify passed (${sampleCorpus.length} samples)`)
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
