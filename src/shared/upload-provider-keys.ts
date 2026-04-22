export const UPLOAD_PROVIDER_KEYS = {
  ADVANCED: "advancedplist",
  ALIST: "alistplist",
  ALIYUN: "aliyun",
  AWS_S3: "aws-s3-plist",
  GITHUB: "github",
  IMGUR: "imgur",
  LOCAL: "local",
  LSKY: "lskyplist",
  PICLIST: "piclist",
  QINIU: "qiniu",
  SFTP: "sftpplist",
  SMMS: "smms",
  TCYUN: "tcyun",
  UPYUN: "upyun",
  WEBDAV: "webdavplist",
} as const

export type KnownUploadProviderKey =
  (typeof UPLOAD_PROVIDER_KEYS)[keyof typeof UPLOAD_PROVIDER_KEYS]

export const DEFAULT_UPLOAD_PROVIDER_KEY = UPLOAD_PROVIDER_KEYS.GITHUB
export const EMPTY_SELECT_VALUE = "__none__"
