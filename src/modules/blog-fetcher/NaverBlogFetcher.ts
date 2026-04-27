import path from 'node:path';
import { writeFile } from 'node:fs/promises';

import {
  type CategoryInfo,
  type ScanResult,
} from '../../shared/Types.js';
import {
  delay,
  ensureDir,
  getSourceUrl,
  mapConcurrent,
  normalizeAssetUrl,
  sanitizeCategoryName,
  toKstDateTime,
} from '../../shared/Utils.js';

type CategoryApiItem = {
  categoryName: string;
  categoryNo: number;
  parentCategoryNo: number | null;
  postCnt: number;
  divisionLine: boolean;
  openYN: boolean;
};

type PostApiItem = {
  logNo: number;
  titleWithInspectMessage: string;
  addDate: number;
  categoryNo: number;
  categoryName: string;
  smartEditorVersion: number | null;
  thumbnailUrl: string | null;
  notOpen: boolean;
  postBlocked: boolean;
  buddyOpen: boolean;
  bothBuddyOpen: boolean;
};

const pageSize = 30;
const postListConcurrency = 3;
const defaultRetryDelays = [0, 1_000, 2_000, 4_000];
const defaultRequestTimeoutMs = 5_000;
const htmlHeaders = ({
  blogId,
}: {
  blogId: string;
}) => ({
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  referer: `https://m.blog.naver.com/PostList.naver?blogId=${blogId}&categoryNo=0&listStyle=style1`,
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
});
const binaryHeaders = {
  referer: 'https://blog.naver.com/',
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
};

const browserHeaders = ({
  blogId,
  refererPath = `/PostList.naver?blogId=${blogId}&categoryNo=0&listStyle=style1`,
}: {
  blogId: string;
  refererPath?: string;
}) => ({
  accept: 'application/json, text/plain, */*',
  origin: 'https://m.blog.naver.com',
  referer: `https://m.blog.naver.com${refererPath}`,
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-mode': 'cors',
  'sec-fetch-dest': 'empty',
});

const detectEditorVersion = (value: number | null) => {
  if (value === 2 || value === 3 || value === 4) {
    return value;
  }

  return null;
};

export class NaverBlogFetcher {
  readonly blogId: string;
  readonly onLog: ((message: string) => void) | null;
  readonly requestTimeoutMs: number;
  readonly retryDelays: number[];

  constructor({
    blogId,
    onLog,
    requestTimeoutMs,
    retryDelays,
  }: {
    blogId: string;
    onLog?: (message: string) => void;
    requestTimeoutMs?: number;
    retryDelays?: number[];
  }) {
    this.blogId = blogId;
    this.onLog = onLog ?? null;
    this.requestTimeoutMs = requestTimeoutMs ?? defaultRequestTimeoutMs;
    this.retryDelays = retryDelays ?? defaultRetryDelays;
  }

  async getPostCount() {
    const result = await this.fetchJson<{ postCount: number }>({
      url: `https://m.blog.naver.com/api/blogs/${this.blogId}/contents-count`,
    });

    return result.postCount;
  }

  async getCategories() {
    const result = await this.fetchJson<{
      mylogCategoryList: CategoryApiItem[];
    }>({
      url: `https://m.blog.naver.com/api/blogs/${this.blogId}/category-list`,
    });

    const categories = result.mylogCategoryList.map((category) => ({
      id: category.categoryNo,
      name: sanitizeCategoryName(category.categoryName),
      parentId: category.parentCategoryNo,
      postCount: category.postCnt,
      isDivider: category.divisionLine,
      isOpen: category.openYN,
      path: [] as string[],
    }));

    const categoryMap = new Map(
      categories.map((category) => [category.id, category]),
    );

    const resolvePath = (categoryId: number): string[] => {
      const category = categoryMap.get(categoryId);

      if (!category || category.isDivider) {
        return [];
      }

      const parentPath = category.parentId
        ? resolvePath(category.parentId)
        : [];

      return [...parentPath, category.name];
    };

    return categories
      .filter((category) => !category.isDivider && category.isOpen)
      .map((category) => ({
        ...category,
        path: resolvePath(category.id),
        depth: Math.max(resolvePath(category.id).length - 1, 0),
      })) satisfies CategoryInfo[];
  }

  async scanBlog({
    includePosts = false,
  }: {
    includePosts?: boolean
  } = {}): Promise<ScanResult> {
    const [totalPostCount, categories] = await Promise.all([
      this.getPostCount(),
      this.getCategories(),
    ]);
    const posts = includePosts
      ? await this.getAllPosts({
          expectedTotal: totalPostCount,
        })
      : undefined;

    return {
      blogId: this.blogId,
      totalPostCount,
      categories,
      ...(posts ? { posts } : {}),
    } satisfies ScanResult;
  }

