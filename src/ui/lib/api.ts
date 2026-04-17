import type {
  ExportJobState,
  ExportOptions,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
  OptionDescriptionMap,
  PostSummary,
} from "../../shared/types.js"

export type ExportDefaultsResponse = {
  profile: "gfm"
  options: ExportOptions
  frontmatterFieldOrder: FrontmatterFieldName[]
  frontmatterFieldMeta: Record<FrontmatterFieldName, FrontmatterFieldMeta>
  optionDescriptions: OptionDescriptionMap
}

export type ExportPreviewResult = {
  candidatePost: PostSummary
  markdown: string
  markdownFilePath: string
  editorVersion: number
  blockTypes: string[]
  parserWarnings: string[]
  reviewerWarnings: string[]
  renderWarnings: string[]
  assetPaths: string[]
}

export const fetchJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, init)
  const body = (await response.json()) as T & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(body.error ?? `request failed: ${response.status}`)
  }

  return body
}

export const postJson = <T>(input: RequestInfo | URL, body: unknown) =>
  fetchJson<T>(input, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

export const postUploadJson = <T>(input: RequestInfo | URL, body: unknown) =>
  fetchJson<T>(input, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  })

export type ExportJobResponse = Pick<ExportJobState, "id" | "status">
