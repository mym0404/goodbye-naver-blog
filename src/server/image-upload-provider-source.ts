import os from "node:os"
import path from "node:path"

import type {
  UploadProviderCatalogResponse,
  UploadProviderDefinition,
  UploadProviderFieldDefinition,
  UploadProviderOptionValue,
  UploadProviderValue,
} from "../shared/types.js"
import { DEFAULT_UPLOAD_PROVIDER_KEY, UPLOAD_PROVIDER_KEYS } from "../shared/upload-provider-keys.js"

const providerLabelMap: Record<string, string> = {
  [UPLOAD_PROVIDER_KEYS.ADVANCED]: "Advanced Custom",
  [UPLOAD_PROVIDER_KEYS.ALIST]: "AList",
  [UPLOAD_PROVIDER_KEYS.ALIYUN]: "Aliyun OSS",
  [UPLOAD_PROVIDER_KEYS.AWS_S3]: "AWS S3",
  [UPLOAD_PROVIDER_KEYS.GITHUB]: "GitHub",
  [UPLOAD_PROVIDER_KEYS.IMGUR]: "Imgur",
  [UPLOAD_PROVIDER_KEYS.LOCAL]: "Local",
  [UPLOAD_PROVIDER_KEYS.LSKY]: "Lsky Pro",
  [UPLOAD_PROVIDER_KEYS.PICLIST]: "Runtime Server",
  [UPLOAD_PROVIDER_KEYS.QINIU]: "Qiniu",
  [UPLOAD_PROVIDER_KEYS.SFTP]: "Built-in SFTP",
  [UPLOAD_PROVIDER_KEYS.SMMS]: "SM.MS",
  [UPLOAD_PROVIDER_KEYS.TCYUN]: "Tencent COS",
  [UPLOAD_PROVIDER_KEYS.UPYUN]: "Upyun",
  [UPLOAD_PROVIDER_KEYS.WEBDAV]: "WebDAV",
}

const providerDescriptionMap: Record<string, string> = {
  [UPLOAD_PROVIDER_KEYS.ADVANCED]: "커스텀 HTTP 업로드 스크립트로 이미지를 전송합니다.",
  [UPLOAD_PROVIDER_KEYS.ALIST]: "AList 스토리지 경로로 이미지를 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.ALIYUN]: "Aliyun OSS 버킷에 이미지를 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.AWS_S3]: "S3 호환 버킷에 이미지를 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.GITHUB]: "리포지토리에 이미지를 커밋하고 URL로 사용합니다.",
  [UPLOAD_PROVIDER_KEYS.IMGUR]: "Imgur 계정 또는 익명 업로드로 이미지를 보관합니다.",
  [UPLOAD_PROVIDER_KEYS.LOCAL]: "현재 머신의 로컬 경로에 이미지를 저장합니다.",
  [UPLOAD_PROVIDER_KEYS.LSKY]: "Lsky Pro 이미지 호스팅 서버로 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.PICLIST]: "실행 중인 업로드 서버에 요청을 보냅니다.",
  [UPLOAD_PROVIDER_KEYS.QINIU]: "Qiniu 버킷과 CDN 주소를 사용해 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.SFTP]: "SFTP 서버 경로에 이미지를 전송합니다.",
  [UPLOAD_PROVIDER_KEYS.SMMS]: "SM.MS 토큰으로 이미지를 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.TCYUN]: "Tencent COS 버킷에 이미지를 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.UPYUN]: "Upyun 버킷과 가속 도메인을 사용해 업로드합니다.",
  [UPLOAD_PROVIDER_KEYS.WEBDAV]: "WebDAV 서버 경로에 이미지를 업로드합니다.",
}

type UploadFieldMetadata = Partial<
  Pick<UploadProviderFieldDefinition, "label" | "description" | "placeholder">
>

