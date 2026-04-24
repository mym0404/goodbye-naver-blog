# Shadcn Component Map

## 목적
- 이 문서는 현재 저장소에 설치된 shadcn primitive, 실제 사용처, 컴포넌트 선택 기준을 한곳에 모은다.
- 새 UI를 만들 때 "이미 있는 primitive로 끝낼 수 있는지"를 먼저 판단하는 기준 문서로 쓴다.

## Source Of Truth
- shadcn 프로젝트 설정: `components.json`
- 설치된 primitive 구현: `src/ui/components/ui`
- 전역 token과 helper surface: `src/ui/styles/globals.css`
- 디자인 규칙: `.agents/knowledge/DESIGN.md`
- shadcn CLI 기준 정보는 `npx shadcn@latest info --json` 출력과 `https://ui.shadcn.com/docs`를 함께 본다.
- `src/ui/components/ui/*`는 shadcn CLI 생성 surface로 본다. 웬만하면 feature 쪽 조합이나 token에서 해결하고, 공통 primitive 동작이나 variant 자체를 바꿔야 할 때만 직접 수정한다.

## 현재 설정
- registry style은 `new-york`, base는 `radix`, icon library는 `remix`다.
- 이 저장소의 UI 아이콘은 전부 Remix icon을 기준으로 쓴다. 새 아이콘도 `@remixicon/react`에서 고른다.
- Tailwind는 v4, css variable 기반 테마는 `src/ui/styles/globals.css`를 source of truth로 쓴다.
- 현재 설치된 shadcn primitive는 아래 17개다.
  - `alert`
  - `badge`
  - `button`
  - `card`
  - `checkbox`
  - `collapsible`
  - `dialog`
  - `input`
  - `progress`
  - `scroll-area`
  - `select`
  - `separator`
  - `skeleton`
  - `sonner`
  - `table`
  - `tabs`
  - `toggle-group`
- 현재 `src/ui`에는 native `<select>`가 없다. 단일 선택 dropdown은 모두 `Select`를 쓴다.

## 현재 사용처
| primitive | 현재 사용처 | 역할 |
| --- | --- | --- |
| `Alert` | `src/ui/features/options/export-options-panel.tsx` | frontmatter alias 같은 blocking validation |
| `Badge` | `src/ui/features/common/shell/wizard-header.tsx`, `src/ui/features/scan/category-panel.tsx`, `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | 단계 상태, count, 결과 status pill |
| `Button` | `src/ui/features/common/shell/wizard-dock.tsx`, `src/ui/features/scan/category-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | primary/secondary/destructive action |
| `Card` | `src/ui/App.tsx`, `src/ui/features/scan/blog-input-panel.tsx`, `src/ui/features/scan/category-panel.tsx`, `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | shell, section panel, status board |
| `Checkbox` | `src/ui/features/scan/category-panel.tsx`, `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | 독립 boolean field |
| `Collapsible` | `src/ui/features/options/export-options-panel.tsx` | 고급 옵션 펼침/접힘 |
| `Dialog` | `src/ui/features/resume/resume-dialog-panel.tsx` | resume/초기화 같은 modal interrupt |
| `Input` | `src/ui/features/scan/blog-input-panel.tsx`, `src/ui/features/scan/category-panel.tsx`, `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | text, path, url, alias, token 입력 |
| `Progress` | `src/ui/features/job-results/job-results-panel.tsx` | export/upload 진행률 |
| `ScrollArea` | `src/ui/features/scan/category-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | 긴 표와 로그 viewport |
| `Select` | `src/ui/features/scan/category-panel.tsx`, `src/ui/features/options/export-options-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | 단일 선택 dropdown |
| `Separator` | `src/ui/features/job-results/job-results-panel.tsx` | upload/result panel 내부 구획 |
| `Sonner` | `src/ui/App.tsx` | toast |
| `Table` | `src/ui/features/scan/category-panel.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | 카테고리 트리, 결과/업로드 파일 테이블 |
| `ToggleGroup` | `src/ui/features/common/shell/wizard-header.tsx`, `src/ui/features/job-results/job-results-panel.tsx` | theme toggle, 소수의 상호배타 선택 |
| `Skeleton` | 현재 미사용 | 실제 비동기 로딩 placeholder가 필요할 때만 사용 |
| `Tabs` | 현재 미사용 | 같은 깊이의 병렬 뷰가 필요할 때만 사용 |

