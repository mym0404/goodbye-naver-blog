import path from "node:path"
import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises"
import { constants } from "node:fs"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))

export const repoRoot = path.resolve(here, "../../..")

export const repoPath = (...segments: string[]) => path.join(repoRoot, ...segments)

export const toRepoRelativePath = (absolutePath: string) =>
  path.relative(repoRoot, absolutePath).split(path.sep).join("/")

export const pathExists = async (targetPath: string) => {
  try {
    await access(targetPath, constants.F_OK)
    return true
  } catch {
    return false
  }
}

export const walkFiles = async (targetPath: string): Promise<string[]> => {
  const entries = await readdir(targetPath, {
    withFileTypes: true,
  })
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolutePath = path.join(targetPath, entry.name)

      if (entry.isDirectory()) {
        return walkFiles(absolutePath)
      }

      return [absolutePath]
    }),
  )

  return nested.flat()
}

export const readUtf8 = (targetPath: string) => readFile(targetPath, "utf8")

export const writeUtf8 = async ({
  targetPath,
  content,
}: {
  targetPath: string
  content: string
}) => {
  await mkdir(path.dirname(targetPath), {
    recursive: true,
  })
  await writeFile(targetPath, content)
}

export const ensureHarnessDir = async (...segments: string[]) => {
  const targetPath = repoPath("tmp", "harness", ...segments)
  await mkdir(targetPath, {
    recursive: true,
  })

  return targetPath
}
