# Browser Verification Runbook

## 목적
이 문서는 UI smoke 실패 후 수동으로 브라우저에서 확인해야 할 순서를 정리한다.

## Single Post Cross-Check
개별 글의 구조와 Markdown 결과를 비교해야 하면 [single-post-verification.md](./single-post-verification.md)를 따른다.

## Source Of Truth
기본 자동 검증은 `scripts/harness/run-ui-smoke.ts` 이고, 이 문서는 수동 재현 절차를 보완한다.

## 관련 코드
- [../../index.html](../../index.html)
- [../../src/ui/App.tsx](../../src/ui/App.tsx)
- [../../src/ui/styles/dashboard.css](../../src/ui/styles/dashboard.css)
- [../../.agents/knowledge/product/ui-dashboard-design-system.md](../../.agents/knowledge/product/ui-dashboard-design-system.md)
- [../../src/server/http-server.ts](../../src/server/http-server.ts)
- [../../scripts/harness/run-ui-smoke.ts](../../scripts/harness/run-ui-smoke.ts)

## 검증 방법
- `pnpm smoke:ui`
- `pnpm smoke:ui -- --capture-dir docs/generated/ui-review/round-01`

## Manual Steps
1. 로컬 서버를 띄운다.
2. `mym0404`를 입력하고 scan을 실행한다.
3. `NestJS` 같이 글 수가 작은 카테고리를 검색한다.
4. 선택 카테고리를 하나만 남기고 preview를 먼저 확인한다.
5. preview에 HTML 태그가 그대로 남지 않는지 확인한다.
6. preview 우상단의 `소스보기 / 같이보기 / 결과보기` 토글이 모두 동작하고 결과보기가 Markdown renderer 결과를 보여주는지 확인한다.
7. export를 시작한다.
8. status, summary, logs, 완료 파일 트리, manifest 응답을 확인한다.
9. warning/error 필터를 눌러 결과가 좁혀지는지 확인한다.
10. 완료 항목을 눌러 Modal에서 Markdown 렌더링이 보이는지 확인한다.
11. 결과 설명, field help, modal meta, file subtitle 텍스트가 육안으로도 옅지 않은지 확인한다.

## Screenshot Feedback Loop
같은 시나리오로 아래 루프를 5번 반복한다.

1. 데스크톱 `1440px` 한 장, 모바일 `375px` 한 장을 캡처한다.
2. 아래 기준으로 어긋남을 적는다.
3. 레이아웃, 간격, 대비, 상태 표현을 수정한다.
4. 다시 같은 시나리오로 캡처한다.

루프마다 확인할 기준:
- 좌측 사이드바, 상단 툴바, KPI strip 정렬이 어긋나지 않는지
- Sidebar brand에 장식 아이콘이 다시 들어오지 않았는지
- 모바일 가로 스크롤이 없는지
- KPI 카드 숫자와 상태 배지 대비가 충분한지
- 설명 텍스트, helper text, modal meta, 파일 subtitle이 거의 보이지 않는 상태가 아닌지
- focus, disabled, loading 상태가 구분되는지
- 상태 패널과 작업 패널이 같은 메인 보드 안에서 자연스럽게 읽히는지
- 로그, 요약, 카테고리 패널이 같은 시각 언어를 유지하는지
- preview 후보 글 정보와 Markdown 예시가 현재 선택 범위와 맞는지
- preview와 export 결과 모두 HTML 태그를 본문에 남기지 않는지
- preview mode toggle이 source/split/rendered 상태를 올바르게 전환하는지
- frontmatter alias 충돌 시 오류가 즉시 보이고 export가 막히는지
- 완료 파일 트리에서 경고/에러 아이콘과 필터가 일관되게 동작하는지
- Modal Markdown preview가 데스크톱과 모바일에서 읽기 어렵지 않은지

## Contrast Gate
- smoke는 핵심 selector의 computed foreground/background 대비를 계산하고 `4.5:1` 미만이면 실패한다.
- 회귀 대상 selector는 `#category-status`, `#preview-status`, `.panel-description`, `.field-help`, `.frontmatter-description`, `.results-description`, `.job-tree-item-copy small`, `#markdown-modal-meta span`, `.markdown-frontmatter-key`다.
- 새 설명 텍스트나 helper UI를 추가하면 smoke 대상 selector도 같이 확장한다.

## Icon Policy
- 앱 전역 아이콘은 Remix icon 기준으로 유지한다.
- 상태, 파일, 액션, 네비게이션 보조 외 장식성 아이콘은 추가하지 않는다.
- 특히 사이드바 상단 brand 영역에는 아이콘을 다시 넣지 않는다.

## What To Record
- scan 실패 여부
- category list 렌더 여부
- export job 완료 여부
- manifest 응답 여부
- UI와 API 상태가 어긋나는지 여부
- 각 스크린샷 루프에서 수정한 시각 불일치 항목