const commonFieldMetadata: Record<string, UploadFieldMetadata> = {
  accessKeyId: {
    label: "Access Key ID",
    description: "서비스에서 발급한 access key ID를 입력합니다.",
    placeholder: "AKIAxxxxxxxxxxxxx",
  },
  accessKeyID: {
    label: "Access Key ID",
    description: "서비스에서 발급한 access key ID를 입력합니다.",
    placeholder: "AKIAxxxxxxxxxxxxx",
  },
  accessKeySecret: {
    label: "Access Key Secret",
    description: "서비스에서 발급한 secret key를 입력합니다.",
    placeholder: "xxxxxxxxxx",
  },
  accessToken: {
    label: "Access Token",
    description: "서비스 API 접근용 access token을 입력합니다.",
    placeholder: "token_xxx",
  },
  acl: {
    label: "ACL",
    description: "업로드된 객체의 공개 권한 범위를 선택합니다.",
  },
  album: {
    label: "Album",
    description: "이미지를 넣을 앨범 이름이나 ID를 입력합니다.",
    placeholder: "example-album",
  },
  albumId: {
    label: "Album ID",
    description: "업로드에 사용할 앨범 ID를 입력합니다.",
    placeholder: "1",
  },
  antiLeechToken: {
    label: "Anti-Leech Token",
    description: "원본 서비스의 도메인 보호 토큰을 입력합니다.",
    placeholder: "token_xxx",
  },
  appId: {
    label: "App ID",
    description: "스토리지 서비스의 앱 ID를 입력합니다.",
    placeholder: "1234567890",
  },
  area: {
    label: "Area",
    description: "버킷이 속한 리전 코드를 입력합니다.",
    placeholder: "ap-seoul",
  },
  authType: {
    label: "Auth Type",
    description: "WebDAV 인증 방식을 선택합니다.",
  },
  body: {
    label: "Body",
    description: "추가로 보낼 JSON body를 입력합니다.",
    placeholder: "{\"key\":\"value\"}",
  },
  branch: {
    label: "Branch",
    description: "업로드를 커밋할 브랜치 이름입니다.",
    placeholder: "main",
  },
  bucket: {
    label: "Bucket",
    description: "이미지를 저장할 버킷 이름입니다.",
    placeholder: "example-bucket",
  },
  bucketName: {
    label: "Bucket Name",
    description: "이미지를 저장할 버킷 이름입니다.",
    placeholder: "example-bucket",
  },
  clientId: {
    label: "Client ID",
    description: "서비스에서 발급한 client ID를 입력합니다.",
    placeholder: "client_id_xxx",
  },
  configName: {
    label: "Config Name",
    description: "업로드 서버에서 사용할 설정 이름입니다.",
    placeholder: "default",
  },
  customPrefix: {
    label: "Custom Prefix",
    description: "응답 URL 앞에 붙일 고정 주소가 있으면 입력합니다.",
    placeholder: "https://cdn.example.com/",
  },
  customUrl: {
    label: "Custom URL",
    description: "최종 파일 URL을 직접 덮어쓸 때 사용합니다.",
    placeholder: "https://cdn.example.com",
  },
  dirMode: {
    label: "Dir Mode",
    description: "업로드된 디렉터리에 적용할 권한 값을 입력합니다.",
    placeholder: "0775",
  },
  disableBucketPrefixToURL: {
    label: "Hide Bucket Prefix In URL",
    description: "path style URL에서 bucket 접두사를 숨깁니다.",
  },
  endpoint: {
    label: "Endpoint",
    description: "기본 엔드포인트 대신 사용할 API 주소입니다.",
    placeholder: "https://example.com/upload",
  },
  expireTime: {
    label: "Expire Time",
    description: "서명 URL 만료 시간을 초 단위로 입력합니다.",
    placeholder: "3600",
  },
  fileMode: {
    label: "File Mode",
    description: "업로드된 파일에 적용할 권한 값을 입력합니다.",
    placeholder: "0664",
  },
  fileUser: {
    label: "File User",
    description: "업로드 후 소유권을 바꿀 사용자 또는 그룹입니다.",
    placeholder: "www-data:www-data",
  },
  formDataKey: {
    label: "Form Data Key",
    description: "업로드 파일을 보낼 form-data 키 이름입니다.",
    placeholder: "file",
  },
  headers: {
    label: "Headers",
    description: "추가로 보낼 HTTP 헤더를 JSON 형태로 입력합니다.",
    placeholder: "{\"Content-Type\":\"multipart/form-data\"}",
  },
  host: {
    label: "Host",
    description: "업로드 서버 호스트 주소입니다.",
    placeholder: "https://example.com",
  },
  method: {
    label: "Method",
    description: "업로드 요청에 사용할 HTTP 메서드입니다.",
  },
  operator: {
    label: "Operator",
    description: "서비스 로그인용 운영자 계정을 입력합니다.",
    placeholder: "operator-name",
  },
  options: {
    label: "Options",
    description: "서비스별 이미지 처리 옵션이나 쿼리를 입력합니다.",
    placeholder: "?imageMogr2/thumbnail/800x",
  },
  passphrase: {
    label: "Passphrase",
    description: "개인 키에 암호가 걸려 있으면 입력합니다.",
    placeholder: "passphrase",
  },
  password: {
    label: "Password",
    description: "서비스 로그인용 비밀번호입니다.",
    placeholder: "password",
  },
  path: {
    label: "Path",
    description: "원격 저장소 안에서 파일을 둘 하위 경로입니다.",
    placeholder: "images/posts",
  },
  pathStyleAccess: {
    label: "Path Style Access",
    description: "S3 URL을 path style 방식으로 생성합니다.",
  },
  permission: {
    label: "Permission",
    description: "이미지 공개 범위 또는 접근 권한을 선택합니다.",
  },
  picbed: {
    label: "PicBed",
    description: "업로드 서버에서 사용할 업로더 이름입니다.",
    placeholder: DEFAULT_UPLOAD_PROVIDER_KEY,
  },
  port: {
    label: "Port",
    description: "기본 포트 대신 사용할 포트 번호입니다.",
    placeholder: "36677",
  },
  privateKey: {
    label: "Private Key",
    description: "SFTP 접속에 사용할 개인 키 경로입니다.",
    placeholder: "/Users/name/.ssh/id_rsa",
  },
  proxy: {
    label: "Proxy",
    description: "업로드 요청에 사용할 프록시 주소입니다.",
    placeholder: "http://127.0.0.1:1080",
  },
  region: {
    label: "Region",
    description: "서비스 리전 코드를 입력합니다.",
    placeholder: "us-east-1",
  },
  rejectUnauthorized: {
    label: "Reject Invalid TLS Certificates",
    description: "유효하지 않은 TLS 인증서를 거부합니다.",
  },
  repo: {
    label: "Repository",
    description: "업로드할 GitHub 저장소 경로입니다.",
    placeholder: "owner/repo",
  },
  resDataPath: {
    label: "Response URL Path",
    description: "응답 JSON에서 최종 URL을 읽을 경로입니다.",
    placeholder: "data.url",
  },
  secretAccessKey: {
    label: "Secret Access Key",
    description: "서비스에서 발급한 secret access key를 입력합니다.",
    placeholder: "xxxxxxxxxx",
  },
  secretId: {
    label: "Secret ID",
    description: "서비스에서 발급한 secret ID를 입력합니다.",
    placeholder: "secret-id-xxx",
  },
  secretKey: {
    label: "Secret Key",
    description: "서비스에서 발급한 secret key를 입력합니다.",
    placeholder: "secret-key-xxx",
  },
  serverKey: {
    label: "Server Key",
    description: "업로드 서버 인증 키가 있으면 입력합니다.",
    placeholder: "server-key",
  },
  slim: {
    label: "Slim",
    description: "서비스가 지원하는 압축 옵션을 함께 사용합니다.",
  },
  sslEnabled: {
    label: "Use SSL",
    description: "WebDAV 서버에 HTTPS로 연결합니다.",
  },
  strategyId: {
    label: "Strategy ID",
    description: "Lsky Pro 전략 ID를 입력합니다.",
    placeholder: "1",
  },
  token: {
    label: "Token",
    description: "서비스 API 접근용 토큰을 입력합니다.",
    placeholder: "token_xxx",
  },
  uploadPath: {
    label: "Upload Path",
    description: "업로드된 파일 이름과 하위 경로 규칙입니다.",
    placeholder: "{year}/{month}/{md5}.{extName}",
  },
  uploadScriptName: {
    label: "Upload Script Name",
    description: "스크립트 디렉터리에 있는 업로드 스크립트 파일명입니다.",
    placeholder: "upload.js",
  },
  url: {
    label: "URL",
    description: "서비스 기본 주소나 업로드 후 접근할 기본 URL입니다.",
    placeholder: "https://example.com",
  },
  urlPrefix: {
    label: "URL Prefix",
    description: "업로드 후 URL 앞에 붙일 고정 주소입니다.",
    placeholder: "https://cdn.example.com",
  },
  username: {
    label: "Username",
    description: "서비스 로그인용 사용자 이름입니다.",
    placeholder: "username",
  },
  version: {
    label: "Version",
    description: "연동에 사용할 서비스 버전을 선택합니다.",
  },
  webPath: {
    label: "Web Path",
    description: "최종 URL 뒤쪽에 이어 붙일 웹 경로입니다.",
    placeholder: "images/posts",
  },
  webpath: {
    label: "Web Path",
    description: "최종 URL 뒤쪽에 이어 붙일 웹 경로입니다.",
    placeholder: "images/posts",
  },
}