## 선택 기준
- 텍스트, 경로, URL, token, alias, 숫자 입력: `Input`
- 서버 field schema가 `inputType === "checkbox"`인 값: `Checkbox`
- 하나만 고르는 dropdown: `Select`
- 2~7개 정도의 상호배타 선택지를 항상 노출해야 할 때: `ToggleGroup`
- 화면 섹션, 보드, 상태 패널: `Card`
- 짧은 상태 요약, count, phase pill: `Badge`
- 사용자가 멈춰야 하는 오류나 blocking validation: `Alert`
- 진행률 수치가 있는 작업: `Progress`
- 행이 많거나 스크롤 보존이 필요한 표/로그: `ScrollArea` + `Table`
- 작업 재개, 초기화 확인 같은 modal 흐름: `Dialog`
- 짧은 완료/실패 피드백: `Sonner`
- 섹션 내부 밀도만 정리하면 되는 구획선: `Separator`
- 고급 옵션을 접어 둘 때: `Collapsible`
- 실제 데이터 로딩 전 임시 자리표시자: `Skeleton`
- 같은 단계 안의 병렬 view 전환: `Tabs`

## 이 저장소에서 바로 적용할 규칙
- 새 아이콘을 추가할 때는 다른 icon set을 섞지 않는다. 전부 Remix icon으로 맞춘다.
- dropdown을 새로 만들 때 native `<select>`를 추가하지 않는다. 먼저 `Select`를 쓴다.
- 보이는 선택지가 2개뿐이라고 해서 임의의 active button 조합을 만들지 않는다. 상호배타 선택이면 먼저 `ToggleGroup` 적합성을 본다.
- boolean input을 raw checkbox markup으로 만들지 않는다. `Checkbox`를 우선한다.
- panel look이 다르다고 feature 파일에서 새 카드 스타일을 만들지 않는다. 먼저 `Card` variant나 token/helper class를 늘린다.
- validation color가 필요하면 feature 파일에서 raw red utility를 늘리기보다 `aria-invalid`와 primitive invalid style을 먼저 쓴다.
- dense admin 표는 custom div grid보다 `Table`을 우선하고, viewport가 길어지면 `ScrollArea`를 조합한다.
- wizard step 전환은 `Tabs`로 바꾸지 않는다. 현재 setup flow는 `src/ui/App.tsx`의 step 계약을 유지한다.

## 자주 쓰는 조합
- 블로그 입력이나 provider field 같은 일반 폼: `Input` + helper text + `aria-invalid`
- scope mode, image handling mode, provider picker 같은 단일 선택: `Select`
- theme 선택, 인증 모드처럼 선택지가 적고 즉시 전환되는 값: `ToggleGroup`
- 카테고리 선택 표: `Table` + `ScrollArea` + `Checkbox` + `Badge`
- 결과 패널: `Card` + `Badge` + `Progress` + `Table` + `ScrollArea`
- frontmatter alias 검증: `Alert` + `Badge` + `Input`

## 새 컴포넌트를 추가할 때 순서
1. 이미 설치된 primitive와 variant로 해결 가능한지 먼저 본다.
2. look 차이만 있으면 feature 파일이나 token/helper class에서 먼저 해결하고, 그래도 공통 primitive 계약이 맞지 않을 때만 primitive를 수정한다.
3. primitive를 건드리기 전에는 `npx shadcn@latest docs <component>`로 API와 권장 surface를 다시 확인한다.
4. 새 primitive를 추가할 때만 `npx shadcn@latest add <component>`를 쓴다.

## 헷갈리기 쉬운 선택
- `Select` vs `ToggleGroup`
  `Select`는 옵션 수가 많거나 vertical space를 아껴야 할 때 쓴다. `ToggleGroup`은 옵션 수가 적고 현재 선택지를 항상 보여줘야 할 때 쓴다.
- `Alert` vs `Badge`
  `Alert`는 사용자가 멈춰서 읽어야 하는 오류/경고다. `Badge`는 상태 라벨이다.
- `Card` vs helper div
  섹션 의미와 surface elevation이 있으면 `Card`를 쓴다. 단순 내부 정렬이면 div + helper class로 끝낸다.
- `Table` vs custom list
  열 머리글과 행 단위 비교가 있으면 `Table`을 쓴다. 단순 세로 스택이면 table로 만들지 않는다.
