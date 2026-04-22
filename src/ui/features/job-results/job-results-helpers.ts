import type {
  ExportJobState,
  UploadProviderCatalogResponse,
  UploadProviderDefinition,
} from "../../../shared/types.js"
import {
  DEFAULT_UPLOAD_PROVIDER_KEY,
  EMPTY_SELECT_VALUE,
  UPLOAD_PROVIDER_KEYS,
} from "../../../shared/upload-provider-keys.js"
import type { ProviderFormState } from "./upload-provider-form-rules.js"

const INDEX_MARKDOWN_FILE = "index.md"

export type JobFilter = "all" | "warnings" | "errors"
export type JobResultsMode = "running" | "upload" | "result"
export type JobItemSeverity = "success" | "warning" | "error"
export type UploadRowStatus = "pending" | "partial" | "complete" | "failed"

export const severityMeta = {
  success: {
    badge: "secondary" as const,
    label: "정상",
  },
  warning: {
    badge: "outline" as const,
    label: "경고",
  },
  error: {
    badge: "destructive" as const,
    label: "에러",
  },
}

export const panelCopy: Record<JobResultsMode, { title: string; description: string }> = {
  running: {
    title: "실행 중",
    description: "",
  },
  upload: {
    title: "Image Upload",
    description: "",
  },
  result: {
    title: "결과",
    description: "",
  },
}

export const getPreferredDefaultProviderKey = (catalog: UploadProviderCatalogResponse) =>
  catalog.providers.find((provider) => provider.key === DEFAULT_UPLOAD_PROVIDER_KEY)?.key ??
  catalog.defaultProviderKey ??
  catalog.providers[0]?.key ??
  ""

export const buildInitialProviderFields = (provider: UploadProviderDefinition | null): ProviderFormState =>
  Object.fromEntries(
    (provider?.fields ?? []).map((field) => {
      if (field.inputType === "checkbox") {
        return [field.key, field.defaultValue === true]
      }

      if (
        field.inputType === "select" &&
        field.required &&
        (field.defaultValue === null || field.defaultValue === undefined)
      ) {
        return [field.key, String(field.options?.[0]?.value ?? "")]
      }

      if (field.defaultValue === null || field.defaultValue === undefined) {
        return [field.key, ""]
      }

      return [field.key, String(field.defaultValue)]
    }),
  )

export const buildInitialProviderFieldMap = (catalog: UploadProviderCatalogResponse) =>
  Object.fromEntries(
    catalog.providers.map((provider) => [provider.key, buildInitialProviderFields(provider)]),
  ) as Record<string, ProviderFormState>

export const buildGitHubJsDelivrCustomUrl = ({
  repo,
  branch,
}: {
  repo: string
  branch: string
}) => {
  const normalizedRepo = repo.trim().replace(/^\/+|\/+$/g, "")
  const normalizedBranch = branch.trim()

  if (!normalizedRepo) {
    return ""
  }

  return `https://cdn.jsdelivr.net/gh/${normalizedRepo}${normalizedBranch ? `@${normalizedBranch}` : ""}`
}

export const buildJobItemSeverity = (item: ExportJobState["items"][number]): JobItemSeverity => {
  if (item.status === "failed" || item.error) {
    return "error"
  }

  if (item.warningCount > 0) {
    return "warning"
  }

  return "success"
}

export const getJobItems = (job: ExportJobState | null) => {
  if (!job || !Array.isArray(job.items)) {
    return []
  }

  return job.items
}

const splitOutputPath = (outputPath: string | null) => {
  if (!outputPath) {
    return []
  }

  return outputPath.split("/").filter(Boolean)
}

export const buildJobItemPathMeta = (
  item: Pick<ExportJobState["items"][number], "logNo" | "outputPath">,
) => {
  const pathSegments = splitOutputPath(item.outputPath)

  if (pathSegments.length === 0) {
    return {
      fileLabel: `${item.logNo}.diagnostics`,
    }
  }

  const fileName = pathSegments.at(-1) ?? `${item.logNo}.diagnostics`
  const isIndexMarkdown = fileName === INDEX_MARKDOWN_FILE
  const postFolderName = isIndexMarkdown ? pathSegments.at(-2) : null

  return {
    fileLabel: postFolderName || fileName,
  }
}

const normalizeLocalPath = (value: string) =>
  value.replace(/\\/g, "/").replace(/\/{2,}/g, "/")

export const buildLocalOutputPath = ({
  outputDir,
  outputPath,
}: {
  outputDir: string
  outputPath: string | null
}) => {
  if (!outputPath) {
    return null
  }

  const normalizedOutputDir = normalizeLocalPath(outputDir.trim()).replace(/\/$/, "")
  const normalizedOutputPath = normalizeLocalPath(outputPath).replace(/^\.\//, "")

  if (!normalizedOutputDir) {
    return normalizedOutputPath
  }

  return normalizeLocalPath(`${normalizedOutputDir}/${normalizedOutputPath}`)
}

export const toProgressValue = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0

export const buildUploadRowStatus = ({
  jobStatus,
  item,
}: {
  jobStatus: ExportJobState["status"] | undefined
  item: ExportJobState["items"][number]
}) => {
  if (item.upload.rewriteStatus === "completed") {
    return {
      key: "complete",
      label: "완료",
    } as const
  }

  if (item.upload.rewriteStatus === "failed" || jobStatus === "upload-failed") {
    return {
      key: "failed",
      label: "실패",
    } as const
  }

  if (item.upload.uploadedCount <= 0) {
    return {
      key: "pending",
      label: "대기",
    } as const
  }

  return {
    key: item.upload.uploadedCount < item.upload.candidateCount ? "partial" : "complete",
    label: item.upload.uploadedCount < item.upload.candidateCount ? "부분 완료" : "완료",
  } as const
}

export const shouldShowUploadColumns = (job: ExportJobState | null) =>
  job?.request.options.assets.imageHandlingMode === "download-and-upload" ||
  job?.upload.status !== "not-requested"

export const buildUploadedLinkMeta = (item: ExportJobState["items"][number]) =>
  (Array.isArray(item.upload.uploadedUrls) ? item.upload.uploadedUrls : []).reduce<
    Array<{ label: string; url: string }>
  >((entries, url, index) => {
    try {
      const parsed = new URL(url)

      if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        return entries
      }
    } catch {
      return entries
    }

    entries.push({
      label: `#${index + 1}`,
      url,
    })
    return entries
  }, [])

export const isGitHubProvider = (providerKey: string) => providerKey === UPLOAD_PROVIDER_KEYS.GITHUB
export const isAListProvider = (providerKey: string) => providerKey === UPLOAD_PROVIDER_KEYS.ALIST
export const getEmptySelectValue = () => EMPTY_SELECT_VALUE
