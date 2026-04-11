# UI Dashboard Design System

## 목적
React 대시보드를 shadcn semantic token과 source-based component composition 중심으로 유지하기 위한 기준 문서다.

## Source Of Truth
- 구조와 상태 흐름: `src/ui/App.tsx`
- semantic token: `src/ui/styles/globals.css`
- 앱 전용 layout/surface 보정: `src/ui/styles/dashboard.css`
- Markdown renderer: `src/ui/lib/markdown.tsx`
- 브라우저 검증: `scripts/harness/run-ui-smoke.ts`, `docs/runbooks/browser-verification.md`

## 관련 코드
- [../../../src/ui/App.tsx](../../../src/ui/App.tsx)
- [../../../src/ui/styles/globals.css](../../../src/ui/styles/globals.css)
- [../../../src/ui/styles/dashboard.css](../../../src/ui/styles/dashboard.css)
- [../../../src/ui/lib/markdown.tsx](../../../src/ui/lib/markdown.tsx)
- [../../../scripts/harness/run-ui-smoke.ts](../../../scripts/harness/run-ui-smoke.ts)

## 검증 방법
- `pnpm typecheck`
- `pnpm test:coverage`
- `pnpm smoke:ui`

## Style Direction
- 메인 캔버스는 밝은 blue-neutral surface, 좌측은 deep navy sidebar를 사용한다.
- 상단 hero card, KPI strip, 3개 workbench board를 같은 shadcn card hierarchy 안에 둔다.
- preview, options, status는 각각 독립 board지만 spacing, border, shadow rhythm을 공유한다.
- layout은 desktop에서 `sidebar + fluid main`, mobile에서는 single-column stack으로 접힌다.

## Tokens
- Background: `#F4F7FB`
- Foreground: `#162132`
- Card: `#FFFFFF`
- Primary: `#3366FF`
- Secondary: `#EDF3FF`
- Muted background: `#EDF2F8`
- Muted foreground: `#52657D`
- Border/Input: `#D7E0EB`
- Sidebar background: `#1F3045`
- Sidebar foreground: `#F5F8FD`
- Success: `#198754`
- Warning: `#B7791F`
- Destructive: `#D9485F`

## Component Rules
- `CardHeader/CardDescription/CardContent`를 기본 계층으로 사용한다. 큰 feature도 임의 wrapper 대신 card composition으로 쪼갠다.
- 텍스트 입력은 `Input`, 상태 pill과 count는 `Badge`, 오류/가이드 배너는 `Alert`, 탭 그룹은 `Tabs`, modal은 `Dialog`를 우선한다.
- custom CSS는 layout, responsive folding, markdown skin, feature surface 보정만 담당한다.
- category/search/output/preview/status의 DOM hook은 유지한다.
  `#blogIdOrUrl`, `#scan-button`, `#preview-button`, `#export-button`, `#job-file-tree`, `#markdown-modal`, `[data-preview-mode]`, `[data-job-filter]`, `#summary`, `#status-text`, `#logs`
- option panel은 `Tabs`로 `범위 / 구조 / Markdown / Assets`를 구분한다.
- preview는 floating segmented toggle로 `소스보기 / 같이보기 / 결과보기`를 유지한다.
- 결과 modal과 preview renderer는 모두 `react-markdown + remark-gfm + remark-math + rehype-katex + rehype-sanitize` 경로를 사용한다.

## Icon Rules
- 프로젝트 아이콘은 Remix icon만 사용한다.
- 허용 위치는 `네비게이션 보조 / 상태 / 파일 / 액션`이다.
- 상단 브랜드 장식 아이콘은 금지한다.
- 텍스트만으로 충분한 곳에는 아이콘을 억지로 추가하지 않는다.

## Accessibility
- normal text contrast는 밝은 surface 기준 최소 `4.5:1`을 유지한다.
- `text-muted-foreground`와 커스텀 설명 텍스트는 모두 같은 contrast policy를 따라야 한다.
- 버튼, filter chip, 상태 badge는 높이와 baseline이 흔들리지 않게 유지한다.
- focus ring은 primary halo를 사용하고, 상태는 색뿐 아니라 텍스트와 border로도 구분한다.

## Validation Rules
- `scripts/harness/run-ui-smoke.ts`의 contrast gate selector는 회귀 방지 대상이다.
- 현재 contrast gate 대상에는 category status, preview status, panel description, field help, frontmatter description, results description, file meta, modal meta, markdown frontmatter key가 포함된다.
- smoke screenshot capture는 `docs/generated/ui-review/round-01`부터 `round-05`까지 동일 시나리오로 누적한다.

## Anti-Patterns
- raw hex를 feature component 내부 className에 직접 넣는 것
- `muted`를 설명문, disabled, meta, 상태 문구에 구분 없이 재사용하는 것
- sidebar brand에 장식 아이콘을 다시 넣는 것
- preview/status/logs를 서로 다른 시각 언어로 따로 노는 패널로 분리하는 것
