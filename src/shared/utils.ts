import path from "node:path"
import { mkdir, rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"

export {
  formatCategorySegment,
  formatTitleSegment,
  getDateSlug,
  sanitizeCategoryName,
  sanitizePathSegment,
  slugifyTitle,
} from "./path-format.js"

const markdownLineWhitespacePattern = /[^\S\n]+/g
const repoRootDir = fileURLToPath(new URL("../..", import.meta.url))

export const resolveRepoPath = (targetPath: string) =>
  path.isAbsolute(targetPath) ? targetPath : path.resolve(repoRootDir, targetPath)

export const ensureDir = async (targetPath: string) => {
  await mkdir(targetPath, { recursive: true })
}

export const recreateDir = async (targetPath: string) => {
  await rm(targetPath, { recursive: true, force: true })
  await mkdir(targetPath, { recursive: true })
}

export const extractBlogId = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    throw new Error("blogId 또는 blog URL을 입력해야 합니다.")
  }

  const urlMatch = trimmed.match(/blog\.naver\.com\/([^/?#]+)/i)

  if (urlMatch?.[1]) {
    return urlMatch[1]
  }

  const mobileQueryMatch = trimmed.match(/blogId=([^&#]+)/i)

  if (mobileQueryMatch?.[1]) {
    return mobileQueryMatch[1]
  }

  return trimmed
}

export const toKstDateTime = (timestamp: number) => {
  const formatter = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })

  const parts = formatter.formatToParts(new Date(timestamp))
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00"

  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}+09:00`
}

export const getSourceUrl = ({ blogId, logNo }: { blogId: string; logNo: string }) =>
  `https://blog.naver.com/${blogId}/${logNo}`

export const relativePathFrom = ({
  from,
  to,
}: {
  from: string
  to: string
}) => path.relative(path.dirname(from), to).split(path.sep).join("/")

export const compactText = (value: string) =>
  value.replace(/\u200b/g, "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim()

export const compactMarkdownText = (value: string) =>
  value
    .replace(/\u200b/g, "")
    .replace(/\u00a0/g, " ")
    .split("\n")
    .map((line) => {
      const hasHardBreak = / {2}$/.test(line)
      const normalizedLine = line.replace(markdownLineWhitespacePattern, " ").trimEnd()

      return hasHardBreak && normalizedLine ? `${normalizedLine}  ` : normalizedLine
    })
    .join("\n")
    .trim()

export const normalizeAssetUrl = (value: string) => {
  const trimmed = value.trim()

  if (!trimmed) {
    return ""
  }

  try {
    const url = new URL(trimmed)

    if (
      url.hostname === "mblogthumb-phinf.pstatic.net" &&
      (!url.searchParams.has("type") || url.searchParams.get("type") === "")
    ) {
      url.searchParams.set("type", "w800")
    }

    return url.toString()
  } catch {
    return trimmed
  }
}

export const unique = <Type>(values: Type[]) => [...new Set(values)]

export const toErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export class AbortOperationError extends Error {
  constructor(message = "작업이 중단되었습니다.") {
    super(message)
    this.name = "AbortOperationError"
  }
}

export const isAbortOperationError = (error: unknown): error is AbortOperationError =>
  error instanceof AbortOperationError

export const throwIfAborted = (
  signal?: AbortSignal | null,
  message = "작업이 중단되었습니다.",
) => {
  if (signal?.aborted) {
    throw new AbortOperationError(message)
  }
}

export const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms)
  })

export const mapConcurrent = async <Item, Result>({
  items,
  concurrency,
  mapper,
}: {
  items: Item[]
  concurrency: number
  mapper: (item: Item, index: number) => Promise<Result>
}) => {
  const results = new Array<Result>(items.length)
  let cursor = 0

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const currentIndex = cursor
      cursor += 1
      results[currentIndex] = await mapper(items[currentIndex], currentIndex)
    }
  })

  await Promise.all(workers)

  return results
}
