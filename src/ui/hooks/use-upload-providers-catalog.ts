import { useEffect, useState } from "react"

import type { UploadProviderCatalogResponse } from "../../shared/types.js"
import type { UploadProvidersResponse } from "../lib/api.js"
import { fetchJson } from "../lib/api.js"

const fallbackUploadProviders: UploadProviderCatalogResponse = {
  defaultProviderKey: null,
  providers: [],
}

const uploadProviderLoadErrorMessage = "업로드 설정을 불러오지 못했습니다."

export const useUploadProvidersCatalog = ({
  jobId,
  shouldLoad,
}: {
  jobId: string | undefined
  shouldLoad: boolean
}) => {
  const [uploadProviders, setUploadProviders] = useState(fallbackUploadProviders)
  const [uploadProviderError, setUploadProviderError] = useState<string | null>(null)

  useEffect(() => {
    setUploadProviders(fallbackUploadProviders)
    setUploadProviderError(null)
  }, [jobId])

  useEffect(() => {
    if (!shouldLoad || uploadProviders.providers.length > 0 || uploadProviderError) {
      return
    }

    let cancelled = false

    const loadUploadProviders = async () => {
      try {
        const nextCatalog = await fetchJson<UploadProvidersResponse>("/api/upload-providers")

        if (cancelled) {
          return
        }

        setUploadProviders(nextCatalog)
        setUploadProviderError(null)
      } catch {
        if (cancelled) {
          return
        }

        setUploadProviders(fallbackUploadProviders)
        setUploadProviderError(uploadProviderLoadErrorMessage)
      }
    }

    void loadUploadProviders()

    return () => {
      cancelled = true
    }
  }, [shouldLoad, uploadProviderError, uploadProviders.providers.length])

  return {
    uploadProviders,
    uploadProviderError,
  }
}
