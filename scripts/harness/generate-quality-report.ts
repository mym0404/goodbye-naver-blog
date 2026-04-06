import { writeUtf8, repoPath } from "./lib/paths.js"
import { buildGeneratedDocs } from "./lib/report-generation.js"

const run = async () => {
  const generated = await buildGeneratedDocs()

  await writeUtf8({
    targetPath: repoPath("docs", "generated", "quality-score.md"),
    content: generated.qualityScore,
  })
  await writeUtf8({
    targetPath: repoPath("docs", "generated", "sample-coverage.md"),
    content: generated.sampleCoverage,
  })

  console.log("quality:report updated docs/generated/quality-score.md and docs/generated/sample-coverage.md")
}

void run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
