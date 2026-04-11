import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    coverage: {
      provider: "v8",
      reporter: ["text", "json-summary", "lcov"],
      include: [
        "src/modules/**/*.ts",
        "src/shared/export-options.ts",
        "src/shared/utils.ts",
        "src/ui/**/*.ts",
        "src/ui/**/*.tsx",
      ],
      exclude: [
        "src/modules/blog-fetcher/**",
        "src/modules/exporter/export-preview.ts",
        "src/ui/main.tsx",
      ],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 75,
        statements: 90,
      },
    },
  },
})
