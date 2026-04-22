import path from "node:path"
import { fileURLToPath } from "node:url"

import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

import { ignoredRuntimeOutputGlobs } from "./src/shared/runtime-output-watch-globs.js"

const rootDir = fileURLToPath(new URL(".", import.meta.url))

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    watch: {
      ignored: ignoredRuntimeOutputGlobs,
    },
  },
  resolve: {
    alias: {
      "@": path.join(rootDir, "src/ui"),
      "@shared": path.join(rootDir, "src/shared"),
    },
  },
  build: {
    outDir: "dist/client",
    emptyOutDir: false,
    chunkSizeWarningLimit: 900,
  },
})
