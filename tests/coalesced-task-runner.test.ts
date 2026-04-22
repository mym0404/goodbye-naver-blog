import { describe, expect, it } from "vitest"

import { createCoalescedTaskRunner } from "../src/server/coalesced-task-runner.js"

describe("coalesced task runner", () => {
  it("coalesces repeated schedules into one rerun while work is in flight", async () => {
    let runCount = 0
    let releaseFirstRun: (() => void) | null = null

    const runner = createCoalescedTaskRunner({
      run: async () => {
        runCount += 1

        if (runCount !== 1) {
          return
        }

        await new Promise<void>((resolve) => {
          releaseFirstRun = resolve
        })
      },
    })

    const firstPromise = runner.schedule("job-1")
    runner.schedule("job-1")
    runner.schedule("job-1")

    expect(runCount).toBe(1)

    if (!releaseFirstRun) {
      throw new Error("first run was not blocked")
    }

    const release = releaseFirstRun as () => void
    release()
    await firstPromise

    expect(runCount).toBe(2)
  })
})
