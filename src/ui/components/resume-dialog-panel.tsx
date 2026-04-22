import { Alert, AlertDescription, AlertTitle } from "./ui/alert.js"
import { Button } from "./ui/button.js"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog.js"
import type { ResumeDialogState } from "../app-helpers.js"

export const ResumeDialogPanel = ({
  resumeDialog,
  resettingResume,
  restoringResume,
  onReset,
  onRestore,
}: {
  resumeDialog: ResumeDialogState | null
  resettingResume: boolean
  restoringResume: boolean
  onReset: () => void
  onRestore: () => void
}) => (
  <Dialog open={Boolean(resumeDialog)} onOpenChange={() => null}>
    <DialogContent
      showCloseButton={false}
      onEscapeKeyDown={(event) => event.preventDefault()}
      onInteractOutside={(event) => event.preventDefault()}
      onPointerDownOutside={(event) => event.preventDefault()}
    >
      <DialogHeader>
        <DialogTitle>
          {resumeDialog?.source === "before-scan"
            ? "진행 중인 작업이 있습니다."
            : "이전 작업을 다시 불러왔습니다."}
        </DialogTitle>
        <DialogDescription>
          {resumeDialog?.source === "before-scan"
            ? "이 경로에는 다시 불러올 수 있는 작업 상태가 남아 있습니다."
            : "output 상태를 읽어 마지막 작업 화면으로 복구했습니다."}
        </DialogDescription>
      </DialogHeader>
      {resumeDialog ? (
        <div className="grid gap-3">
          <div className="subtle-panel grid gap-2 rounded-[var(--radius-lg)] px-4 py-4 text-sm text-foreground">
            <p>
              <strong className="font-semibold text-foreground">상태</strong> {resumeDialog.resumeSummary.status}
            </p>
            <p>
              <strong className="font-semibold text-foreground">출력 경로</strong> {resumeDialog.resumeSummary.outputDir}
            </p>
            <p>
              <strong className="font-semibold text-foreground">진행</strong> 총 {resumeDialog.resumeSummary.totalPosts} / 완료 {resumeDialog.resumeSummary.completedCount} / 실패 {resumeDialog.resumeSummary.failedCount}
            </p>
            <p>
              <strong className="font-semibold text-foreground">업로드</strong> {resumeDialog.resumeSummary.uploadedCount} / {resumeDialog.resumeSummary.uploadCandidateCount}
            </p>
          </div>
          <Alert variant="destructive">
            <AlertTitle>초기화 경고</AlertTitle>
            <AlertDescription>
              작업 초기화를 실행하면 <strong>{resumeDialog.resumeSummary.outputDir}</strong> 경로의 작업내역과 output 파일을 함께 삭제합니다.
            </AlertDescription>
          </Alert>
        </div>
      ) : null}
      <DialogFooter>
        <Button variant="destructive" onClick={onReset} disabled={resettingResume}>
          {resettingResume ? "초기화 중" : "작업 초기화"}
        </Button>
        <Button onClick={onRestore} disabled={restoringResume || resettingResume}>
          {restoringResume ? "불러오는 중" : "불러오기"}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
)
