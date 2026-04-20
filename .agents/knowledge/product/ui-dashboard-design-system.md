# UI Dashboard Design System

## 목적
React 대시보드를 shadcn semantic token과 source-based component composition 중심으로 유지하기 위한 기준 문서다.

## Source Of Truth
- 구조와 상태 흐름: `src/ui/App.tsx`
- 브라우저 메타와 favicon: `index.html`, `src/ui/assets/favicon.svg`
- semantic token: `src/ui/styles/globals.css`
- 화면 표현과 반응형 레이아웃: `src/ui/**/*.tsx`의 Tailwind utility class
- 브라우저 검증: `scripts/harness/run-ui-smoke.ts`, `docs/runbooks/browser-verification.md`

## 관련 코드
- [../../../src/ui/App.tsx](../../../src/ui/App.tsx)
- [../../../index.html](../../../index.html)
- [../../../src/ui/assets/favicon.svg](../../../src/ui/assets/favicon.svg)
- [../../../src/ui/styles/globals.css](../../../src/ui/styles/globals.css)
- [../../../src/ui/features/options/export-options-panel.tsx](../../../src/ui/features/options/export-options-panel.tsx)
- [../../../src/ui/features/job-results/job-results-panel.tsx](../../../src/ui/features/job-results/job-results-panel.tsx)
- [../../../scripts/harness/run-ui-smoke.ts](../../../scripts/harness/run-ui-smoke.ts)

## 검증 방법
- `pnpm typecheck`: UI 컴포넌트 조합, shared 타입, hook 시그니처가 깨지지 않았는지 빠르게 확인할 때 실행한다.
- `pnpm test:coverage`: UI 회귀가 테스트 커버리지 게이트를 해치지 않았는지 확인할 때 실행한다.
- `agent-browser`: UI 변경 요청에서 레이아웃, 간격, 상호작용, 실제 화면 회귀를 먼저 확인할 때 사용한다.
- `pnpm smoke:ui`: 반복 회귀를 Playwright로 고정한 레이아웃, contrast, export/upload 흐름을 다시 확인할 때 실행한다.

## Style Direction
- 메인 캔버스는 밝은 blue-neutral surface를 사용하고, 핵심 단계 카드 하나에 시선을 모은다.
- 상단은 현재 단계와 요약만 남기는 최소 헤더를 사용하고, 단계 액션 버튼은 설정 단계에서 피그마 같은 floating bottom toolbar로 고정한다.
- 블로그 ID 입력과 카테고리 스캔 액션은 첫 단계 카드에 둔다.
- 카테고리 패널은 카드 나열 대신 고정 높이 scroll area 안의 표로 유지한다.
- 앱의 관리용 표는 compact row density를 기본으로 하고, 파일/상태 확인도 카드 리스트보다 표를 우선한다.
- 각 시점에는 현재 단계 UI 한 개만 렌더링하고, 이전/다음 단계 UI를 동시에 노출하지 않는다.
- options와 status는 각각 독립 board지만 spacing, border, shadow rhythm을 공유한다.
- layout은 desktop/mobile 모두 single-column wizard 흐름을 유지한다.
- 최상위 shell은 viewport에 바로 붙는다. 바깥 프레임용 여백이나 화면 바깥으로 밀리는 horizontal overflow를 두지 않는다.
- export가 `queued`, `running`이면 실행 단계만, `upload-ready`, `uploading`, `upload-failed`이면 업로드 단계만, `completed`, `failed`, `upload-completed`이면 결과 단계만 보여 준다.

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
- form 성격의 단계는 입력/선택 UI를 먼저 읽고 마지막에 CTA를 누르는 흐름을 우선한다.
- 하단 floating toolbar가 떠 있는 단계는 툴바 폭을 화면 전체로 늘리지 않고, 본문 위에 떠 있는 보조 레이어처럼 보이게 유지한다.
- 하단 floating toolbar가 떠 있는 단계는 본문 마지막 요소가 버튼 아래로 가려지지 않도록 하단 여백을 함께 확보한다.
- 텍스트 입력은 `Input`, 상태 pill과 count는 `Badge`, 오류/가이드 배너는 `Alert`를 우선한다.
- 사용자 피드백 토스트는 `sonner` 기반 `Toaster`/`toast()`로 통일한다.
- 앱 표는 `src/ui/components/ui/table.tsx` 공용 컴포넌트를 사용하고, header/cell padding은 compact 기본값을 유지한다.
- feature 전용 화면 스타일은 별도 CSS 파일 대신 각 컴포넌트의 Tailwind utility class로 유지한다.
- `globals.css`는 토큰, base element reset, native `select` 기본 스타일만 담당한다.
- 바깥 frame spacing은 CSS 파일이 아니라 `App.tsx` 셸 utility에서만 제어한다.
- category/search/output/status의 DOM hook은 유지하고, 현재 단계 루트에는 `data-step-view="<step-id>"`를 둔다.
  `#blogIdOrUrl`, `#scan-button`, `#export-button`, `#job-file-tree`, `[data-job-filter]`, `#summary`, `#status-text`, `#logs`
