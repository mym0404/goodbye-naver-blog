import { Box } from "@primer/react"

import type { PostSummary } from "@exitpress/domain/blog/schema/BlogScan.js"
import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import type {
  ExportOptions,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
} from "@exitpress/domain/export-options/schema/ExportOptions.js"
import type { ThemePreference } from "@exitpress/domain/preferences/schema/ThemePreference.js"
import type { BlockTemplateDefinition } from "@exitpress/domain/template/schema/BlockTemplateDefinition.js"
import type { ReactNode } from "react"

import type { ExportOptionsStep } from "./ExportOptionsSteps.js"

import { AssetsOptionsStep } from "./AssetsOptionsStep.js"
import { MarkdownOptionsStep } from "./BlockTemplateOptions.js"
import { DiagnosticsOptionsStep } from "./DiagnosticsOptionsStep.js"
import { FrontmatterOptionsStep } from "./FrontmatterOptionsStep.js"
import { LinksOptionsStep } from "./LinksOptionsStep.js"
import { StructureOptionsStep } from "./StructureOptionsStep.js"

export const ExportOptionsPanel = ({
  step,
  outputDir,
  options,
  profile = "gfm",
  themePreference,
  optionDescriptions,
  blockTemplateDefinitions = [],
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  frontmatterValidationErrors,
  linkTemplatePreviewPost,
  onOptionsChange,
}: {
  step: ExportOptionsStep
  outputDir: string
  options: ExportOptions
  profile?: ExportProfile
  themePreference: ThemePreference
  optionDescriptions: Record<string, string>
  blockTemplateDefinitions?: BlockTemplateDefinition[]
  frontmatterFieldOrder: FrontmatterFieldName[]
  frontmatterFieldMeta: Record<FrontmatterFieldName, FrontmatterFieldMeta>
  frontmatterValidationErrors: string[]
  linkTemplatePreviewPost?: Pick<
    PostSummary,
    "blogKey" | "sourceId" | "postId" | "title" | "publishedAt" | "categoryName"
  > | null
  onOptionsChange: (updater: (current: ExportOptions) => ExportOptions) => void
}) => {
  const description = (key: string) => optionDescriptions[key]
  const contentByStep: Record<ExportOptionsStep, ReactNode> = {
    structure: (
      <StructureOptionsStep
        outputDir={outputDir}
        options={options}
        description={description}
        themePreference={themePreference}
        onOptionsChange={onOptionsChange}
      />
    ),
    frontmatter: (
      <FrontmatterOptionsStep
        options={options}
        description={description}
        frontmatterFieldOrder={frontmatterFieldOrder}
        frontmatterFieldMeta={frontmatterFieldMeta}
        frontmatterValidationErrors={frontmatterValidationErrors}
        onOptionsChange={onOptionsChange}
      />
    ),
    markdown: (
      <MarkdownOptionsStep
        options={options}
        profile={profile}
        blockTemplateDefinitions={blockTemplateDefinitions}
        themePreference={themePreference}
        onOptionsChange={onOptionsChange}
      />
    ),
    assets: (
      <AssetsOptionsStep
        options={options}
        description={description}
        onOptionsChange={onOptionsChange}
      />
    ),
    links: (
      <LinksOptionsStep
        options={options}
        description={description}
        linkTemplatePreviewPost={linkTemplatePreviewPost}
        themePreference={themePreference}
        onOptionsChange={onOptionsChange}
      />
    ),
    diagnostics: (
      <DiagnosticsOptionsStep
        options={options}
        description={description}
        onOptionsChange={onOptionsChange}
      />
    ),
  }
  const formContent = (
    <Box id="export-form" sx={{ display: "grid", gap: 4 }}>
      {contentByStep[step]}
    </Box>
  )

  return <Box id="export-panel">{formContent}</Box>
}
