import { Box, Flash, FormControl, TextInput } from "@primer/react"

import type { ExportProfile } from "@exitpress/domain/export-job/schema/ExportProfile.js"

import { PrimerSelectActionMenu } from "../../components/primer/PrimerSelectActionMenu.js"

const allScanStatusTones = ["default", "error"] as const
export type ScanStatusTone = (typeof allScanStatusTones)[number]

const outputProfileOptions: { value: ExportProfile; label: string }[] = [
  { value: "gfm", label: "Markdown (GFM)" },
  { value: "fumadocs", label: "Fumadocs (MDX)" },
  { value: "docusaurus", label: "Docusaurus (MDX)" },
  { value: "nextra", label: "Nextra (MDX)" },
]

const outputProfileCaptions: Record<ExportProfile, string> = {
  gfm: "일반 Markdown 파일을 만듭니다.",
  fumadocs: "content/docs와 public에 복사할 수 있는 묶음을 만듭니다.",
  docusaurus: "docs와 static에 복사할 수 있는 묶음을 만듭니다.",
  nextra: "content와 public에 복사할 수 있는 묶음을 만듭니다.",
}

export const BlogInputPanel = ({
  blogs,
  blogKey,
  sourceInput,
  outputDir,
  profile = "gfm",
  scanPending,
  scanStatus,
  scanStatusTone,
  onSourceIdOrUrlChange,
  onBlogKeyChange,
  onOutputDirChange,
  onOutputDirBlur,
  onProfileChange = () => {},
}: {
  blogs: { key: string; label: string }[]
  blogKey: string
  sourceInput: string
  outputDir: string
  profile?: ExportProfile
  scanPending: boolean
  scanStatus: string
  scanStatusTone: ScanStatusTone
  onSourceIdOrUrlChange: (value: string) => void
  onBlogKeyChange: (value: string) => void
  onOutputDirChange: (value: string) => void
  onOutputDirBlur: () => void
  onProfileChange?: (value: ExportProfile) => void
}) => (
  <Box sx={{ display: "grid", gap: 3 }}>
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
    <FormControl id="outputProfile" disabled={scanPending}>
      <FormControl.Label>출력 형식</FormControl.Label>
      <PrimerSelectActionMenu
        id="outputProfile"
        value={profile}
        options={outputProfileOptions}
        disabled={scanPending}
        onValueChange={(value) => onProfileChange(value as ExportProfile)}
      />
      <FormControl.Caption>{outputProfileCaptions[profile]}</FormControl.Caption>
    </FormControl>
    <Flash
      id="scan-status"
      variant={scanStatusTone === "error" ? "danger" : "default"}
      sx={{ color: "fg.muted", fontSize: 1 }}
    >
      {scanStatus}
    </Flash>
  </Box>
)
