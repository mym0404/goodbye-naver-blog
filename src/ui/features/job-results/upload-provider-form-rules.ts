import type {
  UploadProviderDefinition,
  UploadProviderFieldDefinition,
  UploadProviderValue,
} from "../../../shared/types.js"
import { UPLOAD_PROVIDER_KEYS } from "../../../shared/upload-provider-keys.js"

export type ProviderFormState = Record<string, string | number | boolean>

export type ProviderUiState = {
  alistAuthMode: "token" | "account"
  githubUseJsDelivr: boolean
}

export type UploadProviderFieldRule = {
  description: string
  disabled: boolean
  disabledReason: string | null
  required: boolean
}

export const buildInitialProviderUiState = (): ProviderUiState => ({
  alistAuthMode: "token",
  githubUseJsDelivr: false,
})

const isFilledTextValue = (value: string | number | boolean | undefined) =>
  typeof value === "string" && value.trim().length > 0

export const getUploadProviderFieldRule = ({
  providerKey,
  field,
  providerFields,
  providerUiState,
}: {
  providerKey: string
  field: UploadProviderFieldDefinition
  providerFields: ProviderFormState
  providerUiState: ProviderUiState
}): UploadProviderFieldRule => {
  const baseRule: UploadProviderFieldRule = {
    description: field.description,
    disabled: false,
    disabledReason: null,
    required: field.required,
  }

  if (
    providerKey === UPLOAD_PROVIDER_KEYS.GITHUB &&
    field.key === "customUrl" &&
    providerUiState.githubUseJsDelivr
  ) {
    return {
      ...baseRule,
      disabled: true,
      disabledReason: "jsDelivr CDN을 사용 중이면 Custom URL은 자동으로 계산됩니다.",
    }
  }

  if (providerKey === UPLOAD_PROVIDER_KEYS.ALIST) {
    if (field.key === "token") {
      return {
        ...baseRule,
        disabled: providerUiState.alistAuthMode !== "token",
        disabledReason:
          providerUiState.alistAuthMode !== "token"
            ? "계정 인증을 선택하면 Token 입력은 사용하지 않습니다."
            : null,
        required: providerUiState.alistAuthMode === "token",
      }
    }

    if (field.key === "username" || field.key === "password") {
      return {
        ...baseRule,
        disabled: providerUiState.alistAuthMode !== "account",
        disabledReason:
          providerUiState.alistAuthMode !== "account"
            ? "Token 인증을 선택하면 계정 입력은 사용하지 않습니다."
            : null,
        required: providerUiState.alistAuthMode === "account",
      }
    }
  }

  if (
    providerKey === UPLOAD_PROVIDER_KEYS.AWS_S3 &&
    field.key === "disableBucketPrefixToURL" &&
    providerFields.pathStyleAccess !== true
  ) {
    return {
      ...baseRule,
      disabled: true,
      disabledReason: "Path Style Access를 켜야 이 옵션을 사용할 수 있습니다.",
    }
  }

  if (
    providerKey === UPLOAD_PROVIDER_KEYS.LSKY &&
    field.key === "albumId" &&
    String(providerFields.version ?? "").trim() !== "V2"
  ) {
    return {
      ...baseRule,
      disabled: true,
      disabledReason: "Lsky Pro V2를 선택한 경우에만 Album ID를 사용할 수 있습니다.",
    }
  }

  if (
    providerKey === UPLOAD_PROVIDER_KEYS.SFTP &&
    field.key === "passphrase" &&
    !isFilledTextValue(providerFields.privateKey)
  ) {
    return {
      ...baseRule,
      disabled: true,
      disabledReason: "Private Key를 입력하면 Passphrase를 사용할 수 있습니다.",
    }
  }

  return baseRule
}

export const hasMissingRequiredUploadProviderField = ({
  provider,
  providerFields,
  providerUiState,
}: {
  provider: UploadProviderDefinition | null
  providerFields: ProviderFormState
  providerUiState: ProviderUiState
}) =>
  (provider?.fields ?? []).some((field) => {
    const rule = getUploadProviderFieldRule({
      providerKey: provider?.key ?? "",
      field,
      providerFields,
      providerUiState,
    })

    if (!rule.required || rule.disabled) {
      return false
    }

    return field.inputType === "checkbox"
      ? typeof providerFields[field.key] !== "boolean"
      : !String(providerFields[field.key] ?? "").trim()
  })

export const trimProviderFieldsForSubmit = ({
  provider,
  providerFields,
  providerUiState,
}: {
  provider: UploadProviderDefinition | null
  providerFields: ProviderFormState
  providerUiState: ProviderUiState
}) =>
  Object.fromEntries(
    (provider?.fields ?? []).reduce<Array<readonly [string, UploadProviderValue]>>((entries, field) => {
      const rule = getUploadProviderFieldRule({
        providerKey: provider?.key ?? "",
        field,
        providerFields,
        providerUiState,
      })

      if (rule.disabled) {
        return entries
      }

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
