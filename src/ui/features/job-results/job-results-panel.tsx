import { useEffect, useRef, useState } from 'react';

import type { ExportJobState } from '../../../shared/types.js';

import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.js';
import { Input } from '../../components/ui/input.js';
import { ScrollArea } from '../../components/ui/scroll-area.js';
import { Separator } from '../../components/ui/separator.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table.js';
import { cn } from '../../lib/cn.js';

type JobFilter = 'all' | 'warnings' | 'errors';

const INDEX_MARKDOWN_FILE = 'index.md';

const buildJobItemSeverity = (item: ExportJobState["items"][number]) => {
  if (item.status === 'failed' || item.error) {
    return 'error';
  }

  if (item.warningCount > 0) {
    return 'warning';
  }

  return 'success';
};

const getJobItems = (job: ExportJobState | null) => {
  if (!job || !Array.isArray(job.items)) {
    return [];
  }

  return job.items;
};

const getUploadTargetItems = (job: ExportJobState | null) => {
  if (!job) {
    return [];
  }

  return job.items.filter((item) => item.upload.candidateCount > 0);
};

const splitOutputPath = (outputPath: string | null) => {
  if (!outputPath) {
    return [];
  }

  return outputPath.split('/').filter(Boolean);
};

const buildJobItemPathMeta = (item: Pick<ExportJobState["items"][number], 'logNo' | 'outputPath'>) => {
  const pathSegments = splitOutputPath(item.outputPath);

  if (pathSegments.length === 0) {
    return {
      fileLabel: `${item.logNo}.diagnostics`,
      directoryLabel: 'failed',
      outputLabel: 'diagnostics only',
    };
  }

  const fileName = pathSegments.at(-1) ?? `${item.logNo}.diagnostics`;
  const isIndexMarkdown = fileName === INDEX_MARKDOWN_FILE;
  const postFolderName = isIndexMarkdown ? pathSegments.at(-2) : null;
  const directorySegments = pathSegments.slice(0, isIndexMarkdown ? -2 : -1);

  return {
    fileLabel: postFolderName || fileName,
    directoryLabel: directorySegments.length > 0 ? directorySegments.join(' / ') : 'root',
    outputLabel: item.outputPath ?? 'diagnostics only',
  };
};

const severityMeta = {
  success: {
    badge: 'secondary' as const,
    label: '정상',
    iconClass: 'ri-file-text-line',
  },
  warning: {
    badge: 'outline' as const,
    label: '경고',
    iconClass: 'ri-alert-line',
  },
  error: {
    badge: 'destructive' as const,
    label: '에러',
    iconClass: 'ri-error-warning-line',
  },
};

const jobStatusClass = (status: string | undefined) =>
  cn(
    'status-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
    status === 'completed' || status === 'upload-completed' || status === 'ready'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'running' || status === 'queued' || status === 'uploading'
        ? 'bg-amber-100 text-amber-800'
        : status === 'failed' || status === 'upload-failed'
          ? 'bg-rose-100 text-rose-800'
          : status === 'upload-ready'
            ? 'bg-sky-100 text-sky-800'
          : 'bg-slate-100 text-slate-600',
  );

