import {
  type CategoryInfo,
  type ScanResult,
} from '../../shared/Types.js';
import {
  delay,
  getSourceUrl,
  mapConcurrent,
  normalizeAssetUrl,
  sanitizeCategoryName,
  toKstDateTime,
} from '../../shared/Utils.js';
import { log } from '../../shared/Logger.js';
import * as HttpUtil from './util/HttpUtil.js';

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

export class NaverBlogFetcher {
  readonly blogId: string;
  readonly requestTimeoutMs: number;
  readonly retryDelays: number[];

  constructor({
    blogId,
    requestTimeoutMs,
    retryDelays,
  }: {
    blogId: string;
    requestTimeoutMs?: number;
    retryDelays?: number[];
  }) {
    this.blogId = blogId;
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
            thumbnailUrl: item.thumbnailUrl
              ? normalizeAssetUrl(item.thumbnailUrl)
              : null,
          }));

        log(`목록 수집 ${page}페이지 완료`);

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
    const response = await HttpUtil.fetchResponseWithRetry({
      url: `https://m.blog.naver.com/PostView.naver?blogId=${this.blogId}&logNo=${logNo}`,
      headers: htmlHeaders({
        blogId: this.blogId,
      }),
      failureLabel: '글 HTML 요청 실패',
      retryDelays: this.retryDelays,
      requestTimeoutMs: this.requestTimeoutMs,
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
    await HttpUtil.downloadBinary({
      sourceUrl,
      destinationPath,
      headers: binaryHeaders,
      failureLabel: '자산 다운로드 실패',
      retryDelays: this.retryDelays,
      requestTimeoutMs: this.requestTimeoutMs,
    });
  }

  async fetchBinary({ sourceUrl }: { sourceUrl: string }) {
    return HttpUtil.fetchBinary({
      sourceUrl,
      headers: binaryHeaders,
      failureLabel: '자산 다운로드 실패',
      retryDelays: this.retryDelays,
      requestTimeoutMs: this.requestTimeoutMs,
    });
  }

  private async fetchJson<Result>({ url }: { url: string }): Promise<Result> {
    let lastError: Error | null = null;

    for (const retryDelay of this.retryDelays) {
      if (retryDelay > 0) {
        await delay(retryDelay);
      }

      let response: Response;

      try {
        response = await HttpUtil.fetchWithTimeout({
          url,
          headers: browserHeaders({ blogId: this.blogId }),
          requestTimeoutMs: this.requestTimeoutMs,
        });
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (HttpUtil.shouldRetryRequestError(error)) {
          continue;
        }

        throw lastError;
      }

      if (!response.ok) {
        lastError = new Error(
          `API 요청 실패: ${response.status} ${response.statusText}`,
        );

        if (HttpUtil.shouldRetryStatus(response.status)) {
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
}
