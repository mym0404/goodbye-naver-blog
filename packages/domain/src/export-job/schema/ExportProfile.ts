export const allExportProfiles = ["gfm", "fumadocs", "docusaurus", "nextra"] as const

// Document output profile selected by export requests.
export type ExportProfile = (typeof allExportProfiles)[number]

export const isExportProfile = (value: unknown): value is ExportProfile =>
  allExportProfiles.some((profile) => profile === value)
