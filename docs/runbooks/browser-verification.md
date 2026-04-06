# Browser Verification Runbook

## 목적
이 문서는 UI smoke 실패 후 수동으로 브라우저에서 확인해야 할 순서를 정리한다.

## Source Of Truth
기본 자동 검증은 `scripts/harness/run-ui-smoke.ts` 이고, 이 문서는 수동 재현 절차를 보완한다.

## 관련 코드
- [../../src/static/index.html](../../src/static/index.html)
- [../../src/static/app.js](../../src/static/app.js)
- [../../src/server/http-server.ts](../../src/server/http-server.ts)
- [../../scripts/harness/run-ui-smoke.ts](../../scripts/harness/run-ui-smoke.ts)

## 검증 방법
- `pnpm smoke:ui`

## Manual Steps
1. 로컬 서버를 띄운다.
2. `mym0404`를 입력하고 scan을 실행한다.
3. `NestJS` 같이 글 수가 작은 카테고리를 검색한다.
4. 선택 카테고리를 하나만 남기고 export를 시작한다.
5. status, summary, logs, manifest 응답을 확인한다.

## What To Record
- scan 실패 여부
- category list 렌더 여부
- export job 완료 여부
- manifest 응답 여부
- UI와 API 상태가 어긋나는지 여부
