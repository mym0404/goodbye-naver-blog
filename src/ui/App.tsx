import { useEffect, useMemo, useRef, useState } from 'react';

import {
  defaultExportOptions,
  frontmatterFieldMeta,
  frontmatterFieldOrder,
  optionDescriptions,
  validateFrontmatterAliases,
} from '../shared/export-options.js';
import { filterPostsByScope } from '../shared/export-scope.js';
import type {
  ExportJobItem,
  ExportJobState,
  ExportOptions,
  ScanResult,
} from '../shared/types.js';

import { Badge } from './components/ui/badge.js';
import { Button } from './components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from './components/ui/card.js';
import { Input } from './components/ui/input.js';
import { Separator } from './components/ui/separator.js';
import { toast } from './components/ui/sonner.js';
import { toggleCategorySelection } from './features/scan/category-selection.js';
import { CategoryPanel } from './features/scan/category-panel.js';
import { ExportOptionsPanel } from './features/options/export-options-panel.js';
import { JobResultsPanel } from './features/job-results/job-results-panel.js';
import { PreviewPanel } from './features/preview/preview-panel.js';
import { useExportJob } from './hooks/use-export-job.js';
import type { ExportDefaultsResponse, ExportPreviewResult } from './lib/api.js';
import { fetchJson, postJson } from './lib/api.js';
import { cn } from './lib/cn.js';

const previewIdleStatus =
  '스캔 후 카테고리를 고르면 예시 Markdown을 확인할 수 있습니다.';

const fallbackDefaults: ExportDefaultsResponse = {
  profile: 'gfm',
  options: defaultExportOptions(),
  frontmatterFieldOrder,
  frontmatterFieldMeta,
  optionDescriptions,
};

const navigationItems = [
  {
    id: 'scan-workbench',
    href: '#scan-workbench',
    label: '블로그 스캔',
    iconClass: 'ri-radar-line',
  },
  {
    id: 'category-panel',
    href: '#category-panel',
    label: '카테고리 선택',
    iconClass: 'ri-folder-chart-line',
  },
  {
    id: 'export-panel',
    href: '#export-panel',
    label: '출력 설정',
    iconClass: 'ri-equalizer-3-line',
  },
  {
    id: 'preview-panel',
    href: '#preview-panel',
    label: '미리보기',
    iconClass: 'ri-markdown-line',
  },
  {
    id: 'status-panel',
    href: '#status-panel',
    label: '작업 상태',
    iconClass: 'ri-file-list-3-line',
  },
] as const;

type SectionId = (typeof navigationItems)[number]['id'];

const createErrorJobState = (
  error: string,
  request: { blogIdOrUrl: string; outputDir: string; options: ExportOptions },
) =>
  ({
    id: 'failed-local',
    request: {
      blogIdOrUrl: request.blogIdOrUrl,
      outputDir: request.outputDir,
      profile: 'gfm',
      options: request.options,
    },
    status: 'failed',
    logs: [],
    createdAt: new Date().toISOString(),
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    progress: {
      total: 0,
      completed: 0,
      failed: 0,
      warnings: 0,
    },
    upload: {
      status: "not-requested",
      eligiblePostCount: 0,
      candidateCount: 0,
      uploadedCount: 0,
      failedCount: 0,
      terminalReason: null,
    },
    items: [],
    manifest: null,
    error,
  }) satisfies ExportJobState;

const getRailStatus = ({
  job,
  scanPending,
  scanResult,
}: {
  job: ExportJobState | null;
  scanPending: boolean;
  scanResult: ScanResult | null;
}) => {
  if (job) {
    return job.status;
  }

  if (scanPending) {
    return 'running';
  }

  if (scanResult) {
    return 'ready';
  }

  return 'idle';
};

const runningHiddenSectionIds = new Set<SectionId>([
  'category-panel',
  'export-panel',
  'preview-panel',
]);

const statusPillClass = (status: string) =>
  cn(
    'rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]',
    status === 'completed' || status === 'upload-completed' || status === 'ready'
      ? 'bg-emerald-100 text-emerald-800'
      : status === 'running' || status === 'queued' || status === 'success' || status === 'uploading'
        ? 'bg-amber-100 text-amber-800'
        : status === 'failed' || status === 'upload-failed'
          ? 'bg-rose-100 text-rose-800'
          : status === 'upload-ready'
            ? 'bg-sky-100 text-sky-800'
          : 'bg-slate-100 text-slate-600',
  );