export const JobResultsPanel = ({
  job,
  activeJobFilter,
  uploadSubmitting,
  onFilterChange,
  onUploadStart,
}: {
  job: ExportJobState | null;
  activeJobFilter: JobFilter;
  uploadSubmitting: boolean;
  onFilterChange: (filter: JobFilter) => void;
  onUploadStart: (input: {
    uploaderKey: string;
    uploaderConfigJson: string;
  }) => Promise<void> | void;
}) => {
  const logsScrollAreaRef = useRef<HTMLDivElement | null>(null)
  const [uploaderKey, setUploaderKey] = useState('')
  const [uploaderConfigJson, setUploaderConfigJson] = useState('')
  const jobItems = getJobItems(job).filter((item) => {
    const severity = buildJobItemSeverity(item);

    if (activeJobFilter === 'warnings') {
      return severity === 'warning';
    }

    if (activeJobFilter === 'errors') {
      return severity === 'error';
    }

    return true;
  });
  const uploadTargetItems = getUploadTargetItems(job);
  const showUploadSection = Boolean(
    job && (job.upload.candidateCount > 0 || job.upload.status === 'skipped'),
  );
  const latestLogSignature = (() => {
    const lastEntry = job?.logs.at(-1)

    if (!lastEntry) {
      return 'empty'
    }

    return `${job?.logs.length ?? 0}:${lastEntry.timestamp}:${lastEntry.message}`
  })()

  useEffect(() => {
    const viewport = logsScrollAreaRef.current?.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')

    if (!viewport) {
      return
    }

    viewport.scrollTop = viewport.scrollHeight
  }, [latestLogSignature])

  return (
    <>
      <Card
        className="board-card overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_60px_rgba(22,33,50,0.08)] backdrop-blur"
        id="status-panel"
      >
        <CardHeader className="panel-header gap-4 border-b border-slate-200/70 bg-white/70 p-6 sm:flex sm:items-start sm:justify-between">
          <div className="panel-heading space-y-2">
            <CardTitle className="section-title text-2xl font-semibold tracking-[-0.04em] text-slate-900">
              작업 상태
            </CardTitle>
            <CardDescription className="panel-description max-w-3xl text-sm leading-7 text-slate-600">
              결과와 로그를 확인합니다.
            </CardDescription>
          </div>
          <Badge
            className={jobStatusClass(job?.status)}
            data-status={job?.status ?? 'idle'}
          >
            {job?.status ?? 'Idle'}
          </Badge>
        </CardHeader>

        <CardContent className="status-layout grid gap-5 p-6">
          {showUploadSection ? (
            <section className="upload-panel grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="grid gap-3 lg:flex lg:items-start lg:justify-between">
                <div>
                  <CardDescription className="text-sm leading-7 text-slate-600">
                    업로드 대상과 진행 상태를 같은 작업에서 이어서 확인합니다.
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

              <div className="overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                <Table id="upload-targets-table" className="w-full table-fixed">
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="w-[52%]">글</TableHead>
                      <TableHead className="w-[24%]">자산</TableHead>
                      <TableHead className="w-[24%]">상태</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {uploadTargetItems.map((item) => (
                      <TableRow key={`upload:${item.id}`}>
                        <TableCell className="min-w-0">
                          <div className="grid gap-0.5">
                            <strong className="truncate text-sm font-semibold text-slate-900">{item.title}</strong>
                            <span className="truncate text-xs text-slate-500">{item.outputPath ?? item.logNo}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-700">{item.upload.candidateCount}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="rounded-full px-2.5 py-0.5">
                            {job?.status === 'upload-completed'
                              ? '완료'
                              : job?.status === 'uploading'
                                ? '업로드 중'
                                : job?.status === 'upload-failed'
                                  ? '실패'
                                  : '대기'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {job?.status === 'upload-ready' ? (
                <form
                  className="grid gap-3 rounded-[1.5rem] border border-slate-200 bg-white p-4 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)_auto]"
                  onSubmit={async (event) => {
                    event.preventDefault()
                    await onUploadStart({
                      uploaderKey,
                      uploaderConfigJson,
                    })
                  }}
                >
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-900">uploaderKey</span>
                    <Input
                      id="upload-uploaderKey"
                      value={uploaderKey}
                      onChange={(event) => setUploaderKey(event.target.value)}
                      placeholder="github"
                    />
                  </label>
                  <label className="grid gap-2">
                    <span className="text-sm font-semibold text-slate-900">uploaderConfigJson</span>
                    <textarea
                      id="upload-uploaderConfigJson"
                      className="min-h-24 rounded-2xl border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none ring-0 focus:border-slate-400"
                      value={uploaderConfigJson}
                      onChange={(event) => setUploaderConfigJson(event.target.value)}
                      placeholder='{"repo":"owner/name"}'
                    />
                  </label>
                  <div className="flex items-end">
                    <Button
                      id="upload-submit"
                      type="submit"
                      className="w-full rounded-xl md:w-auto"
                      disabled={uploadSubmitting || !uploaderKey.trim() || !uploaderConfigJson.trim()}
                    >
                      {uploadSubmitting ? '업로드 시작 중...' : '업로드 시작'}
                    </Button>
                  </div>
                </form>
              ) : null}

              {job?.upload.status === 'skipped' ? (
                <p className="text-sm leading-7 text-slate-600">
                  업로드할 로컬 이미지가 없어 export만 완료되었습니다.
                </p>
              ) : null}

              {job?.status === 'upload-failed' && job.error ? (
                <p className="text-sm leading-7 text-rose-600">{job.error}</p>
              ) : null}
            </section>
          ) : null}

          <div className="results-grid grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <section className="job-results-panel grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="job-results-header grid gap-4 lg:flex lg:items-start lg:justify-between">
                <div>
                  <CardDescription className="results-description text-sm leading-7 text-slate-600">
                    생성된 파일과 상태를 확인합니다.
                  </CardDescription>
                </div>
                <div
                  className="job-filter-group flex flex-wrap items-center gap-2"
                  role="tablist"
                  aria-label="완료 리스트 필터"
                >
                  {(['all', 'warnings', 'errors'] as const).map((filter) => (
                    <Button
                      key={filter}
                      type="button"
                      variant={activeJobFilter === filter ? 'outline' : 'ghost'}
                      className={`job-filter-button min-w-16 rounded-full px-4 ${activeJobFilter === filter ? 'is-active border-slate-400 bg-white' : 'text-slate-600'}`}
                      data-job-filter={filter}
                      onClick={() => onFilterChange(filter)}
                    >
                      {filter === 'all'
                        ? '전체'
                        : filter === 'warnings'
                          ? '경고'
                          : '에러'}
                    </Button>
                  ))}
                </div>
              </div>

              {jobItems.length === 0 ? (
                <div
                  id="job-file-tree"
                  className="job-file-tree empty grid min-h-28 place-items-center rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-6 text-center text-sm text-slate-500"
                >
                  {activeJobFilter === 'all'
                    ? '완료된 결과가 여기에 표시됩니다.'
                    : '현재 필터에 맞는 결과가 없습니다.'}
                </div>
              ) : (
                <ScrollArea
                  id="job-file-tree"
                  className="job-file-tree job-file-tree-scroll h-[min(32rem,62vh)] overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white"
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
                        const severity = buildJobItemSeverity(item);
                        const pathMeta = buildJobItemPathMeta(item);
                        const meta = severityMeta[severity];

                        return (
                          <TableRow
                            key={item.id}
                            className={cn(
                              'last:border-b-0',
                              severity === 'warning'
                                ? 'bg-amber-50/20'
                                : severity === 'error'
                                  ? 'bg-rose-50/20'
                                  : '',
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
                                variant={
                                  severity === 'success'
                                    ? 'secondary'
                                    : meta.badge
                                }
                              >
                                {meta.label}
                              </Badge>
                            </TableCell>
                            <TableCell className="align-top text-sm font-medium text-slate-700">
                              {item.warningCount > 0 ? item.warningCount : '0'}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </ScrollArea>
              )}
            </section>

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
          </div>
        </CardContent>
      </Card>
    </>
  );
};
