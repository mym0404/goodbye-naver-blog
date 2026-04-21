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

type JobFilter = "all" | "warnings" | "errors"
type JobResultsMode = "running" | "upload" | "result"
type ProviderFormState = Record<string, string | boolean>

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

const trimProviderFields = (
  provider: UploadProviderDefinition | null,
  providerFields: ProviderFormState,
) =>
  Object.fromEntries(
    (provider?.fields ?? []).reduce<Array<readonly [string, UploadProviderValue]>>((entries, field) => {
      const rawValue = providerFields[field.key]

      if (field.inputType === "checkbox") {
        if (typeof rawValue === "boolean") {
          entries.push([field.key, rawValue] as const)
        }

        return entries
      }

      const value =
        typeof rawValue === "string"
          ? rawValue.trim()
          : rawValue === undefined || rawValue === null
            ? ""
            : String(rawValue).trim()

      if (!value) {
        return entries
      }

      if (field.inputType === "number") {
        const parsed = Number(value)

        if (Number.isFinite(parsed)) {
          entries.push([field.key, parsed] as const)
        }

        return entries
      }

      if (field.inputType === "select") {
        const selectedOption = field.options?.find((option) => String(option.value) === value)

        entries.push([field.key, selectedOption?.value ?? value] as const)
        return entries
      }

      entries.push([field.key, value] as const)
      return entries
    }, []),
  )

const hasMissingRequiredProviderField = (
  provider: UploadProviderDefinition | null,
  providerFields: ProviderFormState,
) =>
  (provider?.fields ?? []).some(
    (field) =>
      field.required &&
      (field.inputType === "checkbox"
        ? typeof providerFields[field.key] !== "boolean"
        : !String(providerFields[field.key] ?? "").trim()),
  )

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

const getUploadTargetItems = (job: ExportJobState | null) => {
  if (!job) {
    return []
  }

  return job.items.filter((item) => item.upload.candidateCount > 0)
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
      ? "bg-emerald-100 text-emerald-800"
      : status === "running" || status === "queued" || status === "uploading"
        ? "bg-amber-100 text-amber-800"
        : status === "failed" || status === "upload-failed"
          ? "bg-rose-100 text-rose-800"
          : status === "upload-ready"
            ? "bg-sky-100 text-sky-800"
            : "bg-slate-100 text-slate-600",
  )

const panelCopy: Record<JobResultsMode, { title: string; description: string }> = {
  running: {
    title: "실행 중",
    description: "진행률과 작업 로그를 확인합니다.",
  },
  upload: {
    title: "이미지 업로드",
    description: "업로드할 이미지와 재시도 상태를 확인합니다.",
  },
  result: {
    title: "결과",
    description: "최종 요약과 생성된 파일을 확인합니다.",
  },
}

const toProgressValue = (completed: number, total: number) =>
  total > 0 ? Math.round((completed / total) * 100) : 0

const buildUploadRowStatus = ({
  jobStatus,
  item,
}: {
  jobStatus: ExportJobState["status"] | undefined
  item: ExportJobState["items"][number]
}) => {
  if (jobStatus === "upload-failed") {
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
    key: "complete",
    label: "완료",
  } as const
}

const buildUploadPanelCopy = (job: ExportJobState | null) => {
  if (!job) {
    return "업로드 대상과 진행 상태를 같은 작업에서 이어서 확인합니다."
  }

  if (
    job.status === "uploading" &&
    job.upload.candidateCount > 0 &&
    job.upload.uploadedCount === job.upload.candidateCount
  ) {
    return "자산 업로드는 끝났고 결과 파일에 URL을 반영하는 중입니다."
  }

  if (job.status === "uploading") {
    return "업로드한 자산 수를 같은 작업에서 실시간으로 확인합니다."
  }

  if (job.status === "upload-failed") {
    return "업로드한 자산 수는 유지한 채 실패 상태를 확인하고 다시 시도할 수 있습니다."
  }

  if (job.status === "upload-completed") {
    return "업로드 결과와 대상별 상태를 최종 결과와 함께 확인합니다."
  }

  return "업로드 대상과 진행 상태를 같은 작업에서 이어서 확인합니다."
}

