import { access, readFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { createRequire } from "node:module"

import type {
  UploadProviderCatalogResponse,
  UploadProviderDefinition,
  UploadProviderFieldDefinition,
  UploadProviderOptionValue,
  UploadProviderValue,
} from "../shared/types.js"

const defaultClonePathCandidates = [
  path.join(os.homedir(), "Downloads", "PicList"),
  path.join(os.homedir(), "Downloads", "piclist"),
]

const providerLabelMap: Record<string, string> = {
  advancedplist: "Advanced Custom",
  alistplist: "AList",
  aliyun: "Aliyun OSS",
  "aws-s3-plist": "AWS S3",
  github: "GitHub",
  imgur: "Imgur",
  local: "Local",
  lskyplist: "Lsky Pro",
  piclist: "PicList",
  qiniu: "Qiniu",
  sftpplist: "Built-in SFTP",
  smms: "SM.MS",
  tcyun: "Tencent COS",
  upyun: "Upyun",
  webdavplist: "WebDAV",
}

type PicListPluginField = {
  name?: string
  type?: string
  alias?: unknown
  required?: boolean
  default?: unknown
  message?: unknown
  prefix?: unknown
  choices?: unknown
}

type PicListLike = {
  helper: {
    uploader: {
      getIdList: () => string[]
      get: (id: string) =>
        | {
            name?: string
            config?: (ctx: PicListLike) => PicListPluginField[]
          }
        | undefined
    }
  }
}

export type UploadProviderSource = {
  getCatalog: () => Promise<UploadProviderCatalogResponse>
  normalizeProviderFields: (
    providerKey: string,
    value: unknown,
  ) => Promise<Record<string, UploadProviderValue> | null>
}

const fileExists = async (targetPath: string) => {
  try {
    await access(targetPath)
    return true
  } catch {
    return false
  }
}

const hasAscii = (value: string) => /[A-Za-z]/.test(value)

const toTitleCaseLabel = (value: string) =>
  value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((part) => {
      const upper = part.toUpperCase()

      if (["ACL", "API", "COS", "ID", "OSS", "S3", "SMMS", "URL"].includes(upper)) {
        return upper
      }

      return part.charAt(0).toUpperCase() + part.slice(1)
    })
    .join(" ")

const normalizeFieldLabel = (key: string, alias: unknown) => {
  if (typeof alias === "string" && hasAscii(alias)) {
    return alias.trim()
  }

  return toTitleCaseLabel(key)
}

const normalizeProviderLabel = (key: string, label: unknown) => {
  if (providerLabelMap[key]) {
    return providerLabelMap[key]
  }

  if (typeof label === "string" && hasAscii(label)) {
    return label.trim()
  }

  return toTitleCaseLabel(key)
}

const inferInputType = ({
  key,
  type,
  defaultValue,
}: {
  key: string
  type: string | undefined
  defaultValue: unknown
}): UploadProviderFieldDefinition["inputType"] => {
  if (type === "list") {
    return "select"
  }

  if (type === "confirm") {
    return "checkbox"
  }

  if (typeof defaultValue === "number" || /(?:^|[^a-z])(port|expireTime)(?:$|[^a-z])/i.test(key)) {
    return "number"
  }

  if (
    /(token|password|secret|passphrase|privateKey|accessKeySecret|secretAccessKey)/i.test(key)
  ) {
    return "password"
  }

  return "text"
}

const normalizeFieldOptions = (choices: unknown): UploadProviderFieldDefinition["options"] => {
  if (!Array.isArray(choices)) {
    return undefined
  }

  const options = choices.flatMap((choice) => {
    if (typeof choice === "string" || typeof choice === "number") {
      return [
        {
          label: String(choice),
          value: choice,
        },
      ]
    }

    if (
      choice &&
      typeof choice === "object" &&
      "name" in choice &&
      "value" in choice &&
      (typeof choice.value === "string" || typeof choice.value === "number")
    ) {
      return [
        {
          label: String(choice.name),
          value: choice.value as UploadProviderOptionValue,
        },
      ]
    }

    return []
  })

  return options.length > 0 ? options : undefined
}

const normalizeDefaultValue = ({
  inputType,
  defaultValue,
}: {
  inputType: UploadProviderFieldDefinition["inputType"]
  defaultValue: unknown
}): UploadProviderValue | null => {
  if (defaultValue === undefined || defaultValue === null || defaultValue === "") {
    return inputType === "checkbox" ? false : null
  }

  if (inputType === "checkbox") {
    return Boolean(defaultValue)
  }

  if (inputType === "number") {
    if (typeof defaultValue === "number" && Number.isFinite(defaultValue)) {
      return defaultValue
    }

    if (typeof defaultValue === "string" && defaultValue.trim()) {
      const parsed = Number(defaultValue)

      if (Number.isFinite(parsed)) {
        return parsed
      }
    }
  }

  if (typeof defaultValue === "string" || typeof defaultValue === "number") {
    return defaultValue
  }

  return null
}

const normalizeFieldDefinition = (field: PicListPluginField): UploadProviderFieldDefinition | null => {
  const key = field.name?.trim()

  if (!key) {
    return null
  }

  const inputType = inferInputType({
    key,
    type: field.type,
    defaultValue: field.default,
  })

  return {
    key,
    label: normalizeFieldLabel(key, field.alias),
    inputType,
    required: field.required === true,
    defaultValue: normalizeDefaultValue({
      inputType,
      defaultValue: field.default,
    }),
    placeholder:
      typeof field.message === "string"
        ? field.message
        : typeof field.prefix === "string"
          ? field.prefix
          : "",
    options: normalizeFieldOptions(field.choices),
  }
}

const createCatalogFromRuntime = (piclist: PicListLike): UploadProviderCatalogResponse => {
  const providers = piclist.helper.uploader
    .getIdList()
    .map((key) => {
      const uploader = piclist.helper.uploader.get(key)
      const rawFields = uploader?.config?.(piclist) ?? []
      const fields = rawFields
        .map((field) => normalizeFieldDefinition(field))
        .filter((field): field is UploadProviderFieldDefinition => field !== null)

      return {
        key,
        label: normalizeProviderLabel(key, uploader?.name),
        fields,
      } satisfies UploadProviderDefinition
    })

  const defaultProviderKey =
    providers.find((provider) => provider.key === "github")?.key ??
    providers[0]?.key ??
    null

  return {
    defaultProviderKey,
    providers,
  }
}

const resolveClonePath = async (clonePathCandidates: string[]) => {
  for (const clonePath of clonePathCandidates) {
    if (await fileExists(path.join(clonePath, "package.json"))) {
      return clonePath
    }
  }

  throw new Error("PicList clone not found under ~/Downloads")
}

const readCloneMetadata = async (clonePath: string) => {
  const packageJsonPath = path.join(clonePath, "package.json")
  const clonePackage = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
    version?: string
    dependencies?: {
      piclist?: string
    }
  }
  const sourceMarkerPaths = [
    path.join(clonePath, "src", "renderer", "utils", "static.ts"),
    path.join(clonePath, "src", "main", "utils", "static.ts"),
  ]

  for (const sourceMarkerPath of sourceMarkerPaths) {
    if (!(await fileExists(sourceMarkerPath))) {
      throw new Error(`PicList source definition is missing: ${sourceMarkerPath}`)
    }
  }

  return {
    cloneVersion: clonePackage.version ?? "unknown",
    runtimeRange: clonePackage.dependencies?.piclist ?? "",
  }
}