const providerFieldMetadataMap: Record<string, Record<string, UploadFieldMetadata>> = {
  [UPLOAD_PROVIDER_KEYS.ADVANCED]: {
    endpoint: {
      placeholder: "https://example.com/upload",
    },
  },
  [UPLOAD_PROVIDER_KEYS.ALIST]: {
    url: {
      label: "Server URL",
      description: "AList 서버 주소입니다.",
      placeholder: "https://alist.example.com",
    },
    token: {
      description: "Token 인증을 사용할 때 입력합니다.",
      placeholder: "alist_token_xxx",
    },
    username: {
      description: "계정 인증을 사용할 때 사용자 이름을 입력합니다.",
    },
    password: {
      description: "계정 인증을 사용할 때 비밀번호를 입력합니다.",
    },
  },
  [UPLOAD_PROVIDER_KEYS.AWS_S3]: {
    uploadPath: {
      placeholder: "{year}/{month}/{md5}.{extName}",
    },
    options: {
      placeholder: "cacheControl=max-age=31536000",
    },
  },
  [UPLOAD_PROVIDER_KEYS.GITHUB]: {
    branch: {
      placeholder: "main",
    },
    token: {
      placeholder: "ghp_xxx",
    },
  },
  [UPLOAD_PROVIDER_KEYS.LSKY]: {
    version: {
      description: "Lsky Pro 서버 버전을 선택합니다.",
    },
  },
  [UPLOAD_PROVIDER_KEYS.PICLIST]: {
    host: {
      placeholder: "127.0.0.1",
    },
    port: {
      placeholder: "36677",
    },
  },
  [UPLOAD_PROVIDER_KEYS.SFTP]: {
    host: {
      placeholder: "sftp.example.com",
    },
  },
  [UPLOAD_PROVIDER_KEYS.TCYUN]: {
    version: {
      label: "COS Version",
      description: "Tencent COS SDK 버전을 선택합니다.",
    },
    slim: {
      description: "COS 이미지 처리 압축 옵션을 함께 사용합니다.",
    },
  },
  webdavplist: {
    host: {
      placeholder: "https://webdav.example.com",
    },
  },
}

