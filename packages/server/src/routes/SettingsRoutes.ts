import { isExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"
import { sanitizePersistedExportOptions } from "@exitpress/domain/export-options/ExportOptions.js"
import { toErrorMessage } from "@exitpress/engine/shared/error/util/toErrorMessage.js"

import type { PartialExportOptions } from "@exitpress/domain/export-options/schema/ExportOptions.js"

import type { ApiRouteContext, ApiRouteRequest } from "./ApiRouteContext.js"

import { isPlainObject, parseJsonBody, sendJson } from "../http/HttpResponse.js"

import { rejectNonJson } from "./RouteSupport.js"

export const handleSettingsRoutes =
  ({ state }: ApiRouteContext) =>
  async ({ request, response, method, url }: ApiRouteRequest) => {
    if (method === "GET" && url.pathname === "/api/export-defaults") {
      sendJson({
        response,
        statusCode: 200,
        body: await state.buildBootstrapResponse(),
      })
      return true
    }

    if (method !== "POST" || url.pathname !== "/api/export-settings") {
      return false
    }

    if (rejectNonJson(request, response)) {
      return true
    }

    const payload = await parseJsonBody<{
      options?: unknown
      themePreference?: unknown
      profile?: unknown
    }>(request)

    if (
      !isPlainObject(payload) ||
      !isPlainObject(payload.options) ||
      (payload.themePreference !== undefined &&
        payload.themePreference !== "dark" &&
        payload.themePreference !== "light") ||
      (payload.profile !== undefined && !isExportProfile(payload.profile))
    ) {
      sendJson({
        response,
        statusCode: 400,
        body: {
          error: "options 객체와 themePreference 값이 올바른지 확인하세요.",
        },
      })
      return true
    }

    try {
      const sanitizedOptions = sanitizePersistedExportOptions(
        payload.options as PartialExportOptions,
      )

      state.cloneOptions(sanitizedOptions)
      await state.writeUiState({
        options: sanitizedOptions,
        themePreference:
          payload.themePreference === "dark" || payload.themePreference === "light"
            ? payload.themePreference
            : undefined,
        profile: isExportProfile(payload.profile) ? payload.profile : undefined,
      })
    } catch (error) {
      sendJson({
        response,
        statusCode: 400,
        body: {
          error: toErrorMessage(error),
        },
      })
      return true
    }

    response.writeHead(204)
    response.end()
    return true
  }
