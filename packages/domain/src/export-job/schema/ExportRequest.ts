import type { ExportOptions } from "../../export-options/schema/ExportOptions.js"
import type { UploadProviderFields } from "../../upload/schema/UploadProvider.js"

import type { ExportProfile } from "./ExportProfile.js"

export { allExportProfiles } from "./ExportProfile.js"
export type { ExportProfile } from "./ExportProfile.js"

export type ExportUploadProviderRequest = {
  providerKey: string
  providerFields: UploadProviderFields
}

// Request body used to start an export job.
export type ExportRequest = {
  blogKey: string
  sourceInput: string
  outputDir: string
  profile: ExportProfile
  options: ExportOptions
  uploadProvider?: ExportUploadProviderRequest
}
