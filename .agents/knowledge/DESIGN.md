# Design System

## 목적
이 문서는 이 저장소의 UI 기준 문서다. shadcn primitive, `globals.css` 토큰, wizard shell, 검증 기준을 한곳에서 유지한다.

## 시작점
- UI 셸과 단계 전환: `src/ui/App.tsx`
- 공용 shell/status/hook: `src/ui/features/common`
- 전역 토큰과 helper surface: `src/ui/styles/globals.css`
- 브랜드/소셜 정적 자산: `public/brand`
- shadcn chooser와 현재 사용처: `.agents/knowledge/engineering/shadcn-component-map.md`
- 복구 dialog와 상태: `src/ui/features/resume`
- 블로그 입력/스캔 상태: `src/ui/features/scan`
- 옵션 패널: `src/ui/features/options/export-options-panel.tsx`
- 결과/업로드 패널: `src/ui/features/job-results/job-results-panel.tsx`
- 카테고리 패널: `src/ui/features/scan/category-panel.tsx`
- 공용 primitive: `src/ui/components/ui`

## Source Of Truth
- theme source of truth는 `globals.css`다.
- primitive의 look은 `src/ui/components/ui/*`가 맡고, feature 파일은 layout과 composition 위주로 유지한다.
- UI 공용 shell, status, app-level hook은 `src/ui/features/common/*` 아래에서 관리한다.
- scan/resume/job-results 로직은 각 feature 폴더 안에서 소유하고, `App.tsx`는 최상위 composition에 집중한다.
- `src/ui/components/ui/*` 아래 shadcn CLI 생성 컴포넌트는 웬만하면 직접 고치지 않는다. 먼저 feature 조합, token, helper class, shadcn 문서 확인으로 해결하고, 공통 primitive 자체를 바꿔야 할 때만 수정한다.
- 로고, favicon, OG image, 그 원본 preview처럼 번들링이 필요 없는 브랜드 자산은 `src`가 아니라 `public/brand/`에 둔다.
- shadcn component를 다룰 때는 먼저 `npx shadcn@latest info --json`, `npx shadcn@latest docs <component>`로 현재 프로젝트 기준과 API를 확인한다.
- 아이콘은 전부 Remix icon 기준으로 유지하고, 새 아이콘도 `@remixicon/react`에서만 고른다.
- dark/light 선호값은 서버가 `.cache/export-ui-settings.json`에 저장하고 bootstrap 응답으로 복구한다.
- wizard step, DOM hook, upload lifecycle 의미는 기존 제품 계약을 그대로 유지한다.

## 스타일 방향
- 기본 테마는 `dark`, 보조 테마는 `light`다.
- 전체 인상은 Vercel식 dark-first utility다.
- 과한 장식보다 typography, contrast, shadow-as-border, spacing rhythm으로 밀도를 만든다.
- 옵션 화면은 기본적으로 compact density를 유지하고, 한 옵션 안에 card를 중첩하지 않는다.
- 대시보드 구조는 single-column wizard를 유지한다.
- card, form, table, log는 모두 같은 semantic token 위에서 보이게 한다.
- accent는 장식이 아니라 상태에만 쓴다.
  - scan/running: blue
  - upload/partial: pink
  - destructive/failure: coral red
  - success: green

## 토큰 원칙
- `:root`는 light companion theme, `.dark`는 기본 운영 테마다.
- 아래 token은 반드시 `globals.css`에서만 정한다.
  - `background`, `foreground`
  - `card`, `popover`
  - `primary`, `secondary`, `muted`, `accent`, `destructive`
  - `border`, `input`, `ring`
  - `success`, `warning`
  - `panel`, `panel-muted`, `panel-shadow-*`, `focus-ring`
  - `status-*-bg`, `status-*-fg`
- feature 컴포넌트 안에 raw hex를 직접 넣지 않는다.
- 같은 상태 색을 여러 번 쓰면 token 또는 helper class로 올린다.

## Typography
- 기본 sans는 Geist Sans, mono는 Geist Mono를 쓴다.
- 한국어 fallback은 `"Apple SD Gothic Neo"`, `"Noto Sans KR"` 순서를 유지한다.
- 숫자, 경로, 파일명, status pill, code, log timestamp는 mono + `tabular-nums`를 우선한다.
- 큰 제목은 강한 negative tracking을 허용하지만 body text는 16px 이상, line-height 1.5 이상을 유지한다.

