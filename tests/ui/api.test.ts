import { afterEach, describe, expect, it, vi } from "vitest"

import { fetchJson, postJson } from "../../src/ui/lib/api.js"

const buildResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json",
    },
  })

afterEach(() => {
  vi.restoreAllMocks()
})

describe("ui api helpers", () => {
  it("returns parsed json for successful requests", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(buildResponse({
      ok: true,
    })))

    await expect(fetchJson<{ ok: boolean }>("/api/demo")).resolves.toEqual({
      ok: true,
    })
  })

  it("throws the response error message for failed requests and uses postJson payloads", async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(buildResponse({
        error: "bad request",
      }, 400))
      .mockResolvedValueOnce(buildResponse({
        jobId: "job-1",
      }, 202))

    vi.stubGlobal("fetch", fetchMock)

    await expect(fetchJson("/api/fail")).rejects.toThrow("bad request")
    await expect(postJson<{ jobId: string }>("/api/export", {
      blogIdOrUrl: "mym0404",
    })).resolves.toEqual({
      jobId: "job-1",
    })

    expect(fetchMock).toHaveBeenLastCalledWith("/api/export", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        blogIdOrUrl: "mym0404",
      }),
    })
  })
})