- scan 후 summary와 category panel의 count는 현재 선택 범위 기준 대상 글 수를 즉시 반영해야 한다.
- category 선택은 tree semantics를 따른다. 부모 선택은 하위 전체를 함께 토글하고, 일부 자식만 선택되면 부모는 partial state로 보여야 한다.
- category table은 parent-before-children 순서를 유지하고 depth 기반 indent로 위계를 바로 읽을 수 있어야 한다.
- 카테고리 단계는 트리 선택과 함께 `카테고리 포함 범위`, `시작일`, `종료일` 입력을 같이 보여 준다.
- 블로그 입력 단계 하단 액션에는 `카테고리 불러오기`와 `강제로 불러오기`를 같이 둔다.
- 기본 `카테고리 불러오기`는 서버 파일 캐시 `outputs/scan-cache.json`을 재사용해 새로고침 뒤에도 같은 블로그 스캔을 빠르게 열어야 한다.
- `강제로 불러오기`는 `캐시 무효화` tooltip을 노출하고, 같은 블로그 입력이어도 서버 재스캔을 강제한다.
- option panel은 `구조 -> Frontmatter -> Markdown -> Assets -> 진단`을 각각 독립 단계로 렌더링한다.
- `범위` 탭은 두지 않고, 카테고리 단계가 범위 설정을 함께 맡는다.
- frontmatter 필드 목록은 데스크톱에서 2~3열 grid로 보여 주고, 각 필드 안에서 토글/설명/alias 입력을 함께 묶는다.
- `Assets`는 `이미지 처리 방식`, `로컬 이미지 압축`, 다운로드 토글을 관리하고, 업로더 설정 폼은 여기 두지 않는다.
- `Assets`에서 `이미지 처리 방식`은 `download / remote / download-and-upload` 세 모드를 제공한다.
- `Assets`의 기본값은 `download-and-upload + 로컬 이미지 압축 켬`이다.
- `이미지 처리 방식`이 `remote`면 로컬 압축, 다운로드 토글은 모두 비활성화한다.
- `이미지 처리 방식`이 `download-and-upload`면 결과 패널에서만 업로드 폼을 열고, 대상 자산 수와 상태를 함께 보여 준다.
- 업로드 단계의 GitHub provider는 `jsDelivr CDN 사용` 체크박스를 따로 두고, 켜면 `https://cdn.jsdelivr.net/gh/<repo>@<branch>` 기준 `customUrl`을 함께 보낸다. branch가 비어 있으면 `@<branch>`는 생략한다.
- `진단 설정`은 마지막 옵션 단계이고, 현재는 `이미지 다운로드 실패 처리`를 담당한다.
- `upload-ready`와 `upload-failed` 단계에서도 결과 파일 표를 같이 보여 주어 경고/실패를 업로드 전에 확인할 수 있어야 한다.
- 다음 단계로 이동하면 현재 옵션 섹션의 맨 위로 스크롤을 되돌린다.
- status panel은 mode 기반으로 `실행 중 / 업로드 / 결과` 중 하나만 보여 준다.
- upload 대상 표는 compact table을 유지하고, 업로드 입력은 raw JSON textarea 대신 provider 선택과 provider별 구조화 필드를 사용한다.
- 업로드 폼은 `upload-ready`와 `upload-failed`에서만 보이고, `upload-failed`일 때는 같은 job에서 값 수정 후 바로 재시도할 수 있어야 한다.
- running panel은 `#running-progress`에서 `처리한 글 수 / 전체 글 수`를 progress bar로 보여 준다.
- upload panel은 `#upload-progress`에서 `업로드된 고유 자산 수 / 전체 대상 자산 수`를 progress bar로 보여 준다.
- 업로드가 진행되면 같은 표에서 글 기준 `대기 / 부분 완료 / 완료 / 실패` 상태가 바뀌고, `upload-failed`에서는 모든 row를 `실패`로 override한다.
- `uploadedCount === candidateCount && status === "uploading"`이면 full bar여도 완료가 아니라 rewrite 대기 문구를 보여 줘야 한다.
- 업로드 대상이 있었던 job은 `upload-completed` 뒤 결과 단계로 넘어가도 같은 `#upload-progress`와 대상 표를 유지해서 방금 끝난 업로드 상태를 놓치지 않게 한다.
- upload 대상 표는 `#upload-targets-scroll` 내부 `max-height` 스크롤 영역에 넣어 desktop/mobile 모두 패널 높이를 무너뜨리지 않아야 한다.
- zero-candidate 완료는 폼 대신 설명 문구만 남긴다.
- 결과 파일 표는 `index.md` 같은 저장용 파일명만 전면에 노출하지 않는다. per-post export일 때는 마지막 글 폴더명을 대표 이름으로 보여 주고, 전체 `outputPath`는 경로 열에서 줄바꿈 가능해야 한다.
- 결과 파일 행은 버튼 기본 `nowrap`에 기대지 않는다. 긴 파일명과 제목은 셀 안에서 줄바꿈되어야 하고, 다른 열 위로 겹치면 안 된다.
- 결과 파일 표는 내용이 적을 때 불필요한 빈 높이를 만들지 않고, 길어질 때만 최대 높이 안에서 스크롤되어야 한다.
- 작업 로그는 각 항목을 `타임스탬프 meta + 메시지 본문` 2줄 구조로 렌더링하고, 긴 메시지와 경로는 horizontal scroll 없이 wrap되어야 한다. 새 로그가 들어오면 viewport는 항상 마지막 항목으로 내려가야 한다.