## Primitive 규칙
- `Button`, `Card`, `Badge`, `Input`, `Table`, `Dialog`, `Alert`, `Progress`, `Sonner`는 semantic token만 사용한다.
- dropdown과 single-choice select는 native `<select>` 대신 shadcn `Select`를 우선한다.
- checkbox, option toggle처럼 이미 설치된 control은 native input보다 shadcn primitive를 우선한다.
- shadcn CLI가 생성한 primitive 파일은 feature 버그를 막기 위한 임시 패치 장소로 쓰지 않는다.
- 2~7개 선택지 전환은 가능하면 `ToggleGroup`으로 묶고, 별도 active button 조합을 만들지 않는다.
- primitive variant로 해결 가능한 색 표현은 feature 파일에 남기지 않는다.
- 새 variant가 필요하면 먼저 primitive에 추가한다.
- `Card`
  - `panel`: 최상위 board
  - `subtle`: 섹션 wrapper
  - `elevated`: 강조 패널
- `Badge`
  - `success`, `running`, `ready`, `idle`, `destructive`를 우선 사용한다.
- `Button`
  - `default`: step의 primary action
  - `surface`: 보조 버튼
  - `ghost`: 필터/저강도 액션
  - `quiet-destructive`: 강조는 필요하지만 filled danger가 과한 곳

## Feature 규칙
- feature 파일은 `layout + composition` 역할만 맡는다.
- 상단 wizard header는 단계명만 보여주고, 반복 설명 문구는 각 단계에서 다시 복제하지 않는다.
- form control은 feature 파일 안에서 raw color utility로 꾸미지 않고 `Input`, `Select`, `Checkbox`, `ToggleGroup` 조합으로 끝내는 것을 기본값으로 본다.
- 옵션 행은 가능한 한 짧은 높이와 얕은 padding을 유지하고, 설명은 꼭 필요한 문장만 둔다.
- 가능한 helper class:
  - `board-card`
  - `panel-header`
  - `field-card`
  - `subtle-panel`
  - `empty-state-surface`
  - `code-surface`
  - `code-surface-inverse`
  - `floating-dock`
  - `status-pill--*`
  - `upload-badge--*`
  - `log-surface`
- 허용하는 하드코딩은 아래만 남긴다.
  - 레이아웃 수치
  - breakpoint
  - 한 번성 backdrop gradient
  - 특정 상태를 연결하는 의미 있는 accent class
- 금지
  - `bg-slate-*`, `text-slate-*`, `border-slate-*`를 반복해서 박는 것
  - native `<select>`를 새로 추가하는 것
  - feature마다 다른 shadow 값을 따로 만드는 것
  - dark/light 전환 로직을 각 feature가 따로 가지는 것

## 화면 계약
- `data-step-view`, `#blogIdOrUrl`, `#scan-button`, `#export-button`, `#job-file-tree`, `[data-job-filter]`, `#summary`, `#status-text`, `#logs`는 유지한다.
- `running`, `upload`, `result`는 같은 결과 표를 공유한다.
- 업로드 상태 badge는 `대기`, `부분 완료`, `완료`, `실패`를 soft badge로 유지한다.
- floating bottom dock는 유지하되, full-width footer처럼 보이지 않고 떠 있는 command dock처럼 보여야 한다.
- theme toggle은 상단 shell에서만 제공하고, 각 step 안에 중복 배치하지 않는다.
- theme toggle은 좁은 화면에서도 오른쪽 상단에 고정된 한 줄 배치를 유지한다.

## 접근성 및 모션
- contrast target은 normal text 기준 4.5:1 이상을 유지한다.
- dark/light 둘 다 별도로 contrast를 확인한다.
- focus는 outline 제거 대신 `focus-ring` token으로 보인다.
- 150~300ms 범위의 transform/opacity 중심 transition만 사용한다.
- progress, toast, dialog, toggle은 reduced-motion에서도 맥락이 유지되어야 한다.

## 검증
- 기본 명령
  - `pnpm build:ui`
  - `pnpm check:local`
  - `pnpm smoke:ui`
- smoke는 아래를 회귀 대상으로 본다.
  - dark 기본 렌더
  - light 전환 후 저장/복원
  - contrast target 유지
  - desktop/mobile overflow 없음
  - upload lifecycle
  - resume dialog와 단계 복구
- 수동 확인은 `globals.css` 토큰만 바꿔도 primitive 전반이 같이 반응하는지 먼저 본다.

## Anti-Patterns
- feature 파일에서 색/배경/보더를 직접 계속 덧씌우는 것
- primitive를 우회하고 화면마다 다른 버튼/카드 스타일을 만드는 것
- dark theme를 body 배경만 바꾸고 panel, input, table, toast는 밝게 남겨 두는 것
- light theme를 단순 color invert로 처리하는 것
- 상태를 색만으로 구분하고 텍스트/보더 구분을 빼는 것