export const App = () => {
  const [defaults, setDefaults] = useState(fallbackDefaults);
  const [blogIdOrUrl, setBlogIdOrUrl] = useState('');
  const [outputDir, setOutputDir] = useState('./output');
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [options, setOptions] = useState<ExportOptions>(
    fallbackDefaults.options,
  );
  const [scanStatus, setScanStatus] = useState(
    '블로그를 아직 스캔하지 않았습니다.',
  );
  const [categoryStatus, setCategoryStatus] = useState(
    '스캔 후 카테고리를 선택할 수 있습니다.',
  );
  const [categorySearch, setCategorySearch] = useState('');
  const [preview, setPreview] = useState<ExportPreviewResult | null>(null);
  const [previewStatus, setPreviewStatus] = useState(previewIdleStatus);
  const [previewDirty, setPreviewDirty] = useState(true);
  const [previewPending, setPreviewPending] = useState(false);
  const [previewMode, setPreviewMode] = useState<
    'source' | 'split' | 'rendered'
  >('source');
  const [scanPending, setScanPending] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ExportJobItem | null>(null);
  const [activeJobFilter, setActiveJobFilter] = useState<
    'all' | 'warnings' | 'errors'
  >('all');
  const [activeSectionId, setActiveSectionId] = useState<SectionId>(
    navigationItems[0].id,
  );
  const { job, submitting, uploadSubmitting, setJob, startJob, startUpload } = useExportJob();
  const lastNotifiedJobKeyRef = useRef<string | null>(null);

  const frontmatterValidationErrors = useMemo(
    () => validateFrontmatterAliases(options.frontmatter),
    [options.frontmatter],
  );
  const scopedPostCount = useMemo(() => {
    if (!scanResult?.posts) {
      return scanResult?.totalPostCount ?? 0;
    }

    return filterPostsByScope({
      posts: scanResult.posts,
      categories: scanResult.categories,
      options,
    }).length;
  }, [options, scanResult]);

  const selectedCategoryIds = options.scope.categoryIds;
  const selectedCount = scanResult ? selectedCategoryIds.length : 0;
  const exportDisabled = !scanResult || frontmatterValidationErrors.length > 0;
  const previewDisabled = exportDisabled;
  const isJobRunning =
    submitting ||
    uploadSubmitting ||
    job?.status === 'queued' ||
    job?.status === 'running' ||
    job?.status === 'uploading';
  const interactionsLocked = isJobRunning;
  const isCurrentJobRequest = useMemo(() => {
    if (!job || isJobRunning) {
      return Boolean(job);
    }

    const currentBlogIdOrUrl = blogIdOrUrl.trim();
    const currentOutputDir = outputDir.trim();

    return (
      job.request.blogIdOrUrl === currentBlogIdOrUrl &&
      job.request.outputDir === currentOutputDir &&
      JSON.stringify(job.request.options) === JSON.stringify(options)
    );
  }, [blogIdOrUrl, isJobRunning, job, options, outputDir]);
  const railJob = isCurrentJobRequest ? job : null;
  const visibleNavigationItems = useMemo(
    () =>
      isJobRunning
        ? navigationItems.filter(
            (item) => !runningHiddenSectionIds.has(item.id),
          )
        : navigationItems,
    [isJobRunning],
  );
  const railStatus = getRailStatus({
    job: railJob,
    scanPending,
    scanResult,
  });

  useEffect(() => {
    let cancelled = false;

    const loadDefaults = async () => {
      try {
        const nextDefaults = await fetchJson<ExportDefaultsResponse>(
          '/api/export-defaults',
        );

        if (cancelled) {
          return;
        }

        setDefaults(nextDefaults);
        setOptions(nextDefaults.options);
      } catch (error) {
        if (cancelled) {
          return;
        }

        setDefaults(fallbackDefaults);
        setOptions(fallbackDefaults.options);
        setScanStatus(error instanceof Error ? error.message : String(error));
      }
    };

    void loadDefaults();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedItem || !job) {
      return;
    }

    const nextSelectedItem =
      job.items.find((item) => item.id === selectedItem.id) ?? null;
    setSelectedItem(nextSelectedItem);
  }, [job, selectedItem]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setSelectedItem(null);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!job) {
      lastNotifiedJobKeyRef.current = null;
      return;
    }

    const notificationKey = `${job.id}:${job.status}:${job.finishedAt ?? ''}`;

    if (lastNotifiedJobKeyRef.current === notificationKey) {
      return;
    }

    lastNotifiedJobKeyRef.current = notificationKey;

    if (job.status === 'upload-ready') {
      toast('내보내기가 끝났습니다. 이미지 업로드를 시작할 수 있습니다.', {
        description: `업로드 대상 ${job.upload.candidateCount}개`,
      });
      return;
    }

    if (job.status === 'completed') {
      toast.success('내보내기가 완료되었습니다.', {
        description: `완료 ${job.progress.completed}개, 실패 ${job.progress.failed}개`,
      });
      return;
    }

    if (job.status === 'upload-completed') {
      toast.success('이미지 업로드까지 완료되었습니다.', {
        description: `업로드 ${job.upload.uploadedCount}개`,
      });
      return;
    }

    if (job.status === 'upload-failed') {
      toast.error('이미지 업로드에 실패했습니다.', {
        description: job.error ?? '로그를 확인하세요.',
      });
      return;
    }

    if (job.status === 'failed') {
      toast.error('내보내기 작업이 실패했습니다.', {
        description: job.error ?? '로그를 확인하세요.',
      });
    }
  }, [job]);

  useEffect(() => {
    const sections = visibleNavigationItems
      .map((item) => document.querySelector<HTMLElement>(item.href))
      .filter(
        (section): section is HTMLElement => section instanceof HTMLElement,
      );

    if (sections.length === 0) {
      return;
    }

    const resolveActiveSection = () => {
      let nextSectionId = sections[0].id as SectionId;

      for (const section of sections) {
        if (section.getBoundingClientRect().top <= 168) {
          nextSectionId = section.id as SectionId;
        }
      }

      setActiveSectionId((current) =>
        current === nextSectionId ? current : nextSectionId,
      );
    };

    const observer =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            (entries) => {
              const visibleEntries = entries.filter(
                (entry) => entry.isIntersecting,
              );

              if (visibleEntries.length === 0) {
                resolveActiveSection();
                return;
              }

              const nextSection = visibleEntries.sort(
                (left, right) =>
                  Math.abs(left.boundingClientRect.top - 168) -
                  Math.abs(right.boundingClientRect.top - 168),
              )[0];

              setActiveSectionId(nextSection.target.id as SectionId);
            },
            {
              rootMargin: '-168px 0px -55% 0px',
              threshold: [0.05, 0.2, 0.4, 0.65],
            },
          )
        : null;

    if (observer) {
      sections.forEach((section) => observer.observe(section));
    }
    resolveActiveSection();
    window.addEventListener('scroll', resolveActiveSection, { passive: true });

    return () => {
      observer?.disconnect();
      window.removeEventListener('scroll', resolveActiveSection);
    };
  }, [visibleNavigationItems]);

  const markPreviewDirty = (
    message = '옵션이 바뀌었습니다. 예시를 다시 확인하세요.',
  ) => {
    setPreviewDirty(true);
    setPreviewStatus(message);
  };

  const updateOptions = (
    updater: (current: ExportOptions) => ExportOptions,
  ) => {
    setOptions((current) => updater(current));
    if (scanResult) {
      markPreviewDirty();
    }
  };

  const resetPreview = (message = previewIdleStatus) => {
    setPreview(null);
    setPreviewStatus(message);
    setPreviewDirty(true);
    setPreviewMode('source');
  };

  const resetScanState = (message: string) => {
    setScanResult(null);
    setCategorySearch('');
    setCategoryStatus('스캔 후 카테고리를 선택할 수 있습니다.');
    setScanStatus(message);
    setOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: [],
      },
    }));
    resetPreview();
  };

  const handleBlogInputChange = (value: string) => {
    if (interactionsLocked) {
      return;
    }

    setBlogIdOrUrl(value);
    resetScanState('블로그가 변경되었습니다. 다시 스캔해야 합니다.');
  };

  const handleScan = async () => {
    if (interactionsLocked) {
      return;
    }

    if (!blogIdOrUrl.trim()) {
      setScanStatus('blog ID 또는 URL을 입력해야 합니다.');
      return;
    }

    setScanPending(true);
    setScanStatus('카테고리를 스캔하는 중입니다.');
    setCategoryStatus('카테고리를 불러오는 중입니다.');

    try {
      const nextScanResult = await postJson<ScanResult>('/api/scan', {
        blogIdOrUrl: blogIdOrUrl.trim(),
      });

      setScanResult(nextScanResult);
      setScanStatus(`${nextScanResult.blogId} 스캔 완료`);
      setCategoryStatus('내보낼 카테고리를 선택하세요.');
      setOptions((current) => ({
        ...current,
        scope: {
          ...current.scope,
          categoryIds: nextScanResult.categories.map((category) => category.id),
        },
      }));
      resetPreview('스캔이 끝났습니다. 예시 Markdown을 확인할 수 있습니다.');
      toast.success('카테고리 스캔이 완료되었습니다.', {
        description: `${nextScanResult.totalPostCount}개 글과 ${nextScanResult.categories.length}개 카테고리를 불러왔습니다.`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      resetScanState(message);
      toast.error('카테고리 스캔에 실패했습니다.', {
        description: message,
      });
    } finally {
      setScanPending(false);
    }
  };

  const handleCategoryToggle = (categoryId: number, checked: boolean) => {
    if (!scanResult) {
      return;
    }

    updateOptions((current) => {
      return {
        ...current,
        scope: {
          ...current.scope,
          categoryIds: toggleCategorySelection({
            categories: scanResult.categories,
            selectedIds: current.scope.categoryIds,
            categoryId,
            checked,
          }),
        },
      };
    });
  };

  const handleSelectAllCategories = () => {
    if (!scanResult) {
      return;
    }

    updateOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: scanResult.categories.map((category) => category.id),
      },
    }));
    toast('카테고리를 전체 선택했습니다.', {
      description: `${scanResult.totalPostCount}개 글이 선택 범위에 포함됩니다.`,
    });
  };

  const handleClearAllCategories = () => {
    updateOptions((current) => ({
      ...current,
      scope: {
        ...current.scope,
        categoryIds: [],
      },
    }));
    toast('카테고리 선택을 모두 해제했습니다.', {
      description: '선택 범위가 비워졌습니다.',
    });
  };

  const handlePreview = async () => {
    if (!scanResult) {
      resetPreview();
      return;
    }

    if (frontmatterValidationErrors.length > 0) {
      setPreviewStatus(
        'Frontmatter alias 오류를 먼저 해결해야 preview를 볼 수 있습니다.',
      );
      return;
    }

    setPreviewPending(true);
    setPreviewStatus('대표 글을 가져와 예시 Markdown을 렌더링하는 중입니다.');

    try {
      const nextPreview = await postJson<ExportPreviewResult>('/api/preview', {
        blogIdOrUrl: blogIdOrUrl.trim(),
        outputDir: outputDir.trim(),
        options,
      });

      setPreview(nextPreview);
      setPreviewStatus(
        nextPreview.renderWarnings.length > 0
          ? 'preview는 현재 옵션 기준으로 렌더링했습니다. 경고가 있으면 아래 글 요약에서 함께 확인하세요.'
          : 'preview는 현재 옵션 기준으로 렌더링했습니다. 본문 HTML은 export 결과에 남기지 않습니다.',
      );
      setPreviewDirty(false);
      toast.success('예시 Markdown을 갱신했습니다.', {
        description: nextPreview.candidatePost.title,
      });
    } catch (error) {
      setPreview(null);
      const message = error instanceof Error ? error.message : String(error);
      setPreviewStatus(message);
      setPreviewDirty(true);
      toast.error('예시 Markdown 생성에 실패했습니다.', {
        description: message,
      });
    } finally {
      setPreviewPending(false);
    }
  };

  const handleSubmit = async () => {
    if (interactionsLocked) {
      return;
    }

    if (!scanResult) {
      setCategoryStatus('먼저 스캔을 완료해야 합니다.');
      return;
    }

    if (frontmatterValidationErrors.length > 0) {
      setCategoryStatus('Frontmatter alias 오류를 먼저 해결해야 합니다.');
      return;
    }

    setSelectedItem(null);
    setActiveJobFilter('all');

    try {
      const jobId = await startJob({
        blogIdOrUrl: blogIdOrUrl.trim(),
        outputDir: outputDir.trim(),
        options,
      });
      toast.success('내보내기 작업을 등록했습니다.', {
        description: `${scopedPostCount}개 글을 처리합니다. job ${jobId}`,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setJob(
        createErrorJobState(message, {
          blogIdOrUrl: blogIdOrUrl.trim(),
          outputDir: outputDir.trim(),
          options,
        }),
      );
      toast.error('내보내기 작업 등록에 실패했습니다.', {
        description: message,
      });
    }
  };

  const handleUpload = async ({
    uploaderKey,
    uploaderConfigJson,
  }: {
    uploaderKey: string;
    uploaderConfigJson: string;
  }) => {
    try {
      await startUpload({
        uploaderKey,
        uploaderConfigJson,
      });
      toast('이미지 업로드를 시작했습니다.', {
        description: '작업 상태 패널에서 진행률을 확인할 수 있습니다.',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error('이미지 업로드를 시작하지 못했습니다.', {
        description: message,
      });
    }
  };

  const scanSummaryCards = scanResult
    ? [
        {
          tone: 'primary',
          label: '블로그',
          value: scanResult.blogId,
          note: '스캔 완료',
          iconClass: 'ri-pages-line',
        },
        {
          tone: 'cyan',
          label: '대상 글',
          value: String(scopedPostCount),
          note: `전체 ${scanResult.totalPostCount}개 중 현재 범위`,
          iconClass: 'ri-article-line',
        },
        {
          tone: 'green',
          label: '카테고리',
          value: String(scanResult.categories.length),
          note: '발견된 카테고리',
          iconClass: 'ri-folder-chart-line',
        },
        {
          tone: 'neutral',
          label: '선택',
          value: String(selectedCount),
          note: '선택된 카테고리',
          iconClass: 'ri-checkbox-multiple-line',
        },
      ]
    : [
        {
          tone: 'primary',
          label: '블로그',
          value: 'Ready',
          note: '스캔 대기 중',
          iconClass: 'ri-pages-line',
        },
        {
          tone: 'cyan',
          label: '대상 글',
          value: '0',
          note: '스캔 후 계산됩니다',
          iconClass: 'ri-article-line',
        },
        {
          tone: 'green',
          label: '카테고리',
          value: '0',
          note: '선택 범위 없음',
          iconClass: 'ri-folder-chart-line',
        },
        {
          tone: 'neutral',
          label: '선택',
          value: '0',
          note: '카테고리를 고르면 반영됩니다',
          iconClass: 'ri-checkbox-multiple-line',
        },
      ];

  const totalItems = railJob?.progress.total ?? 0;
  const effectiveTotalItems = isCurrentJobRequest
    ? totalItems || scopedPostCount
    : scopedPostCount;
  const completedItems = railJob?.progress.completed ?? 0;
  const failedItems = railJob?.progress.failed ?? 0;
  const warningItems = railJob?.progress.warnings ?? 0;
  const remainingItems = Math.max(
    effectiveTotalItems - completedItems - failedItems,
    0,
  );
  const activeItem =
    visibleNavigationItems.find((item) => item.id === activeSectionId) ??
    visibleNavigationItems[0];

  const railSummaryCards = [
    {
      label: '총 글',
      value: String(effectiveTotalItems),
    },
    { label: '완료', value: String(completedItems) },
    {
      label: '남음',
      value: String(isCurrentJobRequest ? remainingItems : scopedPostCount),
    },
    { label: '경고', value: String(warningItems) },
    { label: '실패', value: String(failedItems) },
  ];
  const mobileSummaryCards = [
    {
      label: '총 글',
      value: String(effectiveTotalItems),
    },
    { label: '완료', value: String(completedItems) },
    {
      label: '남음',
      value: String(isCurrentJobRequest ? remainingItems : scopedPostCount),
    },
    { label: '실패', value: String(failedItems) },
  ];

  const scanStatusTone = scanPending
    ? 'running'
    : scanResult
      ? 'success'
      : 'idle';

  return (
    <main className="dashboard-shell relative grid min-h-screen w-full max-w-full overflow-x-clip xl:grid-cols-[20rem_minmax(0,1fr)]">
      <div
        id="dashboard-backdrop"
        className="dashboard-backdrop pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_top_right,rgba(51,102,255,0.16),transparent_22%),radial-gradient(circle_at_bottom_left,rgba(79,140,255,0.08),transparent_28%),linear-gradient(180deg,#f8fbff_0%,var(--background)_100%)]"
        aria-hidden="true"
      />

      <aside
        className="app-sidebar hidden xl:sticky xl:top-0 xl:block xl:h-screen xl:min-w-0"
        aria-label="Dashboard sections"
      >
        <div className="app-sidebar-shell grid h-screen content-start gap-4 overflow-x-hidden overflow-y-auto border-r border-white/10 bg-[#1f3045] [background-image:linear-gradient(180deg,rgba(255,255,255,0.05),transparent),linear-gradient(180deg,var(--sidebar-background),#182637)] p-5 text-slate-50 shadow-[16px_0_32px_rgba(11,22,36,0.16)]">
          <div className="sidebar-brand">
            <strong className="text-lg font-semibold tracking-[-0.03em] text-white">
              Goodbye Naver Blog
            </strong>
          </div>

          <Separator className="sidebar-separator bg-white/10" />

          <div className="sidebar-section grid gap-3">
            <p className="sidebar-heading text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-300">
              작업 순서
            </p>
            <nav className="sidebar-nav grid gap-2">
              {visibleNavigationItems.map((item) => (
                <a
                  key={item.href}
                  className={cn(
                    'sidebar-link flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition',
                    item.id === activeSectionId
                      ? 'is-active border-white/10 bg-white/10 text-white'
                      : 'border-transparent text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white',
                  )}
                  data-section-link={item.id}
                  href={item.href}
                  aria-current={
                    item.id === activeSectionId ? 'true' : undefined
                  }
                >
                  <i className={item.iconClass} aria-hidden="true" />
                  <span>{item.label}</span>
                </a>
              ))}
            </nav>
          </div>

          <Card className="sidebar-summary-card border-white/10 bg-white/5 text-slate-50 shadow-none">
            <CardHeader className="sidebar-summary-header p-4 pb-3">
              <div className="sidebar-summary-heading flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="sidebar-summary-title text-lg font-semibold tracking-[-0.03em] text-white">
                    진행
                  </CardTitle>
                </div>
                <Badge
                  id="status-text"
                  className={statusPillClass(railStatus)}
                  data-status={railStatus}
                >
                  {railStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="sidebar-summary-content grid gap-3 px-4 pb-4 pt-0">
              <div
                id="summary"
                className="sidebar-summary-grid grid grid-cols-2 gap-3"
                aria-live="polite"
              >
                {railSummaryCards.map((card) => (
                  <article
                    key={card.label}
                    className="sidebar-summary-metric grid gap-1 rounded-2xl border border-white/10 bg-[#22354c] px-4 py-3"
                  >
                    <span className="text-xs font-medium text-[#d6e2f1]">
                      {card.label}
                    </span>
                    <strong className="text-lg font-semibold tracking-[-0.03em] text-white">
                      {card.value}
                    </strong>
                  </article>
                ))}
              </div>
              <Button
                type="button"
                id="export-button"
                variant="outline"
                size="lg"
                className="min-h-11 rounded-xl border-white/20 bg-transparent !text-white hover:bg-white/10"
                disabled={exportDisabled || interactionsLocked}
                onClick={handleSubmit}
              >
                <i
                  className={`${submitting ? 'ri-loader-4-line motion-safe:animate-spin' : 'ri-download-2-line'}`}
                  aria-hidden="true"
                />
                <span>{submitting ? '작업 등록 중' : '내보내기'}</span>
              </Button>
            </CardContent>
          </Card>
        </div>
      </aside>

      <div className="dashboard-main grid min-w-0 max-w-full gap-5 overflow-x-clip px-0 pb-0 pt-0">
        <section
          className="mobile-command-bar sticky top-0 z-30 grid gap-3 border-b border-slate-200/80 bg-white/92 px-4 py-3 shadow-[0_18px_36px_rgba(22,33,50,0.08)] backdrop-blur xl:hidden"
          aria-label="Mobile command rail"
        >
          <div className="mobile-rail flex items-center justify-between gap-3">
            <div className="mobile-rail-copy grid gap-1">
              <span className="mobile-rail-label text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                현재 단계
              </span>
              <strong className="mobile-rail-step text-sm font-semibold tracking-[-0.02em] text-slate-900">
                {activeItem.label}
              </strong>
            </div>
            <Badge
              className={statusPillClass(railStatus)}
              data-status={railStatus}
            >
              {railStatus}
            </Badge>
          </div>

          <nav
            className="mobile-nav flex gap-2 overflow-auto"
            aria-label="작업 순서"
          >
            {visibleNavigationItems.map((item) => (
              <a
                key={`mobile-${item.href}`}
                className={cn(
                  'sidebar-link mobile-nav-link flex min-h-9 min-w-max items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition',
                  item.id === activeSectionId
                    ? 'is-active border-transparent bg-primary text-primary-foreground'
                    : 'border-slate-200 bg-white text-slate-600',
                )}
                data-mobile-section-link={item.id}
                href={item.href}
                aria-current={item.id === activeSectionId ? 'true' : undefined}
              >
                <i className={item.iconClass} aria-hidden="true" />
                <span>{item.label}</span>
              </a>
            ))}
          </nav>

          <div className="mobile-utility-row flex items-start gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-10 shrink-0 rounded-full px-4"
              aria-label={
                submitting ? '빠른 내보내기 등록 중' : '빠른 내보내기'
              }
              disabled={exportDisabled || interactionsLocked}
              onClick={handleSubmit}
            >
              <i
                className={`${submitting ? 'ri-loader-4-line motion-safe:animate-spin' : 'ri-download-2-line'}`}
                aria-hidden="true"
              />
              <span>{submitting ? '등록 중' : '내보내기'}</span>
            </Button>

            <div
              className="mobile-summary-strip flex flex-1 gap-2 overflow-auto"
              aria-live="polite"
            >
              {mobileSummaryCards.map((card) => (
                <article
                  key={`mobile-${card.label}`}
                  className="mobile-summary-metric inline-flex min-h-10 min-w-max items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2"
                >
                  <span className="text-[11px] font-medium text-slate-500">
                    {card.label}
                  </span>
                  <strong className="text-sm font-semibold text-slate-900">
                    {card.value}
                  </strong>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section
          id="scan-workbench"
          className="dashboard-section scan-workbench-section grid gap-4 px-4 pt-4 xl:px-6 xl:pt-6"
        >
          <Card className="hero-panel overflow-hidden border-white/80 bg-white/90 shadow-[0_24px_60px_rgba(22,33,50,0.08)] backdrop-blur">
            <CardHeader className="hero-panel-header gap-4 border-b border-slate-200/70 bg-white/70 p-6 sm:flex sm:items-start sm:justify-between">
              <div className="hero-copy space-y-2">
                <CardTitle className="hero-title text-[clamp(2rem,3vw,3.4rem)] font-semibold leading-[1.02] tracking-[-0.06em] text-slate-900">
                  블로그 스캔
                </CardTitle>
                <CardDescription className="hero-description max-w-3xl text-sm leading-7 text-slate-600">
                  Blog ID를 입력하고 카테고리를 불러옵니다.
                </CardDescription>
              </div>
              <div className="scan-status-stack grid justify-items-start gap-3">
                <Badge
                  id="scan-status"
                  className={statusPillClass(scanStatusTone)}
                  data-status={scanStatusTone}
                >
                  {scanStatus}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="grid gap-4 p-6">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
                <label className="grid gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    Blog ID 또는 URL
                  </span>
                  <Input
                    id="blogIdOrUrl"
                    placeholder="mym0404 또는 https://blog.naver.com/..."
                    disabled={interactionsLocked}
                    value={blogIdOrUrl}
                    onChange={(event) =>
                      handleBlogInputChange(event.target.value)
                    }
                  />
                </label>
                <Button
                  type="button"
                  id="scan-button"
                  size="lg"
                  className="min-h-11 rounded-xl px-5"
                  disabled={scanPending || interactionsLocked}
                  onClick={handleScan}
                >
                  <i
                    className={`${scanPending ? 'ri-loader-4-line motion-safe:animate-spin' : 'ri-radar-line'}`}
                    aria-hidden="true"
                  />
                  <span>{scanPending ? '스캔 중' : '카테고리 스캔'}</span>
                </Button>
              </div>
            </CardContent>
          </Card>

          <section
            id="scan-summary"
            className="kpi-strip grid gap-4 md:grid-cols-2 2xl:grid-cols-4"
            aria-live="polite"
          >
            {scanSummaryCards.map((card) => (
              <Card
                key={card.label}
                className="metric-card overflow-hidden border-white/80 bg-white/90 shadow-[0_18px_40px_rgba(22,33,50,0.06)]"
                data-tone={card.tone}
              >
                <CardContent className="metric-card-content flex items-center gap-4 p-5">
                  <div
                    className={cn(
                      'metric-card-icon inline-flex size-12 items-center justify-center rounded-2xl text-lg',
                      card.tone === 'primary'
                        ? 'bg-primary/10 text-primary'
                        : card.tone === 'cyan'
                          ? 'bg-cyan-50 text-cyan-700'
                          : card.tone === 'green'
                            ? 'bg-emerald-50 text-emerald-700'
                            : 'bg-slate-100 text-slate-700',
                    )}
                    aria-hidden="true"
                  >
                    <i className={card.iconClass} />
                  </div>
                  <div className="metric-card-copy grid gap-1">
                    <span className="text-sm font-medium text-slate-500">
                      {card.label}
                    </span>
                    <strong className="text-4xl font-semibold tracking-[-0.05em] text-slate-900">
                      {card.value}
                    </strong>
                    <small className="text-sm text-slate-500">
                      {card.note}
                    </small>
                  </div>
                </CardContent>
              </Card>
            ))}
          </section>
        </section>

        <div className="content-grid grid min-w-0 gap-5 px-4 pb-5 xl:px-6 xl:pb-6">
          {!isJobRunning ? (
            <>
              <CategoryPanel
                scanResult={scanResult}
                selectedCategoryIds={selectedCategoryIds}
                categorySearch={categorySearch}
                categoryStatus={categoryStatus}
                selectedCount={selectedCount}
                selectedPostCount={scopedPostCount}
                totalPostCount={scanResult?.totalPostCount ?? 0}
                onCategorySearchChange={setCategorySearch}
                onSelectAll={handleSelectAllCategories}
                onClearAll={handleClearAllCategories}
                onCategoryToggle={handleCategoryToggle}
              />

              <ExportOptionsPanel
                outputDir={outputDir}
                options={options}
                optionDescriptions={defaults.optionDescriptions}
                frontmatterFieldOrder={defaults.frontmatterFieldOrder}
                frontmatterFieldMeta={defaults.frontmatterFieldMeta}
                frontmatterValidationErrors={frontmatterValidationErrors}
                onOutputDirChange={setOutputDir}
                onOptionsChange={updateOptions}
              />

              <PreviewPanel
                preview={preview}
                previewDirty={previewDirty}
                previewStatus={previewStatus}
                previewMode={previewMode}
                disabled={previewDisabled}
                pending={previewPending}
                onPreview={handlePreview}
                onPreviewModeChange={setPreviewMode}
              />
            </>
          ) : null}

          <JobResultsPanel
            job={job}
            selectedItem={selectedItem}
            activeJobFilter={activeJobFilter}
            uploadSubmitting={uploadSubmitting}
            onFilterChange={setActiveJobFilter}
            onItemSelect={setSelectedItem}
            onUploadStart={handleUpload}
            onModalClose={() => setSelectedItem(null)}
          />
        </div>
      </div>
    </main>
  );
};
