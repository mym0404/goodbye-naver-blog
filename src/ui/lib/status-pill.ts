import { cn } from "./cn.js"

export const getStatusPillClassName = (status: string | undefined) =>
  cn(
    "status-pill rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em]",
    status === "completed" || status === "upload-completed" || status === "ready"
      ? "status-pill--success"
      : status === "upload-ready"
        ? "status-pill--ready"
        : status === "running" || status === "queued" || status === "success" || status === "uploading"
          ? "status-pill--running"
          : status === "failed" || status === "upload-failed"
            ? "status-pill--error"
            : "status-pill--idle",
  )
