# UI Dashboard Design System

## 목적
React 대시보드를 shadcn semantic token과 source-based component composition 중심으로 유지하기 위한 기준 문서다.

## Source Of Truth
- 구조와 상태 흐름: `src/ui/App.tsx`
- 브라우저 메타와 favicon: `index.html`, `src/ui/assets/favicon.svg`
- semantic token: `src/ui/styles/globals.css`
- 화면 표현과 반응형 레이아웃: `src/ui/**/*.tsx`의 Tailwind utility class
- Markdown renderer: `src/ui/lib/markdown.tsx`
- 브라우저 검증: `scripts/harness/run-ui-smoke.ts`, `docs/runbooks/browser-verification.md`

## 관련 코드
- [../../../src/ui/App.tsx](../../../src/ui/App.tsx)
- [../../../index.html](../../../index.html)
- [../../../src/ui/assets/favicon.svg](../../../src/ui/assets/favicon.svg)
- [../../../src/ui/styles/globals.css](../../../src/ui/styles/globals.css)
- [../../../src/ui/features/options/export-options-panel.tsx](../../../src/ui/features/options/export-options-panel.tsx)
- [../../../src/ui/features/preview/preview-panel.tsx](../../../src/ui/features/preview/preview-panel.tsx)
- [../../../src/ui/features/job-results/job-results-panel.tsx](../../../src/ui/features/job-results/job-results-panel.tsx)
- [../../../src/ui/lib/markdown.tsx](../../../src/ui/lib/markdown.tsx)
- [../../../scripts/harness/run-ui-smoke.ts](../../../scripts/harness/run-ui-smoke.ts)

## 검증 방법
- `pnpm typecheck`
- `pnpm test:coverage`
- `pnpm smoke:ui`

## Style Direction
- 메인 캔버스는 밝은 blue-neutral surface, 좌측은 deep navy sidebar를 사용한다.
- Blog ID 입력과 카테고리 스캔 액션은 본문 첫 카드 상단에 둔다.
- 카테고리 패널은 카드 나열 대신 고정 높이 scroll area 안의 표로 유지한다.
- 앱의 관리용 표는 compact row density를 기본으로 하고, 파일/상태 확인도 카드 리스트보다 표를 우선한다.
- 상단 hero card, KPI strip, 3개 workbench board를 같은 shadcn card hierarchy 안에 둔다.
- preview, options, status는 각각 독립 board지만 spacing, border, shadow rhythm을 공유한다.
- layout은 desktop에서 `sidebar + fluid main`, mobile에서는 single-column stack으로 접힌다.
- 최상위 shell은 viewport에 바로 붙는다. 바깥 프레임용 여백이나 화면 바깥으로 밀리는 horizontal overflow를 두지 않는다.
- export가 `queued` 또는 `running`이면 category, options, preview board와 해당 navigation item을 숨기고 status board에 집중시킨다.

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
- 헤더 카피는 짧게 유지하고, `Stage`, `Command Rail` 같은 장식성 라벨은 두지 않는다.
- 텍스트 입력은 `Input`, 상태 pill과 count는 `Badge`, 오류/가이드 배너는 `Alert`, 탭 그룹은 `Tabs`, modal은 `Dialog`를 우선한다.
- 사용자 피드백 토스트는 `sonner` 기반 `Toaster`/`toast()`로 통일한다.
- 앱 표는 `src/ui/components/ui/table.tsx` 공용 컴포넌트를 사용하고, header/cell padding은 compact 기본값을 유지한다.
- feature 전용 화면 스타일은 별도 CSS 파일 대신 각 컴포넌트의 Tailwind utility class로 유지한다.
- `globals.css`는 토큰, base element reset, native `select` 기본 스타일만 담당한다.
- 바깥 frame spacing은 CSS 파일이 아니라 `App.tsx` 셸 utility에서만 제어한다.
- category/search/output/preview/status의 DOM hook은 유지한다.
  `#blogIdOrUrl`, `#scan-button`, `#preview-button`, `#export-button`, `#job-file-tree`, `#markdown-modal`, `[data-preview-mode]`, `[data-job-filter]`, `#summary`, `#status-text`, `#logs`