  async getAllPosts({
    expectedTotal,
  }: {
    expectedTotal?: number;
  } = {}) {
    const resolvedExpectedTotal = expectedTotal ?? (await this.getPostCount());
    const totalPages = Math.max(1, Math.ceil(resolvedExpectedTotal / pageSize));
    const pageNumbers = Array.from(
      { length: totalPages },
      (_, index) => index + 1,
    );
    const pageResults = await mapConcurrent({
      items: pageNumbers,
      concurrency: postListConcurrency,
      mapper: async (page) => {
        const result = await this.fetchJson<{
          items: PostApiItem[];
        }>({
          url: `https://m.blog.naver.com/api/blogs/${this.blogId}/post-list?page=${page}&itemCount=${pageSize}&categoryNo=0`,
        });
        const pageItems = result.items
          .filter(
            (item) =>
              !item.notOpen &&
              !item.postBlocked &&
              !item.buddyOpen &&
              !item.bothBuddyOpen,
          )
          .map((item) => ({
            blogId: this.blogId,
            logNo: String(item.logNo),
            title: item.titleWithInspectMessage.trim(),
            publishedAt: toKstDateTime(item.addDate),
            categoryId: item.categoryNo,
            categoryName: sanitizeCategoryName(item.categoryName),
            source: getSourceUrl({
              blogId: this.blogId,
              logNo: String(item.logNo),
            }),
            editorVersion: detectEditorVersion(item.smartEditorVersion),
            thumbnailUrl: item.thumbnailUrl
              ? normalizeAssetUrl(item.thumbnailUrl)
              : null,
          }));

        this.log(`목록 수집 ${page}페이지 완료`);

        return {
          page,
          items: pageItems,
        };
      },
    });

    return pageResults
      .sort((left, right) => left.page - right.page)
      .flatMap((pageResult) => pageResult.items);
  }

  async fetchPostHtml(logNo: string) {
    const response = await this.fetchResponse({
      url: `https://m.blog.naver.com/PostView.naver?blogId=${this.blogId}&logNo=${logNo}`,
      headers: htmlHeaders({
        blogId: this.blogId,
      }),
      failureLabel: '글 HTML 요청 실패',
    });

    return response.text();
  }

  async downloadBinary({
    sourceUrl,
    destinationPath,
  }: {
    sourceUrl: string;
    destinationPath: string;
  }) {
    const binary = await this.fetchBinary({
      sourceUrl,
    });
    await ensureDir(path.dirname(destinationPath));
    await writeFile(destinationPath, binary.bytes);
  }

  async fetchBinary({ sourceUrl }: { sourceUrl: string }) {
    const normalizedSourceUrl = normalizeAssetUrl(sourceUrl);
    const response = await this.fetchResponse({
      url: normalizedSourceUrl,
      headers: binaryHeaders,
      failureLabel: '자산 다운로드 실패',
    });

    const arrayBuffer = await response.arrayBuffer();

    return {
      bytes: Buffer.from(arrayBuffer),
      contentType: response.headers.get('content-type'),
    };
  }

  private async fetchJson<Result>({ url }: { url: string }): Promise<Result> {
    let lastError: Error | null = null;

    for (const retryDelay of this.retryDelays) {
      if (retryDelay > 0) {
        await delay(retryDelay);
      }

      let response: Response;

      try {
        response = await this.fetchWithTimeout({
          url,
          headers: browserHeaders({ blogId: this.blogId }),
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.shouldRetryRequestError(error)) {
          continue;
        }

        throw lastError;
      }

      if (!response.ok) {
        lastError = new Error(
          `API 요청 실패: ${response.status} ${response.statusText}`,
        );

        if (response.status === 429 || response.status >= 500) {
          continue;
        }

        throw lastError;
      }

      const payload = (await response.json()) as {
        isSuccess?: boolean;
        result?: Result;
      };

      if (!payload.result) {
        lastError = new Error('API 응답에 result가 없습니다.');
        continue;
      }

      return payload.result;
    }

    throw lastError ?? new Error('API 요청에 실패했습니다.');
  }

  private async fetchResponse({
    url,
    headers,
    failureLabel,
  }: {
    url: string;
    headers: Record<string, string>;
    failureLabel: string;
  }) {
    let lastError: Error | null = null;

    for (const retryDelay of this.retryDelays) {
      if (retryDelay > 0) {
        await delay(retryDelay);
      }

      let response: Response;

      try {
        response = await this.fetchWithTimeout({
          url,
          headers,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (this.shouldRetryRequestError(error)) {
          continue;
        }

        throw lastError;
      }

      if (!response.ok) {
        lastError = new Error(
          `${failureLabel}: ${response.status} ${response.statusText}`,
        );

        if (this.shouldRetryStatus(response.status)) {
          continue;
        }

        throw lastError;
      }

      return response;
    }

    throw lastError ?? new Error(`${failureLabel}: 알 수 없는 오류`);
  }

  private async fetchWithTimeout({
    url,
    headers,
  }: {
    url: string;
    headers: Record<string, string>;
  }) {
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => {
      controller.abort();
    }, this.requestTimeoutMs);

    try {
      return await fetch(url, {
        headers,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutHandle);
    }
  }

  private shouldRetryRequestError(error: unknown) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      return true;
    }

    return error instanceof TypeError;
  }

  private shouldRetryStatus(status: number) {
    return status === 429 || status >= 500;
  }

  private log(message: string) {
    this.onLog?.(message);
  }
}
