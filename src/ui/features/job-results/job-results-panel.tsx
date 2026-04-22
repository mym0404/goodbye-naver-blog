import { RiExternalLinkLine } from "@remixicon/react"
import { useEffect, useRef, useState } from "react"

import type {
  ExportJobState,
  UploadProviderCatalogResponse,
  UploadProviderDefinition,
  UploadProviderValue,
} from "../../../shared/types.js"

import { Badge } from "../../components/ui/badge.js"
import { Button } from "../../components/ui/button.js"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card.js"
import { Input } from "../../components/ui/input.js"
import { Progress } from "../../components/ui/progress.js"
import { ScrollArea } from "../../components/ui/scroll-area.js"
import { Separator } from "../../components/ui/separator.js"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../components/ui/table.js"
import { cn } from "../../lib/cn.js"
import {
  buildInitialProviderUiState,
  getUploadProviderFieldRule,
  hasMissingRequiredUploadProviderField,
  trimProviderFieldsForSubmit,
  type ProviderFormState,
  type ProviderUiState,
} from "./upload-provider-form-rules.js"

type JobFilter = "all" | "warnings" | "errors"
type JobResultsMode = "running" | "upload" | "result"

const INDEX_MARKDOWN_FILE = "index.md"

const getPreferredDefaultProviderKey = (catalog: UploadProviderCatalogResponse) =>
  catalog.providers.find((provider) => provider.key === "github")?.key ??
  catalog.defaultProviderKey ??
  catalog.providers[0]?.key ??
  ""

const buildInitialProviderFields = (provider: UploadProviderDefinition | null): ProviderFormState =>
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

const buildInitialProviderFieldMap = (catalog: UploadProviderCatalogResponse) =>
  Object.fromEntries(
    catalog.providers.map((provider) => [provider.key, buildInitialProviderFields(provider)]),
  ) as Record<string, ProviderFormState>

const buildInitialProviderUiStateMap = (catalog: UploadProviderCatalogResponse) =>
  Object.fromEntries(
    catalog.providers.map((provider) => [provider.key, buildInitialProviderUiState()]),
  ) as Record<string, ProviderUiState>

const buildGitHubJsDelivrCustomUrl = ({
  repo,
  branch,
}: {
  repo: string
  branch: string
}) => {
  const normalizedRepo = repo
    .trim()
    .replace(/^\/+|\/+$/g, "")
  const normalizedBranch = branch.trim()

  if (!normalizedRepo) {
    return ""
  }

  return `https://cdn.jsdelivr.net/gh/${normalizedRepo}${normalizedBranch ? `@${normalizedBranch}` : ""}`
}

const buildJobItemSeverity = (item: ExportJobState["items"][number]) => {
  if (item.status === "failed" || item.error) {
    return "error"
  }

  if (item.warningCount > 0) {
    return "warning"
  }

  return "success"
}