type RuntimePluginField = {
  name?: string
  type?: string
  alias?: unknown
  required?: boolean
  default?: unknown
  message?: unknown
  prefix?: unknown
  choices?: unknown
}

type RuntimeCatalogLike = {
  helper: {
    uploader: {
      getIdList: () => string[]
      get: (id: string) =>
        | {
            name?: string
            config?: (ctx: RuntimeCatalogLike) => RuntimePluginField[]
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

const hasAscii = (value: string) => /[A-Za-z]/.test(value)
const containsCjk = (value: string) => /[\u3040-\u30ff\u3400-\u9fff\uf900-\ufaff]/.test(value)

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

const getProviderDescription = ({
  key,
  label,
}: {
  key: string
  label: string
}) => providerDescriptionMap[key] ?? `${label}로 이미지를 업로드합니다.`

const getCommonFieldMetadata = (key: string) => commonFieldMetadata[key] ?? null

const getProviderFieldMetadata = ({
  providerKey,
  fieldKey,
}: {
  providerKey: string
  fieldKey: string
}) => providerFieldMetadataMap[providerKey]?.[fieldKey] ?? null

const normalizeFieldLabel = ({
  providerKey,
  key,
  alias,
}: {
  providerKey: string
  key: string
  alias: unknown
}) => {
  const curatedLabel = getProviderFieldMetadata({
    providerKey,
    fieldKey: key,
  })?.label ?? getCommonFieldMetadata(key)?.label

  if (curatedLabel) {
    return curatedLabel
  }

  if (typeof alias === "string" && hasAscii(alias) && !containsCjk(alias)) {
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

const normalizeFieldDescription = ({
  providerKey,
  key,
  label,
  inputType,
}: {
  providerKey: string
  key: string
  label: string
  inputType: UploadProviderFieldDefinition["inputType"]
}) =>
  getProviderFieldMetadata({
    providerKey,
    fieldKey: key,
  })?.description ??
  getCommonFieldMetadata(key)?.description ??
  (inputType === "checkbox" ? `${label} 옵션입니다.` : `${label} 값을 입력합니다.`)

const normalizeFieldPlaceholder = ({
  providerKey,
  key,
  rawPlaceholder,
}: {
  providerKey: string
  key: string
  rawPlaceholder: unknown
}) => {
  const curatedPlaceholder = getProviderFieldMetadata({
    providerKey,
    fieldKey: key,
  })?.placeholder ?? getCommonFieldMetadata(key)?.placeholder

  if (curatedPlaceholder) {
    return curatedPlaceholder
  }

  if (typeof rawPlaceholder !== "string") {
    return ""
  }

  const trimmed = rawPlaceholder.trim()

  if (!trimmed || containsCjk(trimmed)) {
    return ""
  }

  return trimmed
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

const normalizeOptionLabel = (value: unknown, rawLabel: unknown) => {
  if (typeof rawLabel === "string" && rawLabel.trim() && !containsCjk(rawLabel)) {
    return rawLabel.trim()
  }

  if (typeof value === "string") {
    return containsCjk(value) ? String(value) : value
  }

  return String(value)
}

const normalizeFieldOptions = (choices: unknown): UploadProviderFieldDefinition["options"] => {
  if (!Array.isArray(choices)) {
    return undefined
  }

  const options = choices.flatMap((choice) => {
    if (typeof choice === "string" || typeof choice === "number") {
      return [
        {
          label: normalizeOptionLabel(choice, choice),
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
          label: normalizeOptionLabel(choice.value, choice.name),
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

const normalizeFieldDefinition = ({
  providerKey,
  field,
}: {
  providerKey: string
  field: RuntimePluginField
}): UploadProviderFieldDefinition | null => {
  const key = field.name?.trim()

  if (!key) {
    return null
  }

  const inputType = inferInputType({
    key,
    type: field.type,
    defaultValue: field.default,
  })
  const label = normalizeFieldLabel({
    providerKey,
    key,
    alias: field.alias,
  })

  return {
    key,
    label,
    description: normalizeFieldDescription({
      providerKey,
      key,
      label,
      inputType,
    }),
    inputType,
    required: field.required === true,
    defaultValue: normalizeDefaultValue({
      inputType,
      defaultValue: field.default,
    }),
    placeholder: normalizeFieldPlaceholder({
      providerKey,
      key,
      rawPlaceholder:
        typeof field.message === "string"
          ? field.message
          : typeof field.prefix === "string"
            ? field.prefix
            : "",
    }),
    options: normalizeFieldOptions(field.choices),
  }
}

const createCatalogFromRuntime = (runtimeCatalog: RuntimeCatalogLike): UploadProviderCatalogResponse => {
  const providers = runtimeCatalog.helper.uploader
    .getIdList()
    .map((key) => {
      const uploader = runtimeCatalog.helper.uploader.get(key)
      const label = normalizeProviderLabel(key, uploader?.name)
      const rawFields = uploader?.config?.(runtimeCatalog) ?? []
      const fields = rawFields
        .map((field) =>
          normalizeFieldDefinition({
            providerKey: key,
            field,
          }),
        )
        .filter((field): field is UploadProviderFieldDefinition => field !== null)

      return {
        key,
        label,
        description: getProviderDescription({
          key,
          label,
        }),
        fields,
      } satisfies UploadProviderDefinition
    })

  const defaultProviderKey =
    providers.find((provider) => provider.key === DEFAULT_UPLOAD_PROVIDER_KEY)?.key ??
    providers[0]?.key ??
    null

  return {
    defaultProviderKey,
    providers,
  }
}

const createRuntimeInstance = async () => {
  const { PicGo } = await import("piclist")
  const runtimeConfigPath = path.join(os.tmpdir(), "farewell-naver-blog-image-upload-config.json")

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

export const createImageUploadProviderSource = (): UploadProviderSource => {
  let catalogPromise: Promise<UploadProviderCatalogResponse> | null = null

  const getCatalog = async () => {
    if (!catalogPromise) {
      catalogPromise = (async () => {
        const runtimeCatalog = await createRuntimeInstance()
        return createCatalogFromRuntime(runtimeCatalog)
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
