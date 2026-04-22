import { execFile } from "node:child_process"
import path from "node:path"
import type { IncomingMessage } from "node:http"

import { resolveRepoPath } from "../shared/utils.js"

const TEMP_OUTPUT_ROOTS = ["/tmp", "/private/tmp"] as const

export const isSameOriginUploadRequest = (request: IncomingMessage) => {
  if (request.headers["x-requested-with"] !== "XMLHttpRequest") {
    return false
  }

  const originHeader = request.headers.origin
  const hostHeader = request.headers.host

  if (!originHeader || !hostHeader) {
    return false
  }

  try {
    return new URL(originHeader).host === hostHeader
  } catch {
    return false
  }
}

export const isPathInsideRoot = ({
  rootPath,
  targetPath,
}: {
  rootPath: string
  targetPath: string
}) => {
  const relativePath = path.relative(rootPath, targetPath)

  return relativePath === "" || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath))
}

export const resolveLocalOutputTargetPath = ({
  outputDir,
  outputPath,
}: {
  outputDir: string
  outputPath: string
}) => {
  const outputRoot = resolveRepoPath(outputDir.trim())
  const targetPath = path.resolve(outputRoot, outputPath.trim())

  return {
    outputRoot,
    targetPath,
  }
}

export const isTemporaryResumeOutputDir = (outputDir: string) => {
  const trimmedOutputDir = outputDir.trim()

  if (!trimmedOutputDir) {
    return false
  }

  const resolvedOutputDir = path.resolve(trimmedOutputDir)

  return TEMP_OUTPUT_ROOTS.some((rootPath) =>
    isPathInsideRoot({
      rootPath,
      targetPath: resolvedOutputDir,
    }),
  )
}

export const openLocalPathWithSystem = async (targetPath: string) => {
  await new Promise<void>((resolve, reject) => {
    const [command, args]: [string, string[]] =
      process.platform === "darwin"
        ? ["open", [targetPath]]
        : process.platform === "win32"
          ? ["cmd", ["/c", "start", "", targetPath]]
          : ["xdg-open", [targetPath]]

    execFile(command, args, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
