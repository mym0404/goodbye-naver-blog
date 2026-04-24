# PicGo Live Upload Progress Visibility

## 문제
실제 GitHub 업로드는 먼저 일어나는데 UI polling은 `uploading` 중간 상태를 놓쳐 부분 완료가 보이지 않을 수 있다.

## 증상
- `pnpm test:network:upload`에서 GitHub 쪽 업로드 흔적은 보이는데 UI는 바로 `upload-completed`로 넘어간다.
- 빠른 live run에서는 `uploadedCount > 0` 구간이 결과 패널에 남지 않는다.

## 원인
- 업로드와 rewrite 사이 구간이 짧으면 1초 polling만으로는 중간 상태를 놓친다.
- 같은 업로드 경로를 재사용하면 GitHub 쪽 변경이 no-op처럼 보여 partial evidence가 약해진다.

## 대응
- `src/server/http-server.ts`와 `src/server/job-store.ts`에서 upload snapshot을 유지해 결과 단계에서도 마지막 count를 읽게 한다.
- `src/ui/features/job-results/job-results-panel.tsx`에서 `upload-completed` 뒤에도 마지막 upload progress와 row 상태를 보여 준다.
- `scripts/harness/run-ui-live-upload.ts`는 `master`에 run-unique path로 업로드해 같은 브랜치에서 partial evidence를 남긴다.
- live 확인은 `status === "uploading"`와 `uploadedCount > 0`를 우선 찾고, 매우 빠른 run이면 결과 단계 persisted snapshot까지 증거로 본다.

## 검증
- `pnpm smoke:ui`: rewrite 대기 중 full bar, row 상태, bounded table이 보이는지 확인
- `pnpm test:network:upload`: `master`에서 partial upload evidence와 UI snapshot이 같이 남는지 확인
- `pnpm check:full`: 기본 회귀와 generated/report 연결 확인

## 관련 경로
- `.agents/knowledge/reference/plan-archive/picgo-upload-progress-visibility/plan.md`
- `src/server/http-server.ts`
- `src/server/job-store.ts`
- `src/ui/features/job-results/job-results-panel.tsx`
- `src/ui/features/job-results/use-export-job.ts`
- `scripts/harness/run-ui-live-upload.ts`
