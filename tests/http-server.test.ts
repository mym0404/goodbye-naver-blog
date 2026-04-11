import { afterEach, describe, expect, it } from "vitest"

import { createHttpServer } from "../src/server/http-server.js"

let activeServer: ReturnType<typeof createHttpServer> | null = null

afterEach(async () => {
  if (!activeServer) {
    return
  }

  await new Promise<void>((resolve, reject) => {
    activeServer?.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
  activeServer = null
})

describe("http server", () => {
  it("returns frontmatter metadata from export defaults", async () => {
    activeServer = createHttpServer()
    await new Promise<void>((resolve) => {
      activeServer?.listen(0, "127.0.0.1", () => resolve())
    })

    const address = activeServer.address()

    if (!address || typeof address === "string") {
      throw new Error("server did not bind to a numeric port")
    }

    const response = await fetch(`http://127.0.0.1:${address.port}/api/export-defaults`)
    const body = (await response.json()) as {
      frontmatterFieldMeta: {
        title: {
          label: string
          description: string
          defaultAlias: string
        }
      }
      options: {
        frontmatter: {
          aliases: {
            title: string
          }
        }
        markdown: {
          formulaBlockWrapperOpen: string
        }
        assets: {
          stickerAssetMode: string
        }
      }
      optionDescriptions: Record<string, string>
    }

    expect(response.ok).toBe(true)
    expect(body.frontmatterFieldMeta.title).toEqual({
      label: "title",
      description: "글 제목을 기록합니다.",
      defaultAlias: "title",
    })
    expect(body.options.frontmatter.aliases.title).toBe("")
    expect(body.options.markdown.formulaBlockWrapperOpen).toBe("$$")
    expect(body.options.assets.stickerAssetMode).toBe("ignore")
    expect(body.optionDescriptions["assets-imageContentMode"]).toContain("base64")
  })
})
