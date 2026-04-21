import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { picgoCreateMock } = vi.hoisted(() => ({
  picgoCreateMock: vi.fn(),
}))

vi.mock("piclist", () => ({
  PicGo: {
    create: picgoCreateMock,
  },
}))

import { createPicListUploadProviderSource } from "../src/server/piclist-upload-provider-source.js"

const createRuntimeMock = () => ({
  helper: {
    uploader: {
      getIdList: () => ["github", "tcyun"],
      get: (id: string) => {
        if (id === "github") {
          return {
            name: "GitHub",
            config: () => [
              {
                name: "repo",
                alias: "Repository",
                required: true,
                message: "owner/repo",
              },
              {
                name: "token",
                alias: "Token",
                required: true,
              },
            ],
          }
        }

        if (id === "tcyun") {
          return {
            name: "Tencent COS",
            config: () => [
              {
                name: "secretId",
                alias: "Secret ID",
                required: true,
              },
              {
                name: "permission",
                alias: "Permission",
                type: "list",
                required: true,
                default: 0,
                choices: [
                  { name: "Public", value: 0 },
                  { name: "Private", value: 1 },
                ],
              },
              {
                name: "port",
                alias: "Port",
                default: 36677,
              },
              {
                name: "slim",
                alias: "Slim",
                type: "confirm",
                default: false,
              },
            ],
          }
        }

        return undefined
      },
    },
  },
})

const createCloneFixture = async (rootDir: string) => {
  await mkdir(path.join(rootDir, "src", "renderer", "utils"), { recursive: true })
  await mkdir(path.join(rootDir, "src", "main", "utils"), { recursive: true })
  await writeFile(
    path.join(rootDir, "package.json"),
    JSON.stringify(
      {
        version: "3.3.2",
        dependencies: {
          piclist: "2.3.5",
        },
      },
      null,
      2,
    ),
  )
  await writeFile(path.join(rootDir, "src", "renderer", "utils", "static.ts"), "export {};\n")
  await writeFile(path.join(rootDir, "src", "main", "utils", "static.ts"), "export {};\n")
}

describe("createPicListUploadProviderSource", () => {
  let tempDir: string

  beforeEach(async () => {
    tempDir = await mkdtemp(path.join(tmpdir(), "piclist-source-test-"))
    picgoCreateMock.mockReset()
    picgoCreateMock.mockReturnValue(createRuntimeMock())
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true })
  })

  it("loads catalog from the fallback lowercase clone path and normalizes fields", async () => {
    const uppercasePath = path.join(tempDir, "PicList")
    const lowercasePath = path.join(tempDir, "piclist")

    await createCloneFixture(lowercasePath)

    const source = createPicListUploadProviderSource({
      clonePathCandidates: [uppercasePath, lowercasePath],
    })
    const catalog = await source.getCatalog()
    const normalized = await source.normalizeProviderFields("tcyun", {
      secretId: "secret-id-123",
      permission: "1",
      port: "36677",
      slim: false,
    })

    expect(catalog.defaultProviderKey).toBe("github")
    expect(catalog.providers.map((provider) => provider.key)).toEqual(["github", "tcyun"])
    expect(catalog.providers[1]).toMatchObject({
      key: "tcyun",
      label: "Tencent COS",
      fields: [
        {
          key: "secretId",
          inputType: "password",
        },
        {
          key: "permission",
          inputType: "select",
          defaultValue: 0,
        },
        {
          key: "port",
          inputType: "number",
          defaultValue: 36677,
        },
        {
          key: "slim",
          inputType: "checkbox",
          defaultValue: false,
        },
      ],
    })
    expect(normalized).toEqual({
      secretId: "secret-id-123",
      permission: 1,
      port: 36677,
      slim: false,
    })
  })

  it("fails with a clear error when no clone path exists", async () => {
    const source = createPicListUploadProviderSource({
      clonePathCandidates: [path.join(tempDir, "PicList"), path.join(tempDir, "piclist")],
    })

    await expect(source.getCatalog()).rejects.toThrow("PicList clone not found under ~/Downloads")
  })
})