const getJobItems = (job: ExportJobState | null) => {
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

const buildJobItemPathMeta = (
  item: Pick<ExportJobState["items"][number], "logNo" | "outputPath">,
) => {
  const pathSegments = splitOutputPath(item.outputPath)

  if (pathSegments.length === 0) {
    return {
      fileLabel: `${item.logNo}.diagnostics`,
      directoryLabel: "failed",
      outputLabel: "diagnostics only",
    }
  }

  const fileName = pathSegments.at(-1) ?? `${item.logNo}.diagnostics`
  const isIndexMarkdown = fileName === INDEX_MARKDOWN_FILE
  const postFolderName = isIndexMarkdown ? pathSegments.at(-2) : null
  const directorySegments = pathSegments.slice(0, isIndexMarkdown ? -2 : -1)

  return {
    fileLabel: postFolderName || fileName,
    directoryLabel: directorySegments.length > 0 ? directorySegments.join(" / ") : "root",
    outputLabel: item.outputPath ?? "diagnostics only",
  }
}

const severityMeta = {
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

const jobStatusClass = (status: string | undefined) =>
  cn(
    "status-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
    status === "completed" || status === "upload-completed" || status === "ready"
      ? "status-pill--success"
      : status === "upload-ready"
        ? "status-pill--ready"
        : status === "running" || status === "queued" || status === "uploading"
          ? "status-pill--running"
          : status === "failed" || status === "upload-failed"
            ? "status-pill--error"
            : "status-pill--idle",
  )

const panelCopy: Record<JobResultsMode, { title: string; description: string }> = {
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

const toProgressValue = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0

const CompactMetrics = ({
  items,
  className,
}: {
  items: Array<{ label: string; value: string }>
  className?: string
}) => (
  <div
    className={cn(
      "flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1.5 text-sm leading-6 text-muted-foreground",
      className,
    )}
  >
    {items.map((item) => (
      <span
        key={item.label}
        className="inline-flex min-w-0 max-w-full flex-wrap items-baseline gap-x-1.5 gap-y-0.5"
      >
        <span className="shrink-0 text-muted-foreground">{item.label}</span>
        <strong className="metric-value min-w-0 break-all font-semibold">{item.value}</strong>
      </span>
    ))}
  </div>
)

const buildUploadRowStatus = ({
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

  if (item.upload.uploadedCount < item.upload.candidateCount) {
    return {
      key: "partial",
      label: "부분 완료",
    } as const
  }

  return {
    key: "partial",
    label: "부분 완료",
  } as const
}

const uploadRowBadgeClass = (status: "pending" | "partial" | "complete" | "failed") =>
  cn(
    "rounded-full border px-2.5 py-0.5",
    status === "pending"
      ? "upload-badge--pending"
      : status === "partial"
        ? "upload-badge--partial"
        : status === "complete"
          ? "upload-badge--complete"
          : "upload-badge--failed",
  )

const shouldShowUploadColumns = (job: ExportJobState | null) =>
  job?.request.options.assets.imageHandlingMode === "download-and-upload" ||
  job?.upload.status !== "not-requested"

const buildResultsPanelDescription = () => ""

const buildUploadPanelCopy = () => ""

const buildUploadedLinkMeta = (item: ExportJobState["items"][number]) =>
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

export const JobResultsPanel = ({
  mode,
  job,
  activeJobFilter,
  resumeSubmitting,
  uploadSubmitting,
  uploadProviders,
  uploadProviderError,
  onFilterChange,
  onResumeExport,
  onUploadStart,
}: {
  mode: JobResultsMode
  job: ExportJobState | null
  activeJobFilter: JobFilter
  resumeSubmitting: boolean
  uploadSubmitting: boolean
  uploadProviders: UploadProviderCatalogResponse
  uploadProviderError: string | null
  onFilterChange: (filter: JobFilter) => void
  onResumeExport: () => Promise<void> | void
  onUploadStart: (input: {
    providerKey: string
    providerFields: Record<string, UploadProviderValue>
  }) => Promise<void> | void
}) => {
  const logsScrollAreaRef = useRef<HTMLDivElement | null>(null)
  const [providerKey, setProviderKey] = useState(() => getPreferredDefaultProviderKey(uploadProviders))
  const [providerFieldMap, setProviderFieldMap] = useState<Record<string, ProviderFormState>>(() =>
    buildInitialProviderFieldMap(uploadProviders),
  )
  const [providerUiStateMap, setProviderUiStateMap] = useState<Record<string, ProviderUiState>>(() =>
    buildInitialProviderUiStateMap(uploadProviders),
  )
  const jobItems = getJobItems(job).filter((item) => {
    const severity = buildJobItemSeverity(item)

    if (activeJobFilter === "warnings") {
      return severity === "warning"
    }

    if (activeJobFilter === "errors") {
      return severity === "error"
    }

    return true
  })
  const activeProviderDefinition =
    uploadProviders.providers.find((provider) => provider.key === providerKey) ?? null
  const activeProviderFields =
    providerFieldMap[providerKey] ?? buildInitialProviderFields(activeProviderDefinition)
  const activeProviderUiState =
    providerUiStateMap[providerKey] ?? buildInitialProviderUiState()
  const githubUseJsDelivr = activeProviderUiState.githubUseJsDelivr
  const githubJsDelivrUrl = buildGitHubJsDelivrCustomUrl({
    repo: String(activeProviderFields.repo ?? ""),
    branch: String(activeProviderFields.branch ?? ""),
  })
  const showUploadColumns = shouldShowUploadColumns(job)
  const showUploadPanel =
    (mode === "upload" || mode === "result") && (job?.upload.candidateCount ?? 0) > 0
  const showUploadForm =
    mode === "upload" &&
    (job?.status === "upload-ready" ||
      job?.status === "upload-failed" ||
      (job?.status === "uploading" && job.resumeAvailable))
  const showResumeExportButton =
    mode === "running" && job?.status === "running" && job.resumeAvailable
  const showExportSummary = mode === "upload" || mode === "result"
  const showExportResults = mode === "running" || mode === "upload" || mode === "result"
  const latestLogSignature = (() => {
    const lastEntry = job?.logs.at(-1)

    if (!lastEntry) {
      return "empty"
    }

    return `${job?.logs.length ?? 0}:${lastEntry.timestamp}:${lastEntry.message}`
  })()
  const runningProgressValue = toProgressValue(job?.progress.completed ?? 0, job?.progress.total ?? 0)
  const uploadProgressValue = toProgressValue(
    job?.upload.uploadedCount ?? 0,
    job?.upload.candidateCount ?? 0,
  )

  useEffect(() => {
    const viewport = logsScrollAreaRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')

    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight
  }, [latestLogSignature])

  useEffect(() => {
    if (!job?.id) {
      return
    }

    setProviderKey(getPreferredDefaultProviderKey(uploadProviders))
    setProviderFieldMap(buildInitialProviderFieldMap(uploadProviders))
    setProviderUiStateMap(buildInitialProviderUiStateMap(uploadProviders))
  }, [job?.id, uploadProviders])

  return (
    <Card
      variant="panel"
      className="board-card overflow-hidden"
      id="status-panel"
    >
      <CardHeader className="panel-header gap-4 p-6 sm:flex sm:items-start sm:justify-between">
        <div className="panel-heading space-y-2">
          <CardTitle className="section-title text-2xl">
            {panelCopy[mode].title}
          </CardTitle>
          {panelCopy[mode].description ? (
            <CardDescription className="panel-description max-w-3xl text-sm leading-7">
              {panelCopy[mode].description}
            </CardDescription>
          ) : null}
        </div>
        <Badge className={jobStatusClass(job?.status)} data-status={job?.status ?? "idle"}>
          {job?.status ?? "Idle"}
        </Badge>
      </CardHeader>

      <CardContent className="status-layout grid gap-5 p-6">
        {mode === "running" ? (
          <section className="subtle-panel grid gap-4 rounded-[1.5rem] p-4">
            <div className="field-card grid gap-2 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold text-foreground">수집 진행률</strong>
                <span className="text-sm text-muted-foreground">
                  {job?.progress.completed ?? 0} / {job?.progress.total ?? 0}
                </span>
              </div>
              <Progress
                id="running-progress"
                value={runningProgressValue}
                indicatorClassName="bg-[var(--status-running-fg)]"
              />
            </div>
            <CompactMetrics
              items={[
                { label: "총 글", value: String(job?.progress.total ?? 0) },
                { label: "완료", value: String(job?.progress.completed ?? 0) },
                { label: "경고", value: String(job?.progress.warnings ?? 0) },
                { label: "실패", value: String(job?.progress.failed ?? 0) },
              ]}
              className="field-card rounded-2xl px-4 py-3"
            />
            {showResumeExportButton ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color-mix(in_srgb,var(--status-running-fg)_25%,transparent)] bg-[var(--status-running-bg)] px-4 py-3">
                <p className="info-copy text-sm leading-6">
                  이전 export 상태를 복구했습니다. 남은 글만 이어서 처리합니다.
                </p>
                <Button
                  id="resume-export-submit"
                  type="button"
                  className="rounded-xl"
                  disabled={resumeSubmitting}
                  onClick={() => {
                    void onResumeExport()
                  }}
                >
                  {resumeSubmitting ? "재개 중..." : "남은 작업 계속"}
                </Button>
              </div>
            ) : null}
          </section>
        ) : null}

        {showUploadPanel ? (
          <section className="upload-panel subtle-panel grid gap-4 rounded-[1.5rem] p-4">
            <div className="grid gap-3 lg:flex lg:items-start lg:justify-between">
              {buildUploadPanelCopy() ? (
                <div>
                  <CardDescription className="text-sm leading-7 text-muted-foreground">
                    {buildUploadPanelCopy()}
                  </CardDescription>
                </div>
              ) : null}
              <CompactMetrics
                items={[
                  { label: "대상 글", value: String(job?.upload.eligiblePostCount ?? 0) },
                  { label: "대상 자산", value: String(job?.upload.candidateCount ?? 0) },
                  { label: "업로드 완료", value: String(job?.upload.uploadedCount ?? 0) },
                  { label: "실패", value: String(job?.upload.failedCount ?? 0) },
                ]}
                className="field-card rounded-2xl px-4 py-3 lg:max-w-[32rem] lg:justify-end"
              />
            </div>

            <div className="field-card grid gap-2 rounded-2xl p-4">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold text-foreground">업로드 진행률</strong>
                <span className="text-sm text-muted-foreground">
                  {job?.upload.uploadedCount ?? 0} / {job?.upload.candidateCount ?? 0}
                </span>
              </div>
              <Progress
                id="upload-progress"
                value={uploadProgressValue}
                indicatorClassName="bg-[var(--status-ready-fg)]"
              />
            </div>

            {showUploadForm ? (
              uploadProviderError ? (
                <p className="danger-copy text-sm leading-7">{uploadProviderError}</p>
              ) : uploadProviders.providers.length === 0 || !activeProviderDefinition ? (
                <p className="text-sm leading-7 text-muted-foreground">업로드 설정을 불러오지 못했습니다.</p>
              ) : (
                <form
                  id="upload-form"
                  className="field-card grid gap-4 rounded-[1.5rem] p-4"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    const normalizedProviderFields = trimProviderFieldsForSubmit({
                      provider: activeProviderDefinition,
                      providerFields: activeProviderFields,
                      providerUiState: activeProviderUiState,
                    })

                    await onUploadStart({
                      providerKey,
                      providerFields: {
                        ...normalizedProviderFields,
                        ...(providerKey === "github" && githubUseJsDelivr
                          ? {
                              customUrl: githubJsDelivrUrl,
                            }
                          : {}),
                      },
                    })
                  }}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)] xl:items-start">
                    <div className="grid gap-2">
                      <label
                        htmlFor="upload-providerKey"
                        className="text-sm font-semibold text-foreground"
                      >
                        Provider
                      </label>
                      <select
                        id="upload-providerKey"
                        className="h-10 rounded-xl px-3 text-sm"
                        aria-describedby="upload-providerKey-description"
                        value={providerKey}
                        onChange={(event) => {
                          const nextProviderKey = event.target.value
                          setProviderKey(nextProviderKey)
                          setProviderFieldMap((current) =>
                            current[nextProviderKey]
                              ? current
                              : {
                                  ...current,
                                  [nextProviderKey]: buildInitialProviderFields(
                                    uploadProviders.providers.find(
                                      (provider) => provider.key === nextProviderKey,
                                    ) ?? null,
                                  ),
                                },
                          )
                          setProviderUiStateMap((current) =>
                            current[nextProviderKey]
                              ? current
                              : {
                                  ...current,
                                  [nextProviderKey]: buildInitialProviderUiState(),
                                },
                          )
                        }}
                      >
                        {uploadProviders.providers.map((provider) => (
                          <option key={provider.key} value={provider.key}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                      <p
                        id="upload-providerKey-description"
                        className="text-sm leading-6 text-muted-foreground"
                      >
                        {activeProviderDefinition.description}
                      </p>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {providerKey === "alistplist" ? (
                        <div className="subtle-panel grid gap-2 rounded-2xl px-4 py-3 sm:col-span-2">
                          <span className="text-sm font-semibold text-foreground">Authentication</span>
                          <span className="text-sm leading-6 text-muted-foreground">
                            AList는 Token 또는 계정 인증 중 하나만 사용합니다.
                          </span>
                          <div className="flex flex-wrap gap-3">
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <input
                                type="radio"
                                name="upload-alist-auth-mode"
                                checked={activeProviderUiState.alistAuthMode === "token"}
                                onChange={() =>
                                  setProviderUiStateMap((current) => ({
                                    ...current,
                                    [providerKey]: {
                                      ...activeProviderUiState,
                                      alistAuthMode: "token",
                                    },
                                  }))
                                }
                              />
                              Token
                            </label>
                            <label className="flex items-center gap-2 text-sm text-foreground">
                              <input
                                type="radio"
                                name="upload-alist-auth-mode"
                                checked={activeProviderUiState.alistAuthMode === "account"}
                                onChange={() =>
                                  setProviderUiStateMap((current) => ({
                                    ...current,
                                    [providerKey]: {
                                      ...activeProviderUiState,
                                      alistAuthMode: "account",
                                    },
                                  }))
                                }
                              />
                              Username + Password
                            </label>
                          </div>
                        </div>
                      ) : null}
                      {activeProviderDefinition.fields.map((field) => {
                        const fieldInputId = `upload-providerField-${field.key}`
                        const fieldDescriptionId = `${fieldInputId}-description`
                        const fieldDisabledReasonId = `${fieldInputId}-disabled-reason`
                        const rule = getUploadProviderFieldRule({
                          providerKey,
                          field,
                          providerFields: activeProviderFields,
                          providerUiState: activeProviderUiState,
                        })
                        const fieldDescribedBy = rule.disabledReason
                          ? `${fieldDescriptionId} ${fieldDisabledReasonId}`
                          : fieldDescriptionId

                        if (field.inputType === "checkbox") {
                          return (
                            <div
                              key={`${providerKey}:${field.key}`}
                              className={`subtle-panel flex items-center gap-3 rounded-2xl px-4 py-3 sm:col-span-2 ${rule.disabled ? "opacity-70" : ""}`}
                            >
                              <input
                                id={fieldInputId}
                                className="size-[1.1rem] shrink-0 accent-primary"
                                type="checkbox"
                                checked={activeProviderFields[field.key] === true}
                                disabled={rule.disabled}
                                aria-describedby={fieldDescribedBy}
                                onChange={(event) =>
                                  setProviderFieldMap((current) => ({
                                    ...current,
                                    [providerKey]: {
                                      ...(current[providerKey] ??
                                        buildInitialProviderFields(activeProviderDefinition)),
                                      [field.key]: event.target.checked,
                                    },
                                  }))
                                }
                              />
                              <span className="grid gap-1">
                                <label
                                  htmlFor={fieldInputId}
                                  className="text-sm font-semibold text-foreground"
                                >
                                  {field.label}
                                </label>
                                <span
                                  id={fieldDescriptionId}
                                  className="text-sm leading-6 text-muted-foreground"
                                >
                                  {rule.description}
                                </span>
                                {rule.disabledReason ? (
                                  <span
                                    id={fieldDisabledReasonId}
                                    className="warning-copy text-sm leading-6"
                                  >
                                    {rule.disabledReason}
                                  </span>
                                ) : field.placeholder ? (
                                  <span className="text-sm leading-6 text-muted-foreground">
                                    {field.placeholder}
                                  </span>
                                ) : null}
                              </span>
                            </div>
                          )
                        }

                        if (field.inputType === "select") {
                          return (
                            <div key={`${providerKey}:${field.key}`} className="grid gap-2">
                              <label htmlFor={fieldInputId} className="text-sm font-semibold text-foreground">
                                {field.label}
                              </label>
                              <span id={fieldDescriptionId} className="text-sm leading-6 text-muted-foreground">
                                {rule.description}
                              </span>
                              <select
                                id={fieldInputId}
                                className="h-10 rounded-xl px-3 text-sm"
                                value={String(activeProviderFields[field.key] ?? "")}
                                disabled={rule.disabled}
                                aria-describedby={fieldDescribedBy}
                                onChange={(event) =>
                                  setProviderFieldMap((current) => ({
                                    ...current,
                                    [providerKey]: {
                                      ...(current[providerKey] ??
                                        buildInitialProviderFields(activeProviderDefinition)),
                                      [field.key]: event.target.value,
                                    },
                                  }))
                                }
                              >
                                {!field.required ? <option value="">선택 안 함</option> : null}
                                {(field.options ?? []).map((option) => (
                                  <option key={`${field.key}:${option.value}`} value={String(option.value)}>
                                    {option.label}
                                  </option>
                                ))}
                              </select>
                              {rule.disabledReason ? (
                                <span
                                  id={fieldDisabledReasonId}
                                  className="warning-copy text-sm leading-6"
                                >
                                  {rule.disabledReason}
                                </span>
                              ) : null}
                            </div>
                          )
                        }

                        return (
                          <div key={`${providerKey}:${field.key}`} className="grid gap-2">
                            <label htmlFor={fieldInputId} className="text-sm font-semibold text-foreground">
                              {field.label}
                            </label>
                            <span id={fieldDescriptionId} className="text-sm leading-6 text-muted-foreground">
                              {rule.description}
                            </span>
                            <Input
                              id={fieldInputId}
                              type={field.inputType}
                              value={String(activeProviderFields[field.key] ?? "")}
                              disabled={rule.disabled}
                              aria-describedby={fieldDescribedBy}
                              onChange={(event) =>
                                setProviderFieldMap((current) => ({
                                  ...current,
                                  [providerKey]: {
                                    ...(current[providerKey] ??
                                      buildInitialProviderFields(activeProviderDefinition)),
                                    [field.key]: event.target.value,
                                  },
                                }))
                              }
                              placeholder={field.placeholder}
                            />
                            {rule.disabledReason ? (
                              <span
                                id={fieldDisabledReasonId}
                                className="warning-copy text-sm leading-6"
                              >
                                {rule.disabledReason}
                              </span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                  {providerKey === "github" ? (
                    <div
                      className="subtle-panel flex items-center gap-3 rounded-2xl px-4 py-3"
                    >
                      <input
                        id="upload-github-use-jsdelivr"
                        className="size-[1.1rem] shrink-0 accent-primary"
                        type="checkbox"
                        checked={githubUseJsDelivr}
                        aria-describedby="upload-github-use-jsdelivr-description"
                        onChange={(event) =>
                          setProviderUiStateMap((current) => ({
                            ...current,
                            [providerKey]: {
                              ...activeProviderUiState,
                              githubUseJsDelivr: event.target.checked,
                            },
                          }))
                        }
                      />
                      <span className="grid gap-1">
                        <label
                          htmlFor="upload-github-use-jsdelivr"
                          className="text-sm font-semibold text-foreground"
                        >
                          jsDelivr CDN 사용
                        </label>
                        <span
                          id="upload-github-use-jsdelivr-description"
                          className="text-sm leading-6 text-muted-foreground"
                        >
                          {githubUseJsDelivr
                            ? githubJsDelivrUrl || "Repository를 입력하면 jsDelivr 주소를 만듭니다."
                            : "기본 GitHub 업로드 URL을 사용합니다."}
                        </span>
                      </span>
                    </div>
                  ) : null}
                  {providerKey === "github" && githubUseJsDelivr ? (
                    <div className="grid gap-2">
                      <label
                        htmlFor="upload-github-jsdelivr-preview"
                        className="text-sm font-semibold text-foreground"
                      >
                        자동 Custom URL
                      </label>
                      <Input
                        id="upload-github-jsdelivr-preview"
                        value={githubJsDelivrUrl}
                        readOnly
                        aria-describedby="upload-github-jsdelivr-preview-description"
                        placeholder="Repository와 Branch를 입력하면 미리보기가 보입니다."
                      />
                      <span
                        id="upload-github-jsdelivr-preview-description"
                        className="text-sm leading-6 text-muted-foreground"
                      >
                        jsDelivr 주소는 제출 시 Custom URL로 자동 적용됩니다.
                      </span>
                    </div>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      id="upload-submit"
                      type="submit"
                      className="w-full rounded-xl sm:w-auto"
                      disabled={
                        uploadSubmitting ||
                        hasMissingRequiredUploadProviderField({
                          provider: activeProviderDefinition,
                          providerFields: activeProviderFields,
                          providerUiState: activeProviderUiState,
                        })
                      }
                    >
                      {uploadSubmitting
                        ? "업로드 시작 중..."
                        : job?.status === "uploading" && job.resumeAvailable
                          ? "남은 업로드 계속"
                          : "업로드 시작"}
                    </Button>
                  </div>
                </form>
              )
            ) : null}

            {job?.upload.status === "skipped" ? (
              <p className="text-sm leading-7 text-muted-foreground">
                업로드할 로컬 이미지가 없어 내보내기만 완료되었습니다.
              </p>
            ) : null}

            {job?.status === "upload-failed" && job.error ? (
              <p className="danger-copy text-sm leading-7">{job.error}</p>
            ) : null}
          </section>
        ) : null}

        {showExportSummary ? (
          <section className="subtle-panel grid gap-4 rounded-[1.5rem] p-4">
            <CompactMetrics
              items={[
                { label: "총 글", value: String(job?.progress.total ?? 0) },
                { label: "완료", value: String(job?.progress.completed ?? 0) },
                { label: "경고", value: String(job?.progress.warnings ?? 0) },
                { label: "실패", value: String(job?.progress.failed ?? 0) },
                { label: "업로드", value: String(job?.upload.uploadedCount ?? 0) },
              ]}
              className="field-card rounded-2xl px-4 py-3"
            />

            {job?.status === "failed" && job.error ? (
              <p className="danger-copy text-sm leading-7">{job.error}</p>
            ) : null}

            {job?.upload.status === "skipped" ? (
              <p className="text-sm leading-7 text-muted-foreground">
                업로드할 로컬 이미지가 없어 내보내기만 완료되었습니다.
              </p>
            ) : null}
          </section>
        ) : null}

        {showExportResults ? (
          <section className="job-results-panel grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="job-results-header grid gap-4 lg:flex lg:items-start lg:justify-between">
              {buildResultsPanelDescription() ? (
                <div>
                  <CardDescription className="results-description text-sm leading-7 text-slate-600">
                    {buildResultsPanelDescription()}
                  </CardDescription>
                </div>
              ) : null}
              <div
                className="job-filter-group flex flex-wrap items-center gap-2"
                role="tablist"
                aria-label="완료 리스트 필터"
              >
                {(["all", "warnings", "errors"] as const).map((filter) => (
                  <Button
                    key={filter}
                    type="button"
                    variant={activeJobFilter === filter ? "outline" : "ghost"}
                    className={`job-filter-button min-w-16 rounded-full px-4 ${activeJobFilter === filter ? "is-active border-slate-400 bg-white" : "text-slate-600"}`}
                    data-job-filter={filter}
                    onClick={() => onFilterChange(filter)}
                  >
                    {filter === "all" ? "전체" : filter === "warnings" ? "경고" : "에러"}
                  </Button>
                ))}
              </div>
            </div>

            {jobItems.length === 0 ? (
              <div
                id="job-file-tree"
                className="job-file-tree empty grid min-h-28 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500"
              >
                {activeJobFilter === "all"
                  ? mode === "running"
                    ? "완료된 결과가 아직 없습니다."
                    : "완료된 결과가 여기에 표시됩니다."
                  : "현재 필터에 맞는 결과가 없습니다."}
              </div>
            ) : (
              <ScrollArea
                id="job-file-tree"
                className="job-file-tree job-file-tree-scroll max-h-[min(32rem,62vh)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white"
              >
                <Table
                  className={cn(
                    "w-full text-[11px] sm:text-xs",
                    showUploadColumns ? "min-w-[44rem] table-auto" : "table-fixed",
                  )}
                >
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className={showUploadColumns ? "w-[11rem] text-[10px] sm:text-[11px]" : "w-[36%] text-[10px] sm:text-[11px]"}>파일</TableHead>
                      <TableHead className={showUploadColumns ? "w-[12rem] text-[10px] sm:text-[11px]" : "w-[36%] text-[10px] sm:text-[11px]"}>경로</TableHead>
                      {showUploadColumns ? <TableHead className="w-[6.5rem] text-[10px] sm:text-[11px]">업로드</TableHead> : null}
                      {showUploadColumns ? <TableHead className="w-[5.5rem] text-[10px] sm:text-[11px]">업로드 상태</TableHead> : null}
                      <TableHead className="w-20 text-[10px] sm:text-[11px]">상태</TableHead>
                      <TableHead className="w-14 text-[10px] sm:text-[11px]">경고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobItems.map((item) => {
                      const severity = buildJobItemSeverity(item)
                      const pathMeta = buildJobItemPathMeta(item)
                      const meta = severityMeta[severity]
                      const externalPreviewUrl = item.externalPreviewUrl?.trim()
                      const hasUploadCandidate = item.upload.candidateCount > 0
                      const uploadRowStatus =
                        showUploadColumns && hasUploadCandidate
                          ? buildUploadRowStatus({
                              jobStatus: job?.status,
                              item,
                            })
                          : null
                      const uploadedLinks =
                        showUploadColumns && hasUploadCandidate ? buildUploadedLinkMeta(item) : []

                      return (
                        <TableRow
                          key={item.id}
                          className={cn(
                            "last:border-b-0",
                            severity === "warning"
                              ? "bg-amber-50/20"
                              : severity === "error"
                                ? "bg-rose-50/20"
                                : "",
                          )}
                          data-upload-row-id={showUploadColumns && hasUploadCandidate ? item.id : undefined}
                          data-upload-row-status={uploadRowStatus?.key}
                          data-severity={severity}
                        >
                          <TableCell className="min-w-0 align-top">
                            <div
                              className="job-results-row grid min-h-0 w-full min-w-0 whitespace-normal rounded-xl px-1.5 py-1 text-left"
                              data-job-item-id={item.id}
                              data-severity={severity}
                            >
                              <span className="grid min-w-0 gap-0.5">
                                <strong className="break-words text-[12px] font-semibold leading-5 text-slate-900 sm:text-sm">
                                  {pathMeta.fileLabel}
                                </strong>
                                {externalPreviewUrl ? (
                                  <a
                                    href={externalPreviewUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex w-fit items-center gap-1 text-[10px] font-medium text-sky-700 underline underline-offset-2 sm:text-xs"
                                    data-job-item-preview-link
                                    aria-label={`${item.title} 미리보기`}
                                  >
                                    <RiExternalLinkLine className="size-[0.9rem]" aria-hidden="true" />
                                    <span>미리보기</span>
                                  </a>
                                ) : null}
                                <span className="whitespace-normal break-words text-[11px] leading-5 text-slate-500 sm:text-xs">
                                  {item.title}
                                </span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-[11px] text-slate-600 sm:text-xs">
                            <div className="grid gap-0.5">
                              <span className="whitespace-normal break-words leading-5">
                                {pathMeta.directoryLabel}
                              </span>
                              <span className="whitespace-normal break-words text-slate-400">
                                {pathMeta.outputLabel}
                              </span>
                            </div>
                          </TableCell>
                          {showUploadColumns ? (
                            <TableCell className="align-top text-[11px] text-slate-700 sm:text-xs">
                              {hasUploadCandidate ? (
                                <div className="grid gap-1">
                                  <span>
                                    {item.upload.uploadedCount} / {item.upload.candidateCount}
                                  </span>
                                  {uploadedLinks.length > 0 ? (
                                    <div className="flex flex-wrap gap-1.5 text-[10px] sm:text-xs">
                                      {uploadedLinks.map((link) => (
                                        <a
                                          key={`${item.id}:${link.label}`}
                                          href={link.url}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="font-medium text-sky-700 underline underline-offset-2"
                                        >
                                          {link.label}
                                        </a>
                                      ))}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </TableCell>
                          ) : null}
                          {showUploadColumns ? (
                            <TableCell className="align-top">
                              {uploadRowStatus ? (
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[10px] sm:text-[11px]",
                                    uploadRowBadgeClass(uploadRowStatus.key),
                                  )}
                                  data-upload-row-status-badge={uploadRowStatus.key}
                                >
                                  {uploadRowStatus.label}
                                </Badge>
                              ) : (
                                <span className="text-sm text-slate-400">-</span>
                              )}
                            </TableCell>
                          ) : null}
                          <TableCell className="align-top">
                            <Badge
                              className="min-w-14 justify-center rounded-full px-2 py-0.5 text-[10px] sm:min-w-16 sm:px-2.5 sm:text-[11px]"
                              variant={severity === "success" ? "secondary" : meta.badge}
                            >
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top text-[11px] font-medium text-slate-700 sm:text-xs">
                            {item.warningCount > 0 ? item.warningCount : "0"}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </section>
        ) : null}

        <section className="logs-panel grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
          <div className="logs-header grid gap-3">
            <div>
              <CardDescription className="results-description text-sm leading-7 text-slate-600">
                작업 로그
              </CardDescription>
            </div>
          </div>
          <Separator />
          <ScrollArea
            id="logs"
            ref={logsScrollAreaRef}
            className="logs-scroll h-[min(28rem,56vh)] overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950"
            aria-live="polite"
          >
            <div className="logs grid min-h-full gap-1.5 bg-slate-950 px-4 py-4 font-mono text-[0.88rem] text-slate-100">
              {(job?.logs ?? []).map((entry, index) => (
                <div
                  key={`${entry.timestamp}-${index}`}
                  className="grid gap-0.5 border-b border-slate-800/80 pb-1.5 last:border-b-0 last:pb-0"
                  data-job-log-entry
                >
                  <span
                    className="text-[11px] leading-5 text-slate-500"
                    data-job-log-timestamp
                  >
                    {entry.timestamp}
                  </span>
                  <span
                    className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-100"
                    data-job-log-message
                  >
                    {entry.message}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </section>
      </CardContent>
    </Card>
  )
}
