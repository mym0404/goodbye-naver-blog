import { useEffect, useState } from "react"

import type {
  UploadProviderCatalogResponse,
  UploadProviderDefinition,
} from "../../../shared/types.js"
import { buildInitialProviderUiState, type ProviderFormState, type ProviderUiState } from "./upload-provider-form-rules.js"
import {
  buildGitHubJsDelivrCustomUrl,
  buildInitialProviderFieldMap,
  buildInitialProviderFields,
  getPreferredDefaultProviderKey,
  isGitHubProvider,
} from "./job-results-helpers.js"

const buildInitialProviderUiStateMap = (catalog: UploadProviderCatalogResponse) =>
  Object.fromEntries(
    catalog.providers.map((provider) => [provider.key, buildInitialProviderUiState()]),
  ) as Record<string, ProviderUiState>

export const useUploadProviderForm = ({
  jobId,
  uploadProviders,
}: {
  jobId: string | undefined
  uploadProviders: UploadProviderCatalogResponse
}) => {
  const [providerKey, setProviderKey] = useState(() => getPreferredDefaultProviderKey(uploadProviders))
  const [providerFieldMap, setProviderFieldMap] = useState<Record<string, ProviderFormState>>(() =>
    buildInitialProviderFieldMap(uploadProviders),
  )
  const [providerUiStateMap, setProviderUiStateMap] = useState<Record<string, ProviderUiState>>(() =>
    buildInitialProviderUiStateMap(uploadProviders),
  )

  useEffect(() => {
    if (!jobId) {
      return
    }

    setProviderKey(getPreferredDefaultProviderKey(uploadProviders))
    setProviderFieldMap(buildInitialProviderFieldMap(uploadProviders))
    setProviderUiStateMap(buildInitialProviderUiStateMap(uploadProviders))
  }, [jobId, uploadProviders])

  const activeProviderDefinition =
    uploadProviders.providers.find((provider) => provider.key === providerKey) ?? null
  const activeProviderFields =
    providerFieldMap[providerKey] ?? buildInitialProviderFields(activeProviderDefinition)
  const activeProviderUiState =
    providerUiStateMap[providerKey] ?? buildInitialProviderUiState()
  const githubUseJsDelivr = activeProviderUiState.githubUseJsDelivr
  const githubJsDelivrUrl = buildGitHubJsDelivrCustomUrl({
    repo: String(activeProviderFields.repo ?? ""),
    branch: String(activeProviderFields.branch ?? ""),
  })

  const updateProviderField = (key: string, value: ProviderFormState[string]) => {
    setProviderFieldMap((current) => ({
      ...current,
      [providerKey]: {
        ...(current[providerKey] ?? buildInitialProviderFields(activeProviderDefinition)),
        [key]: value,
      },
    }))
  }

  const updateProviderUiState = (nextState: Partial<ProviderUiState>) => {
    setProviderUiStateMap((current) => ({
      ...current,
      [providerKey]: {
        ...activeProviderUiState,
        ...nextState,
      },
    }))
  }

  const selectProvider = (nextProviderKey: string) => {
    setProviderKey(nextProviderKey)
    setProviderFieldMap((current) =>
      current[nextProviderKey]
        ? current
        : {
            ...current,
            [nextProviderKey]: buildInitialProviderFields(
              uploadProviders.providers.find((provider) => provider.key === nextProviderKey) ?? null,
            ),
          },
    )
    setProviderUiStateMap((current) =>
      current[nextProviderKey]
        ? current
        : {
            ...current,
            [nextProviderKey]: buildInitialProviderUiState(),
          },
    )
  }

  return {
    providerKey,
    providerFieldMap,
    providerUiStateMap,
    activeProviderDefinition,
    activeProviderFields,
    activeProviderUiState,
    githubUseJsDelivr,
    githubJsDelivrUrl,
    isGitHubProvider: isGitHubProvider(providerKey),
    selectProvider,
    updateProviderField,
    updateProviderUiState,
  }
}