export const JobResultsPanel = ({
  mode,
  job,
  activeJobFilter,
  uploadSubmitting,
  uploadProviders,
  uploadProviderError,
  onFilterChange,
  onUploadStart,
}: {
  mode: JobResultsMode
  job: ExportJobState | null
  activeJobFilter: JobFilter
  uploadSubmitting: boolean
  uploadProviders: UploadProviderCatalogResponse
  uploadProviderError: string | null
  onFilterChange: (filter: JobFilter) => void
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
  const [githubUseJsDelivr, setGithubUseJsDelivr] = useState(false)
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
  const uploadTargetItems = getUploadTargetItems(job)
  const activeProviderDefinition =
    uploadProviders.providers.find((provider) => provider.key === providerKey) ?? null
  const activeProviderFields =
    providerFieldMap[providerKey] ?? buildInitialProviderFields(activeProviderDefinition)
  const showUploadPanel =
    (mode === "upload" || mode === "result") && (job?.upload.candidateCount ?? 0) > 0
  const showUploadForm =
    mode === "upload" &&
    (job?.status === "upload-ready" || job?.status === "upload-failed")
  const showExportResults = mode === "upload" || mode === "result"
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
    setGithubUseJsDelivr(false)
  }, [job?.id, uploadProviders])

  return (
    <Card
      className="board-card overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_60px_rgba(22,33,50,0.08)] backdrop-blur"
      id="status-panel"
    >
      <CardHeader className="panel-header gap-4 border-b border-slate-200/70 bg-white/70 p-6 sm:flex sm:items-start sm:justify-between">
        <div className="panel-heading space-y-2">
          <CardTitle className="section-title text-2xl font-semibold tracking-[-0.04em] text-slate-900">
            {panelCopy[mode].title}
          </CardTitle>
          <CardDescription className="panel-description max-w-3xl text-sm leading-7 text-slate-600">
            {panelCopy[mode].description}
          </CardDescription>
        </div>
        <Badge className={jobStatusClass(job?.status)} data-status={job?.status ?? "idle"}>
          {job?.status ?? "Idle"}
        </Badge>
      </CardHeader>

      <CardContent className="status-layout grid gap-5 p-6">
        {mode === "running" ? (
          <section className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold text-slate-900">수집 진행률</strong>
                <span className="text-sm text-slate-600">
                  {job?.progress.completed ?? 0} / {job?.progress.total ?? 0}
                </span>
              </div>
              <Progress
                id="running-progress"
                value={runningProgressValue}
                indicatorClassName="bg-sky-600"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">총 글</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.total ?? 0}</strong>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">완료</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.completed ?? 0}</strong>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">경고</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.warnings ?? 0}</strong>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">실패</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.failed ?? 0}</strong>
              </article>
            </div>
          </section>
        ) : null}

        {showUploadPanel ? (
          <section className="upload-panel grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-3 lg:flex lg:items-start lg:justify-between">
              <div>
                <CardDescription className="text-sm leading-7 text-slate-600">
                  {buildUploadPanelCopy(job)}
                </CardDescription>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <article className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">대상 글</span>
                  <strong className="text-lg font-semibold text-slate-900">{job?.upload.eligiblePostCount ?? 0}</strong>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">대상 자산</span>
                  <strong className="text-lg font-semibold text-slate-900">{job?.upload.candidateCount ?? 0}</strong>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">업로드 완료</span>
                  <strong className="text-lg font-semibold text-slate-900">{job?.upload.uploadedCount ?? 0}</strong>
                </article>
                <article className="rounded-2xl border border-slate-200 bg-white px-3 py-3 text-center">
                  <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">실패</span>
                  <strong className="text-lg font-semibold text-slate-900">{job?.upload.failedCount ?? 0}</strong>
                </article>
              </div>
            </div>

            <div className="grid gap-2 rounded-2xl border border-slate-200 bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <strong className="text-sm font-semibold text-slate-900">업로드 진행률</strong>
                <span className="text-sm text-slate-600">
                  {job?.upload.uploadedCount ?? 0} / {job?.upload.candidateCount ?? 0}
                </span>
              </div>
              <Progress
                id="upload-progress"
                value={uploadProgressValue}
                indicatorClassName="bg-emerald-600"
              />
            </div>

            <ScrollArea
              id="upload-targets-scroll"
              className="max-h-[28rem] rounded-[1.5rem] border border-slate-200 bg-white"
            >
              <Table id="upload-targets-table" className="w-full table-fixed">
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[52%]">글</TableHead>
                    <TableHead className="w-[24%]">자산</TableHead>
                    <TableHead className="w-[24%]">상태</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {uploadTargetItems.map((item) => {
                    const rowStatus = buildUploadRowStatus({
                      jobStatus: job?.status,
                      item,
                    })

                    return (
                      <TableRow
                        key={`upload:${item.id}`}
                        data-upload-row-id={item.id}
                        data-upload-row-status={rowStatus.key}
                      >
                        <TableCell className="min-w-0">
                          <div className="grid gap-0.5">
                            <strong className="truncate text-sm font-semibold text-slate-900">{item.title}</strong>
                            <span className="truncate text-xs text-slate-500">{item.outputPath ?? item.logNo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">
                          {item.upload.uploadedCount} / {item.upload.candidateCount}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className="rounded-full px-2.5 py-0.5"
                            data-upload-row-status-badge={rowStatus.key}
                          >
                            {rowStatus.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </ScrollArea>

            {showUploadForm ? (
              uploadProviderError ? (
                <p className="text-sm leading-7 text-rose-600">{uploadProviderError}</p>
              ) : uploadProviders.providers.length === 0 || !activeProviderDefinition ? (
                <p className="text-sm leading-7 text-slate-600">
                  PicList provider catalog를 불러오지 못했습니다.
                </p>
              ) : (
                <form
                  id="upload-form"
                  className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-white p-4"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    const normalizedProviderFields = trimProviderFields(
                      activeProviderDefinition,
                      activeProviderFields,
                    )

                    await onUploadStart({
                      providerKey,
                      providerFields: {
                        ...normalizedProviderFields,
                        ...(providerKey === "github" && githubUseJsDelivr
                          ? {
                              customUrl: buildGitHubJsDelivrCustomUrl({
                                repo: String(activeProviderFields.repo ?? ""),
                                branch: String(activeProviderFields.branch ?? ""),
                              }),
                            }
                          : {}),
                      },
                    })
                  }}
                >
                  <div className="grid gap-4 xl:grid-cols-[minmax(16rem,0.8fr)_minmax(0,1.2fr)] xl:items-start">
                    <label className="grid gap-2">
                      <span className="text-sm font-semibold text-slate-900">Provider</span>
                      <select
                        id="upload-providerKey"
                        className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
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
                        }}
                      >
                        {uploadProviders.providers.map((provider) => (
                          <option key={provider.key} value={provider.key}>
                            {provider.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {activeProviderDefinition.fields.map((field) => {
                        if (field.inputType === "checkbox") {
                          return (
                            <label
                              key={`${providerKey}:${field.key}`}
                              htmlFor={`upload-providerField-${field.key}`}
                              className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:col-span-2"
                            >
                              <input
                                id={`upload-providerField-${field.key}`}
                                className="size-[1.1rem] shrink-0 accent-primary"
                                type="checkbox"
                                checked={activeProviderFields[field.key] === true}
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
                                <span className="text-sm font-semibold text-slate-900">
                                  {field.label}
                                </span>
                                {field.placeholder ? (
                                  <span className="text-sm leading-6 text-slate-500">
                                    {field.placeholder}
                                  </span>
                                ) : null}
                              </span>
                            </label>
                          )
                        }

                        if (field.inputType === "select") {
                          return (
                            <label key={`${providerKey}:${field.key}`} className="grid gap-2">
                              <span className="text-sm font-semibold text-slate-900">
                                {field.label}
                              </span>
                              <select
                                id={`upload-providerField-${field.key}`}
                                className="h-10 rounded-xl border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-slate-400"
                                value={String(activeProviderFields[field.key] ?? "")}
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
                            </label>
                          )
                        }

                        return (
                          <label key={`${providerKey}:${field.key}`} className="grid gap-2">
                            <span className="text-sm font-semibold text-slate-900">{field.label}</span>
                            <Input
                              id={`upload-providerField-${field.key}`}
                              type={field.inputType}
                              value={String(activeProviderFields[field.key] ?? "")}
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
                          </label>
                        )
                      })}
                    </div>
                  </div>
                  {providerKey === "github" ? (
                    <label
                      htmlFor="upload-github-use-jsdelivr"
                      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                    >
                      <input
                        id="upload-github-use-jsdelivr"
                        className="size-[1.1rem] shrink-0 accent-primary"
                        type="checkbox"
                        checked={githubUseJsDelivr}
                        onChange={(event) => setGithubUseJsDelivr(event.target.checked)}
                      />
                      <span className="grid gap-1">
                        <span className="text-sm font-semibold text-slate-900">
                          jsDelivr CDN 사용
                        </span>
                        <span className="text-sm leading-6 text-slate-500">
                          {githubUseJsDelivr
                            ? buildGitHubJsDelivrCustomUrl({
                                repo: String(activeProviderFields.repo ?? ""),
                                branch: String(activeProviderFields.branch ?? ""),
                              }) || "Repository를 입력하면 jsDelivr 주소를 만듭니다."
                            : "기본 GitHub 업로드 URL을 사용합니다."}
                        </span>
                      </span>
                    </label>
                  ) : null}
                  <div className="flex justify-end">
                    <Button
                      id="upload-submit"
                      type="submit"
                      className="w-full rounded-xl sm:w-auto"
                      disabled={
                        uploadSubmitting ||
                        hasMissingRequiredProviderField(activeProviderDefinition, activeProviderFields)
                      }
                    >
                      {uploadSubmitting ? "업로드 시작 중..." : "업로드 시작"}
                    </Button>
                  </div>
                </form>
              )
            ) : null}

            {job?.upload.status === "skipped" ? (
              <p className="text-sm leading-7 text-slate-600">
                업로드할 로컬 이미지가 없어 내보내기만 완료되었습니다.
              </p>
            ) : null}

            {job?.status === "upload-failed" && job.error ? (
              <p className="text-sm leading-7 text-rose-600">{job.error}</p>
            ) : null}
          </section>
        ) : null}

        {showExportResults ? (
          <section className="grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">총 글</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.total ?? 0}</strong>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">완료</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.completed ?? 0}</strong>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">경고</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.warnings ?? 0}</strong>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">실패</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.progress.failed ?? 0}</strong>
              </article>
              <article className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
                <span className="block text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">업로드</span>
                <strong className="text-2xl font-semibold text-slate-900">{job?.upload.uploadedCount ?? 0}</strong>
              </article>
            </div>

            {job?.status === "failed" && job.error ? (
              <p className="text-sm leading-7 text-rose-600">{job.error}</p>
            ) : null}

            {job?.upload.status === "skipped" ? (
              <p className="text-sm leading-7 text-slate-600">
                업로드할 로컬 이미지가 없어 내보내기만 완료되었습니다.
              </p>
            ) : null}
          </section>
        ) : null}

        {showExportResults ? (
          <section className="job-results-panel grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="job-results-header grid gap-4 lg:flex lg:items-start lg:justify-between">
              <div>
                <CardDescription className="results-description text-sm leading-7 text-slate-600">
                  {mode === "upload"
                    ? "내보내기 결과를 먼저 확인한 뒤 업로드를 이어서 진행할 수 있습니다."
                    : "생성된 파일과 상태를 확인합니다."}
                </CardDescription>
              </div>
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
                  ? "완료된 결과가 여기에 표시됩니다."
                  : "현재 필터에 맞는 결과가 없습니다."}
              </div>
            ) : (
              <ScrollArea
                id="job-file-tree"
                className="job-file-tree job-file-tree-scroll max-h-[min(32rem,62vh)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white"
              >
                <Table className="w-full table-fixed">
                  <TableHeader className="sticky top-0 z-10">
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[36%]">파일</TableHead>
                      <TableHead className="w-[36%]">경로</TableHead>
                      <TableHead className="w-24">상태</TableHead>
                      <TableHead className="w-16">경고</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {jobItems.map((item) => {
                      const severity = buildJobItemSeverity(item)
                      const pathMeta = buildJobItemPathMeta(item)
                      const meta = severityMeta[severity]

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
                          data-severity={severity}
                        >
                          <TableCell className="min-w-0 align-top">
                            <div
                              className="job-results-row grid min-h-0 w-full min-w-0 whitespace-normal rounded-xl px-2 py-1.5 text-left"
                              data-job-item-id={item.id}
                              data-severity={severity}
                            >
                              <span className="grid min-w-0 gap-0.5">
                                <strong className="break-all text-sm font-semibold text-slate-900">
                                  {pathMeta.fileLabel}
                                </strong>
                                <span className="whitespace-normal break-words text-xs leading-5 text-slate-500">
                                  {item.title}
                                </span>
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top text-xs text-slate-600">
                            <div className="grid gap-0.5">
                              <span className="whitespace-normal break-all leading-5">
                                {pathMeta.directoryLabel}
                              </span>
                              <span className="whitespace-normal break-all text-slate-400">
                                {pathMeta.outputLabel}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="align-top">
                            <Badge
                              className="min-w-16 justify-center rounded-full px-2.5 py-0.5"
                              variant={severity === "success" ? "secondary" : meta.badge}
                            >
                              {meta.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="align-top text-sm font-medium text-slate-700">
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
