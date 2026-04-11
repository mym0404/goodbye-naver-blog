import type { ExportJobItem, ExportJobState } from '../../../shared/types.js';

import { Badge } from '../../components/ui/badge.js';
import { Button } from '../../components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../../components/ui/card.js';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog.js';
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
import { MarkdownDocument } from '../../lib/markdown.js';
import { cn } from '../../lib/cn.js';

type JobFilter = 'all' | 'warnings' | 'errors';

const buildJobItemSeverity = (item: ExportJobItem) => {
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

const buildModalMarkdown = (item: ExportJobItem) => {
  if (item.markdown) {
    return item.markdown;
  }

  if (item.error) {
    return `> ❌ Error: ${item.error}`;
  }

  if (item.warningCount > 0) {
    return item.warnings
      .map((warning) => `> ⚠️ Warning: ${warning}`)
      .join('\n\n');
  }

  return '표시할 Markdown이 없습니다.';
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
    status === 'completed' || status === 'ready'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'running' || status === 'queued'
        ? 'bg-amber-100 text-amber-800'
        : status === 'failed'
          ? 'bg-rose-100 text-rose-800'
          : 'bg-slate-100 text-slate-600',
  );

export const JobResultsPanel = ({
  job,
  selectedItem,
  activeJobFilter,
  onFilterChange,
  onItemSelect,
  onModalClose,
}: {
  job: ExportJobState | null;
  selectedItem: ExportJobItem | null;
  activeJobFilter: JobFilter;
  onFilterChange: (filter: JobFilter) => void;
  onItemSelect: (item: ExportJobItem) => void;
  onModalClose: () => void;
}) => {
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
          <div className="results-grid grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(20rem,0.8fr)]">
            <section className="job-results-panel grid gap-4 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4">
              <div className="job-results-header grid gap-4 lg:flex lg:items-start lg:justify-between">
                <div>
                  <CardDescription className="results-description text-sm leading-7 text-slate-600">
                    파일을 눌러 내용을 확인합니다.
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
                  <Table className="min-w-[58rem]">
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="hover:bg-transparent">
                        <TableHead className="w-[26rem]">파일</TableHead>
                        <TableHead>경로</TableHead>
                        <TableHead className="w-28">상태</TableHead>
                        <TableHead className="w-20">경고</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {jobItems.map((item) => {
                        const severity = buildJobItemSeverity(item);
                        const fileLabel =
                          item.outputPath?.split('/').pop() ??
                          `${item.logNo}.diagnostics`;
                        const groupKey =
                          item.outputPath
                            ?.split('/')
                            .slice(0, -1)
                            .join(' / ') || 'failed';
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
                            <TableCell className="min-w-0">
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="job-results-row inline-flex h-auto min-h-0 w-full items-start justify-start rounded-xl px-2 py-1.5 text-left hover:bg-slate-100"
                                data-job-item-id={item.id}
                                data-severity={severity}
                                onClick={() => onItemSelect(item)}
                              >
                                <span className="grid min-w-0 gap-0.5">
                                  <strong className="truncate text-sm font-semibold text-slate-900">
                                    {fileLabel}
                                  </strong>
                                  <span className="truncate text-xs text-slate-500">
                                    {item.title}
                                  </span>
                                </span>
                              </Button>
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              <div className="grid gap-0.5">
                                <span className="truncate">{groupKey}</span>
                                <span className="truncate text-slate-400">
                                  {item.outputPath ?? 'diagnostics only'}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
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
                            <TableCell className="text-sm font-medium text-slate-700">
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
                className="logs-scroll h-[min(28rem,56vh)] overflow-hidden rounded-[1.5rem] border border-slate-800 bg-slate-950"
                aria-live="polite"
              >
                <pre className="logs min-h-full bg-slate-950 px-4 py-4 font-mono text-[0.88rem] leading-7 text-slate-100">
                  {job?.logs
                    .map((entry) => `[${entry.timestamp}] ${entry.message}`)
                    .join('\n') ?? ''}
                </pre>
              </ScrollArea>
            </section>
          </div>
        </CardContent>
      </Card>

      {selectedItem ? (
        <Dialog open onOpenChange={(open) => !open && onModalClose()}>
          <DialogContent
            id="markdown-modal"
            className="markdown-modal-dialog flex !h-[min(96vh,78rem)] !w-[calc(100vw-1.5rem)] !max-w-[96rem] flex-col overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-0 shadow-[0_36px_120px_rgba(15,23,42,0.3)] sm:!w-[calc(100vw-3rem)]"
            showCloseButton={false}
          >
            <DialogHeader className="markdown-modal-header grid gap-4 border-b border-slate-200 bg-white px-6 py-5 sm:flex sm:items-start sm:justify-between">
              <div className="min-w-0">
                <DialogTitle className="text-2xl font-semibold tracking-[-0.04em] text-slate-900">
                  결과 미리보기
                </DialogTitle>
              </div>
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="ghost"
                  className="ghost-button min-h-10 rounded-xl px-4"
                  id="markdown-modal-close"
                >
                  닫기
                </Button>
              </DialogClose>
            </DialogHeader>
            <DialogDescription className="sr-only">
              export 결과 Markdown 또는 진단 내용을 확인합니다.
            </DialogDescription>
            <div
              id="markdown-modal-meta"
              className="markdown-modal-meta grid gap-3 border-b border-slate-200 bg-slate-50/90 px-6 py-5 sm:grid-cols-2 xl:grid-cols-4"
            >
              <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(22,33,50,0.06)]">
                <span className="text-sm font-medium text-slate-500">Item</span>
                <strong className="truncate text-base font-semibold tracking-[-0.03em] text-slate-900">
                  {selectedItem.title}
                </strong>
              </article>
              <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(22,33,50,0.06)]">
                <span className="text-sm font-medium text-slate-500">
                  Status
                </span>
                <strong className="truncate text-base font-semibold tracking-[-0.03em] text-slate-900">
                  {selectedItem.status}
                </strong>
              </article>
              <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(22,33,50,0.06)]">
                <span className="text-sm font-medium text-slate-500">
                  Warnings
                </span>
                <strong className="truncate text-base font-semibold tracking-[-0.03em] text-slate-900">
                  {selectedItem.warningCount}
                </strong>
              </article>
              <article className="preview-meta-card grid gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-[0_10px_24px_rgba(22,33,50,0.06)]">
                <span className="text-sm font-medium text-slate-500">
                  Output
                </span>
                <strong className="truncate text-base font-semibold tracking-[-0.03em] text-slate-900">
                  {selectedItem.outputPath ?? 'diagnostics only'}
                </strong>
              </article>
            </div>
            <ScrollArea
              id="markdown-modal-body"
              className="markdown-modal-body min-h-0 flex-1 overflow-hidden bg-white"
            >
              <article className="markdown-modal-content mx-auto min-h-full w-full max-w-[80rem] px-6 py-6">
                <MarkdownDocument markdown={buildModalMarkdown(selectedItem)} />
              </article>
            </ScrollArea>
          </DialogContent>
        </Dialog>
      ) : null}
    </>
  );
};
