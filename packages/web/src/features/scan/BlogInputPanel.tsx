import { Box, Flash, FormControl, TextInput } from "@primer/react"

import { PrimerSelectActionMenu } from "../../components/primer/PrimerSelectActionMenu.js"

const allScanStatusTones = ["default", "error"] as const
export type ScanStatusTone = (typeof allScanStatusTones)[number]

export const BlogInputPanel = ({
  blogs,
  blogKey,
  sourceInput,
  outputDir,
  scanPending,
  scanStatus,
  scanStatusTone,
  onSourceIdOrUrlChange,
  onBlogKeyChange,
  onOutputDirChange,
  onOutputDirBlur,
}: {
  blogs: { key: string; label: string }[]
  blogKey: string
  sourceInput: string
  outputDir: string
  scanPending: boolean
  scanStatus: string
  scanStatusTone: ScanStatusTone
  onSourceIdOrUrlChange: (value: string) => void
  onBlogKeyChange: (value: string) => void
  onOutputDirChange: (value: string) => void
  onOutputDirBlur: () => void
}) => (
  <Box sx={{ display: "grid", gap: 3 }}>
    <Box
      sx={{
        display: "grid",
        gap: 3,
        gridTemplateColumns: ["1fr", null, "minmax(140px, 0.45fr) minmax(0, 1.1fr) minmax(0, 1fr)"],
        alignItems: "start",
      }}
    >
      <FormControl id="blogKey" disabled={scanPending}>
        <FormControl.Label>블로그</FormControl.Label>
        <PrimerSelectActionMenu
          id="blogKey"
          value={blogKey}
          options={blogs.map((blog) => ({ value: blog.key, label: blog.label }))}
          disabled={scanPending}
          onValueChange={onBlogKeyChange}
        />
      </FormControl>
      <FormControl id="sourceInput" disabled={scanPending}>
        <FormControl.Label>블로그 ID 또는 URL</FormControl.Label>
        <TextInput
          block
          placeholder={
            blogKey === "tistory"
              ? "https://example.tistory.com"
              : "mym0404 또는 https://blog.naver.com/..."
          }
          disabled={scanPending}
          value={sourceInput}
          aria-invalid={scanStatusTone === "error" || undefined}
          validationStatus={scanStatusTone === "error" ? "error" : undefined}
          onChange={(event) => onSourceIdOrUrlChange(event.target.value)}
        />
      </FormControl>
      <FormControl id="outputDir" required>
        <FormControl.Label>출력 경로</FormControl.Label>
        <TextInput
          block
          value={outputDir}
          onChange={(event) => onOutputDirChange(event.target.value)}
          onBlur={onOutputDirBlur}
        />
        <FormControl.Caption>결과를 저장할 위치입니다.</FormControl.Caption>
      </FormControl>
    </Box>
    <Flash
      id="scan-status"
      variant={scanStatusTone === "error" ? "danger" : "default"}
      sx={{ color: "fg.muted", fontSize: 1 }}
    >
      {scanStatus}
    </Flash>
  </Box>
)