- scan 후 summary와 category panel의 count는 현재 선택 범위 기준 대상 글 수를 즉시 반영해야 한다.
- category 선택은 tree semantics를 따른다. 부모 선택은 하위 전체를 함께 토글하고, 일부 자식만 선택되면 부모는 partial state로 보여야 한다.
- category table은 parent-before-children 순서를 유지하고 depth 기반 indent로 위계를 바로 읽을 수 있어야 한다.
- option panel은 `Tabs`로 `범위 / 구조 / Frontmatter / Markdown / Assets`를 구분한다.
- 설정 탭 5개는 상단 전체 폭을 쓰는 segmented control로 유지한다.
- 탭 active 상태는 떠 보이는 흰 pill 하나만 남기고, underline이나 과한 shadow를 겹치지 않는다.
- frontmatter 필드 목록은 데스크톱에서 2~3열 grid로 보여 주고, 각 필드 안에서 토글/설명/alias 입력을 함께 묶는다.
- `Assets`에서 `Image Content Mode`가 `base64`면 `Asset Path Mode`, `본문 이미지 다운로드`, `썸네일 다운로드`는 비활성화한다.
- preview는 floating segmented toggle로 `소스보기 / 같이보기 / 결과보기`를 유지한다.
- preview는 `source`와 `rendered` 단일 모드에서 항상 1열 full-width pane을 쓰고, `split`에서만 2열로 나눈다.
- preview source `pre`와 rendered article은 같은 내부 padding rhythm을 유지한다.
- 결과 modal과 preview renderer는 모두 `react-markdown + remark-gfm + remark-math + rehype-katex + rehype-sanitize` 경로를 사용한다.
- 결과 파일 표는 `index.md` 같은 저장용 파일명만 전면에 노출하지 않는다. per-post export일 때는 마지막 글 폴더명을 대표 이름으로 보여 주고, 전체 `outputPath`는 경로 열에서 줄바꿈 가능해야 한다.
- 결과 파일 행은 버튼 기본 `nowrap`에 기대지 않는다. 긴 파일명과 제목은 셀 안에서 줄바꿈되어야 하고, 다른 열 위로 겹치면 안 된다.
- 작업 로그는 각 항목을 `타임스탬프 meta + 메시지 본문` 2줄 구조로 렌더링하고, 긴 메시지와 경로는 horizontal scroll 없이 wrap되어야 한다. 새 로그가 들어오면 viewport는 항상 마지막 항목으로 내려가야 한다.
- 결과 modal은 shadcn `DialogContent` 기본 `sm:max-w-lg`에 의존하지 않고, viewport 기반 `!w-*`와 `!max-w-*` override로 큰 preview shell을 강제한다.

## Icon Rules
- 프로젝트 아이콘은 Remix icon만 사용한다.
- favicon은 `ri-file-transfer-fill` 기반 SVG를 사용한다.
- 허용 위치는 `네비게이션 보조 / 상태 / 파일 / 액션`이다.
- 상단 브랜드 장식 아이콘은 금지한다.
- 텍스트만으로 충분한 곳에는 아이콘을 억지로 추가하지 않는다.

## Accessibility
- normal text contrast는 밝은 surface 기준 최소 `4.5:1`을 유지한다.
- sidebar brand, nav, summary title, action button도 예외 없이 `4.5:1` 이상을 유지한다.
- `text-muted-foreground`와 커스텀 설명 텍스트는 모두 같은 contrast policy를 따라야 한다.
- 버튼, filter chip, 상태 badge는 높이와 baseline이 흔들리지 않게 유지한다.
- focus ring은 primary halo를 사용하고, 상태는 색뿐 아니라 텍스트와 border로도 구분한다.

## Validation Rules
- `scripts/harness/run-ui-smoke.ts`의 contrast gate selector는 회귀 방지 대상이다.
- 현재 contrast gate 대상에는 category status, preview status, panel description, field help, frontmatter description, results description, file meta, modal meta, markdown frontmatter key, sidebar brand/nav/summary/action text가 포함된다.
- smoke screenshot capture는 `docs/generated/ui-review/round-01`부터 `round-05`까지 동일 시나리오로 누적한다.
- smoke는 desktop/mobile 모두 viewport horizontal overflow와 flush shell 정렬도 같이 검사한다.
- smoke는 desktop options 탭이 5열 grid인지, frontmatter 필드가 다열 grid로 접히는지도 같이 검사한다.
- smoke는 preview `source / rendered / split` 세 모드의 width와 내부 padding 일관성도 같이 검사한다.
- contrast gate는 translucent sidebar card까지 ancestor background를 합성해서 계산한다.

## Anti-Patterns
- raw hex를 feature component 내부 className에 직접 넣는 것
- `muted`를 설명문, disabled, meta, 상태 문구에 구분 없이 재사용하는 것
- sidebar brand에 장식 아이콘을 다시 넣는 것
- preview/status/logs를 서로 다른 시각 언어로 따로 노는 패널로 분리하는 것
- `dashboard.css` 같은 화면 전용 스타일 시트를 다시 도입하는 것
