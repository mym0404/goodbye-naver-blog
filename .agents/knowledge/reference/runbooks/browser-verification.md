# Browser Verification Runbook

## 목적
이 문서는 사용자가 브라우저 동작 확인을 요청했을 때 `agent-browser`로 실제 화면을 확인하기 위한 rough 메모다.

## 기준
- 자동 회귀는 `pnpm smoke:ui`와 `pnpm test:network`가 맡는다.
- 이 문서는 자동 검증을 대체하지 않고, 사용자가 요청한 화면 동작을 실제 브라우저에서 직접 확인할 때만 쓴다.
- 개별 글의 구조와 Markdown 결과 비교는 `.agents/knowledge/reference/runbooks/single-post-verification.md`를 따른다.

## 실행 메모
- 서버는 사용자 `pnpm dev`와 충돌하지 않게 비기본 `PORT`, 별도 `FAREWELL_SETTINGS_PATH`, 별도 `FAREWELL_SCAN_CACHE_PATH`로 띄운다.
- 브라우저 확인은 `agent-browser`를 기본 도구로 사용한다.
- 사용자가 요청한 동작을 중심으로 scan, export, upload, resume 중 필요한 구간만 통과시킨다.
- 실제 네트워크나 업로드가 필요한 확인은 외부 상태를 만들 수 있으므로 실행 전 범위를 분명히 한다.
- 반복 회귀로 남길 가치가 있는 흐름은 Playwright harness로 옮긴다.

## 확인할 신호
- 요청한 버튼, 입력, 탭, dialog, progress, table, filter가 실제 화면에서 동작하는지 본다.
- UI 상태와 API 응답 또는 `manifest.json` 상태가 서로 어긋나는지 본다.
- export는 `completed` 또는 `upload-ready`, upload는 `upload-completed` 또는 요청한 실패/재시도 상태까지 본다.
- 복구 흐름은 자동 재시작 없이 사용자의 계속 버튼으로만 이어지는지 본다.
- 레이아웃 확인 요청이면 desktop/mobile 중 요청한 viewport에서 가로 overflow, 잘림, 과한 대비 저하만 우선 본다.

## 기록
- 확인한 URL과 viewport
- 사용한 입력값
- 최종 job status
- 요청 동작의 성공 여부
- 실패하면 화면 증상, API 상태, 관련 `manifest.json` 상태
