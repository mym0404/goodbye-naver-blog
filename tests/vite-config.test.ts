import { describe, expect, it } from "vitest"

import { ignoredRuntimeOutputGlobs } from "../src/shared/runtime-output-watch-globs.js"

describe("vite config", () => {
  it("ignores runtime export directories in dev watch mode", () => {
    expect(ignoredRuntimeOutputGlobs).toEqual(
      expect.arrayContaining([
        "**/.cache/**",
        "**/output/**",
        "**/outputs/**",
      ]),
    )
  })
})
