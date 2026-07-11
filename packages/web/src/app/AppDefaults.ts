import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
} from "@exitpress/domain/export-options/ExportOptions.js"

import type { ExportBootstrapResponse } from "../lib/Api.js"

import { defaultOutputDir } from "../features/scan/ScanStatus.js"

export const defaultBlogKey = "naver"

export const fallbackDefaults: ExportBootstrapResponse = {
  blogs: [
    { key: "naver", label: "Naver" },
    { key: "tistory", label: "Tistory" },
  ],
  profile: "gfm",
  options: defaultExportOptions(),
  lastOutputDir: defaultOutputDir,
  themePreference: "dark",
  resumedJob: null,
  resumeSummary: null,
  resumedScanResult: null,
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  optionDescriptions,
  blockTemplateDefinitions: [],
}
