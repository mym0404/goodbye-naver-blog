import type {
  ExportJobPollingConfig,
  ExportJobState,
  ExportOptions,
  ExportResumeSummary,
  FrontmatterFieldMeta,
  FrontmatterFieldName,
  EditorBlockOutputDefinition,
  OptionDescriptionMap,
  ScanResult,
  ThemePreference,
  UploadProviderCatalogResponse,
} from "../../shared/Types.js"

export type ExportBootstrapResponse = {
  profile: "gfm"
  options: ExportOptions
  lastOutputDir: string
  themePreference: ThemePreference
  jobPolling?: ExportJobPollingConfig
  resumedJob: ExportJobState | null
  resumeSummary: ExportResumeSummary | null
  resumedScanResult: ScanResult | null
  frontmatterFieldOrder: FrontmatterFieldName[]
  frontmatterFieldMeta: Record<FrontmatterFieldName, FrontmatterFieldMeta>
  optionDescriptions: OptionDescriptionMap
  blockOutputDefinitions: EditorBlockOutputDefinition[]
}

export type ExportResumeLookupResponse = {
  resumedJob: ExportJobState | null
  resumeSummary: ExportResumeSummary | null
  resumedScanResult: ScanResult | null
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

const readErrorMessage = async (response: Response) => {
  try {
    const body = (await response.json()) as {
      error?: string
    }

    return body.error ?? `request failed: ${response.status}`
  } catch {
    return `request failed: ${response.status}`
  }
}

export const postJson = <T>(input: RequestInfo | URL, body: unknown) =>
  fetchJson<T>(input, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

export const postJsonNoContent = async (input: RequestInfo | URL, body: unknown) => {
  const response = await fetch(input, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export const postSameOriginJsonNoContent = async (input: RequestInfo | URL, body: unknown) => {
  const response = await fetch(input, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(await readErrorMessage(response))
  }
}

export const postSameOriginJson = async <T>(input: RequestInfo | URL, body: unknown): Promise<T> => {
  const response = await fetch(input, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-requested-with": "XMLHttpRequest",
    },
    body: JSON.stringify(body),
  })

  const responseBody = (await response.json()) as T & {
    error?: string
  }

  if (!response.ok) {
    throw new Error(responseBody.error ?? `request failed: ${response.status}`)
  }

  return responseBody
}

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
