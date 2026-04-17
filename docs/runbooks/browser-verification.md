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
- [../../src/ui/styles/globals.css](../../src/ui/styles/globals.css)
- [../../src/ui/features/options/export-options-panel.tsx](../../src/ui/features/options/export-options-panel.tsx)
- [../../src/ui/features/job-results/job-results-panel.tsx](../../src/ui/features/job-results/job-results-panel.tsx)
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
4. 선택 카테고리를 하나만 남기고 선택 범위 수치가 즉시 줄어드는지 확인한다.
5. `Assets` 탭에서 `이미지 처리 방식`을 확인하고, `download-and-upload` 경로에서도 업로더 폼이 설정 탭에 나타나지 않는지 본다.
6. export를 시작하고 상태가 `completed` 또는 `upload-ready`로 바뀌는지 확인한다.
7. `upload-ready`면 결과 패널의 업로드 대상 표, `uploaderKey`, `uploaderConfigJson`, 시작 버튼이 보이는지 확인한다.
8. placeholder 값으로 업로드를 시작하고 `uploading -> upload-completed` 전환을 확인한다.
9. zero-candidate 케이스에서는 업로드 폼 없이 `export만 완료` 안내만 보이는지 확인한다.
10. status, summary, logs, 완료 파일 표, manifest 응답을 확인한다.
11. warning/error 필터를 눌러 결과가 좁혀지는지 확인한다.
12. 결과 설명, field help, 파일 subtitle 텍스트가 육안으로도 옅지 않은지 확인한다.

## Screenshot Feedback Loop
같은 시나리오로 아래 루프를 5번 반복한다.

1. 데스크톱 `1440px` 한 장, 모바일 `375px` 한 장을 캡처한다.
2. 아래 기준으로 어긋남을 적는다.
3. 레이아웃, 간격, 대비, 상태 표현을 수정한다.
4. 다시 같은 시나리오로 캡처한다.

루프마다 확인할 기준:
- 좌측 사이드바, 상단 툴바, KPI strip 정렬이 어긋나지 않는지
- Blog ID 입력과 카테고리 스캔 버튼이 본문 첫 카드 상단에 있는지
- 카테고리 패널이 카드 더미가 아니라 고정 높이 표로 보이는지
- 모바일 sticky command bar가 과하게 높아지거나 본문을 덮어버리지 않는지
- 사이드바에 `Command Rail`, `Stage` 같은 불필요한 텍스트가 다시 생기지 않는지
- Sidebar brand에 장식 아이콘이 다시 들어오지 않았는지
- 모바일 가로 스크롤이 없는지
- 데스크톱도 body 기준 좌우 스크롤이 생기지 않는지
- 좌측 rail과 모바일 sticky rail이 window edge에 바로 붙어 있는지
- KPI 카드 숫자와 상태 배지 대비가 충분한지
- 설명 텍스트, helper text, modal meta, 파일 subtitle이 거의 보이지 않는 상태가 아닌지
- drawer의 브랜드, 메뉴, 진행 카드, 내보내기 버튼 텍스트가 어둡게 가라앉지 않는지
- 설정 탭 5개가 한 줄 segmented control로 보이고 active tab이 과하게 떠 있거나 깨져 보이지 않는지
- frontmatter 필드가 데스크톱에서 다열 grid로 정리되어 세로 길이가 과도하게 늘어나지 않는지
- focus, disabled, loading 상태가 구분되는지
- 상태 패널과 작업 패널이 같은 메인 보드 안에서 자연스럽게 읽히는지
- 로그, 요약, 카테고리 패널이 같은 시각 언어를 유지하는지
- frontmatter alias 충돌 시 오류가 즉시 보이고 export가 막히는지
- 결과 패널의 upload target table이 desktop/mobile 모두 과하게 넘치지 않는지
- `upload-ready`일 때만 업로드 폼이 보이고, 완료 후에는 placeholder config 값이 화면에 남지 않는지
- per-post 결과 경로가 `.../index.md` 패턴을 유지하는지
- 완료 파일 트리에서 경고/에러 아이콘과 필터가 일관되게 동작하는지
- 설정 탭 5개 높이가 너무 낮지 않고 클릭 타깃이 충분한지

## Contrast Gate
- smoke는 핵심 selector의 computed foreground/background 대비를 계산하고 `4.5:1` 미만이면 실패한다.
- smoke는 desktop/mobile 모두 viewport horizontal overflow가 1px를 넘으면 실패한다.
- 회귀 대상 selector는 `#category-status`, `.panel-description`, `.field-help`, `.frontmatter-description`, `.results-description`, `.job-results-row span`, `.scan-status-note`, `.sidebar-brand strong`, `.sidebar-heading`, `.sidebar-link span`, `.sidebar-summary-title`, `.sidebar-summary-metric span`, `#export-button span`다.
- 새 설명 텍스트나 helper UI를 추가하면 smoke 대상 selector도 같이 확장한다.

## Icon Policy
- 앱 전역 아이콘은 Remix icon 기준으로 유지한다.
- 상태, 파일, 액션, 네비게이션 보조 외 장식성 아이콘은 추가하지 않는다.
- 특히 사이드바 상단 brand 영역에는 아이콘을 다시 넣지 않는다.

## What To Record
- scan 실패 여부
- category list 렌더 여부
- export job이 `completed` 또는 `upload-ready`로 끝났는지
- upload trigger 후 `uploading -> upload-completed | upload-failed` 전환 여부
- zero-candidate 시 `skipped-no-candidates` 안내 여부
- manifest 응답 여부
- UI와 API 상태가 어긋나는지 여부
- 각 스크린샷 루프에서 수정한 시각 불일치 항목
