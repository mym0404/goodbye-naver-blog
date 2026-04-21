import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const { runtimeCreateMock } = vi.hoisted(() => ({
  runtimeCreateMock: vi.fn(),
}))

vi.mock("piclist", () => ({
  PicGo: {
    create: runtimeCreateMock,
  },
}))

import { createImageUploadProviderSource } from "../src/server/image-upload-provider-source.js"

const createRuntimeMock = () => ({
  helper: {
    uploader: {
      getIdList: () => ["github", "tcyun", "mystorage"],
      get: (id: string) => {
        if (id === "github") {
          return {
            name: "GitHub",
            config: () => [
              {
                name: "repo",
                alias: "仓库",
                required: true,
                message: "请输入 owner/repo",
              },
              {
                name: "token",
                alias: "设定Token",
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
                alias: "设定SecretId",
                required: true,
              },
              {
                name: "permission",
                alias: "权限",
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
                alias: "端口",
                default: 36677,
              },
              {
                name: "slim",
                alias: "极智压缩",
                type: "confirm",
                default: false,
              },
            ],
          }
        }

        if (id === "mystorage") {
          return {
            name: "自定义图库",
            config: () => [
              {
                name: "fooBar",
                alias: "设置字段",
                message: "请输入字段",
              },
            ],
          }
        }

        return undefined
      },
    },
  },
})

describe("createImageUploadProviderSource", () => {
  beforeEach(async () => {
    runtimeCreateMock.mockReset()
    runtimeCreateMock.mockReturnValue(createRuntimeMock())
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("loads catalog from the image upload runtime and normalizes fields", async () => {
    const source = createImageUploadProviderSource()
    const catalog = await source.getCatalog()
    const normalized = await source.normalizeProviderFields("tcyun", {
      secretId: "secret-id-123",
      permission: "1",
      port: "36677",
      slim: false,
    })

    expect(catalog.defaultProviderKey).toBe("github")
    expect(catalog.providers.map((provider) => provider.key)).toEqual(["github", "tcyun", "mystorage"])
    expect(catalog.providers[0]).toMatchObject({
      key: "github",
      description: "리포지토리에 이미지를 커밋하고 URL로 사용합니다.",
      fields: [
        {
          key: "repo",
          label: "Repository",
          description: "업로드할 GitHub 저장소 경로입니다.",
          placeholder: "owner/repo",
        },
        {
          key: "token",
          label: "Token",
          description: "서비스 API 접근용 토큰을 입력합니다.",
        },
      ],
    })
    expect(catalog.providers[1]).toMatchObject({
      key: "tcyun",
      label: "Tencent COS",
      description: "Tencent COS 버킷에 이미지를 업로드합니다.",
      fields: [
        {
          key: "secretId",
          label: "Secret ID",
          description: "서비스에서 발급한 secret ID를 입력합니다.",
          inputType: "password",
        },
        {
          key: "permission",
          label: "Permission",
          description: "이미지 공개 범위 또는 접근 권한을 선택합니다.",
          inputType: "select",
          defaultValue: 0,
        },
        {
          key: "port",
          label: "Port",
          description: "기본 포트 대신 사용할 포트 번호입니다.",
          inputType: "number",
          defaultValue: 36677,
        },
        {
          key: "slim",
          label: "Slim",
          description: "COS 이미지 처리 압축 옵션을 함께 사용합니다.",
          inputType: "checkbox",
          defaultValue: false,
        },
      ],
    })
    expect(catalog.providers[2]).toMatchObject({
      key: "mystorage",
      label: "Mystorage",
      description: "Mystorage로 이미지를 업로드합니다.",
      fields: [
        {
          key: "fooBar",
          label: "Foo Bar",
          description: "Foo Bar 값을 입력합니다.",
          placeholder: "",
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

  it("fails when the image upload runtime cannot be created", async () => {
    runtimeCreateMock.mockImplementation(() => {
      throw new Error("runtime bootstrap failed")
    })

    const source = createImageUploadProviderSource()

    await expect(source.getCatalog()).rejects.toThrow("runtime bootstrap failed")
  })
})