const warnVersionMismatch = async ({
  cloneVersion,
  runtimeRange,
}: {
  cloneVersion: string
  runtimeRange: string
}) => {
  const require = createRequire(import.meta.url)
  const runtimePackage = require("piclist/package.json") as {
    version?: string
  }
  const installedVersion = runtimePackage.version ?? "unknown"

  if (!runtimeRange) {
    console.warn(
      `[PicList SoT] clone version ${cloneVersion} does not declare a piclist runtime dependency.`,
    )
    return
  }

  const normalizedExpectedVersion = runtimeRange.replace(/^[~^]/, "")

  if (installedVersion !== normalizedExpectedVersion) {
    console.warn(
      `[PicList SoT] clone ${cloneVersion} expects piclist ${runtimeRange}, but installed runtime is ${installedVersion}.`,
    )
  }
}

const createRuntimeInstance = async () => {
  const { PicGo } = await import("piclist")
  const runtimeConfigPath = path.join(os.tmpdir(), "farewell-naver-blog-piclist-config.json")

  return PicGo.create(runtimeConfigPath)
}

const coerceCheckboxValue = (rawValue: unknown) => {
  if (typeof rawValue === "boolean") {
    return rawValue
  }

  if (typeof rawValue !== "string") {
    return null
  }

  const normalized = rawValue.trim().toLowerCase()

  if (normalized === "true" || normalized === "1" || normalized === "on") {
    return true
  }

  if (normalized === "false" || normalized === "0" || normalized === "off") {
    return false
  }

  return null
}