## Copy Rules
- UI 문구는 자연스러운 한국어를 기본으로 하고, 같은 화면 안에서 영어 라벨과 한국어 설명을 섞어 쓰지 않는다.
- 입력 안내는 사용자가 바로 해야 할 행동을 짧게 적는다. `만 입력`, `보여 줍니다`처럼 불필요하게 제한하거나 기계적인 표현은 피한다.
- 단계 설명은 `무엇을 확인하는지`, `무엇을 정하는지`, `무엇을 불러오는지`처럼 현재 화면의 목적을 바로 드러내야 한다.
- 상태 문구와 토스트는 내부 구현 용어보다 사용자 행동 기준으로 쓴다. `job`, `export visibility` 같은 내부 표현은 그대로 노출하지 않는다.
- 같은 개념은 같은 이름으로 유지한다. `블로그 ID 또는 URL`, `내보내기`, `카테고리`, `업로드`처럼 핵심 용어를 화면마다 바꾸지 않는다.

## Icon Rules
- 프로젝트 아이콘은 Remix icon만 사용한다.
- favicon은 `ri-file-transfer-fill` 기반 SVG를 사용한다.
- 허용 위치는 `네비게이션 보조 / 상태 / 파일 / 액션`이다.
- 상단 브랜드 장식 아이콘은 금지한다.
- 텍스트만으로 충분한 곳에는 아이콘을 억지로 추가하지 않는다.

## Accessibility
- normal text contrast는 밝은 surface 기준 최소 `4.5:1`을 유지한다.
- 단계 라벨, 요약 metric, 상단 액션 버튼도 예외 없이 `4.5:1` 이상을 유지한다.
- `text-muted-foreground`와 커스텀 설명 텍스트는 모두 같은 contrast policy를 따라야 한다.
- 버튼, filter chip, 상태 badge는 높이와 baseline이 흔들리지 않게 유지한다.
- focus ring은 primary halo를 사용하고, 상태는 색뿐 아니라 텍스트와 border로도 구분한다.
- step마다 가장 중요한 액션 버튼 하나만 `Primary`를 사용하고, 이전/보조 액션은 `secondary` 또는 `outline`으로 낮춘다.

## Validation Rules
- UI 변경 요청 검증은 먼저 `agent-browser`로 수행한다.
- 수동 검증이 반복되거나 CI 회귀로 남길 가치가 생기면 Playwright harness 케이스로 올린다.
- `scripts/harness/run-ui-smoke.ts`의 contrast gate selector는 회귀 방지 대상이다.
- 현재 contrast gate 대상에는 step label, header description, summary metric, category status, panel description, field help, frontmatter description, results description, job result text, scan status note, export action text가 포함된다.
- smoke screenshot capture는 `docs/generated/ui-review/round-01`부터 `round-05`까지 동일 시나리오로 누적한다.
- smoke는 desktop/mobile 모두 viewport horizontal overflow를 같이 검사한다.
- smoke는 `data-step-view` 전환, scan 재사용/재조회, frontmatter 다열 grid, assets 단계 전 export 버튼 비노출을 같이 검사한다.
- smoke는 mocked API payload로 `upload-ready -> uploading -> upload-failed -> retry -> upload-completed`를 강제로 재현하고, progress hook(`#running-progress`, `#upload-progress`), rewrite-pending full bar, row 상태, form visibility, mobile upload table overflow까지 확인한다.
- smoke screenshot과 로그에는 placeholder config만 쓰고, raw secret 값은 남기지 않는다.
- contrast gate는 translucent card 배경까지 ancestor background를 합성해서 계산한다.

## Anti-Patterns
- raw hex를 feature component 내부 className에 직접 넣는 것
- `muted`를 설명문, disabled, meta, 상태 문구에 구분 없이 재사용하는 것
- 단계형 wizard를 무시하고 여러 단계 패널을 한 화면에 다시 쌓는 것
- options/status/logs를 서로 다른 시각 언어로 따로 노는 패널로 분리하는 것
- `dashboard.css` 같은 화면 전용 스타일 시트를 다시 도입하는 것
