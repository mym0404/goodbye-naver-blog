import type { ExportManifest } from "@exitpress/domain/export-job/schema/ExportManifest.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type { TemplateValue } from "@exitpress/domain/template/schema/TemplateValue.js"

export type OutputSupportFile = {
  relativePath: string
  content: string
}

export type OutputAdapter = {
  profile: ExportProfile
  contentRootSegments: string[]
  documentFileName: string
  formatPathSegment: (segment: string) => string
  prepareBlockProps: (props: Record<string, TemplateValue>) => Record<string, TemplateValue>
  formatAssetReference: (relativeAssetPath: string) => string
  renderDocument: (input: { frontmatter: string | null; body: string }) => string
  createSupportFiles: (manifest: ExportManifest) => OutputSupportFile[]
}