const coerceNumberValue = (rawValue: unknown) => {
  if (typeof rawValue === "number" && Number.isFinite(rawValue)) {
    return rawValue
  }

  if (typeof rawValue !== "string") {
    return null
  }

  const trimmed = rawValue.trim()

  if (!trimmed) {
    return null
  }

  const parsed = Number(trimmed)

  return Number.isFinite(parsed) ? parsed : null
}

const coerceSelectValue = ({
  rawValue,
  field,
}: {
  rawValue: unknown
  field: UploadProviderFieldDefinition
}) => {
  if (!field.options || field.options.length === 0) {
    return typeof rawValue === "string" && rawValue.trim() ? rawValue.trim() : null
  }

  const matched = field.options.find((option) => String(option.value) === String(rawValue))

  return matched?.value ?? null
}

const coerceTextValue = (rawValue: unknown) => {
  if (typeof rawValue !== "string") {
    return null
  }

  const trimmed = rawValue.trim()

  return trimmed ? trimmed : null
}

export const createPicListUploadProviderSource = ({
  clonePathCandidates = defaultClonePathCandidates,
}: {
  clonePathCandidates?: string[]
} = {}): UploadProviderSource => {
  let catalogPromise: Promise<UploadProviderCatalogResponse> | null = null

  const getCatalog = async () => {
    if (!catalogPromise) {
      catalogPromise = (async () => {
        const clonePath = await resolveClonePath(clonePathCandidates)
        const cloneMetadata = await readCloneMetadata(clonePath)

        await warnVersionMismatch(cloneMetadata)

        const piclist = await createRuntimeInstance()
        return createCatalogFromRuntime(piclist)
      })()
    }

    return catalogPromise
  }

  const normalizeProviderFields = async (providerKey: string, value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null
    }

    const catalog = await getCatalog()
    const provider = catalog.providers.find((item) => item.key === providerKey)

    if (!provider) {
      return null
    }

    const entries: Array<readonly [string, UploadProviderValue]> = []

    for (const field of provider.fields) {
      const rawValue = (value as Record<string, unknown>)[field.key]

      if (rawValue === undefined || rawValue === null) {
        continue
      }

      if (field.inputType === "checkbox") {
        const coerced = coerceCheckboxValue(rawValue)

        if (coerced !== null) {
          entries.push([field.key, coerced] as const)
        }

        continue
      }

      if (field.inputType === "number") {
        const coerced = coerceNumberValue(rawValue)

        if (coerced !== null) {
          entries.push([field.key, coerced] as const)
        }

        continue
      }

      if (field.inputType === "select") {
        const coerced = coerceSelectValue({
          rawValue,
          field,
        })

        if (coerced !== null) {
          entries.push([field.key, coerced] as const)
        }

        continue
      }

      const coerced = coerceTextValue(rawValue)

      if (coerced !== null) {
        entries.push([field.key, coerced] as const)
      }
    }

    if (entries.length === 0) {
      return null
    }

    return Object.fromEntries(entries)
  }

  return {
    getCatalog,
    normalizeProviderFields,
  }
}
