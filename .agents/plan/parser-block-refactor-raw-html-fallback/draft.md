# Parser Block Structure Refactor

## 목표
parser의 editor별 if-chain을 모든 editor에 적용 가능한 `ContainerBlock` / `LeafBlock` parser node dispatch 구조로 바꾸고, fallback은 Turndown 복구 없이 literal HTML passthrough + warning diagnostic으로 단순화한다.

## 변경 범위

| 영역 | 현재 | 변경 후 | 기준 |
| --- | --- | --- | --- |
| Parser node 구조 | editor 내부 if-chain이 직접 AST를 만든다. | 모든 editor가 `ContainerBlock` / `LeafBlock` parser node를 `supportedBlocks`로 관리한다. | [base-editor.ts](/Users/mj/projects/farewell-naver-blog/src/modules/parser/editors/base-editor.ts:15) |
| Block modules | editor 파일 안에 helper와 분기가 섞여 있다. | `parser/blocks/{common,naver-se2,naver-se3,naver-se4}` module로 분리한다. | [naver-blog-se4-editor.ts](/Users/mj/projects/farewell-naver-blog/src/modules/parser/editors/naver-blog-se4-editor.ts:715) |
| Fallback | 알 수 없는 HTML을 Turndown으로 Markdown paragraph화하거나 `rawHtml` block으로 다룬다. | fallback에서는 Turndown을 쓰지 않고 literal HTML을 그대로 출력하며 warning을 남긴다. | [html-fragment-converter.ts](/Users/mj/projects/farewell-naver-blog/src/modules/converter/html-fragment-converter.ts:63) |
| rawHtml block | `AstBlock`에 `rawHtml`이 있고 rawHtml output option/UI가 있다. | `rawHtml` block/output option 개념을 제거하고 fallback diagnostic으로만 취급한다. | [types.ts](/Users/mj/projects/farewell-naver-blog/src/shared/types.ts:533) |
| SE2 순회 | DOM node 재귀와 block 변환이 한 함수에 섞여 있다. | SE2도 같은 parser node contract를 쓰되 wrapper, skip, fallback을 명시적으로 표현한다. | [naver-blog-se2-editor.ts](/Users/mj/projects/farewell-naver-blog/src/modules/parser/editors/naver-blog-se2-editor.ts:332) |
| SE3/SE4 순회 | component 단위 if-chain으로 처리한다. | component도 parser node로 보고 `match()` / `convert()` 순서를 기존 동작과 같게 유지한다. | [naver-blog-se3-editor.ts](/Users/mj/projects/farewell-naver-blog/src/modules/parser/editors/naver-blog-se3-editor.ts:198) |
| Unsupported | case별 candidate 선택, normalizer, UI 확인 흐름이 있다. | 대표 case 선택/확정 로직을 제거하고 fallback HTML + warning 흐름으로 합친다. | [unsupported-block-cases.ts](/Users/mj/projects/farewell-naver-blog/src/shared/unsupported-block-cases.ts:64) |
| UI | unsupported case 선택/확정과 rawHtml output 선택이 export 옵션에 있다. | unsupported case UI와 rawHtml output option UI를 제거하고 결과 warning UI만 유지한다. | [export-options-panel.tsx](/Users/mj/projects/farewell-naver-blog/src/ui/features/options/export-options-panel.tsx:667) |

## 포함

| 항목 | 내용 |
| --- | --- |
| Parser contract | 전 editor 공용 `ParserBlock`, `ContainerBlock`, `LeafBlock`, `ParserBlockResult` 타입 추가 |
| Block modules | common helper와 editor별 block 파일 분리 |
| Editor migration | SE2, SE3, SE4 parse 흐름을 `supportedBlocks` 기반으로 이전 |
| Fallback rewrite | fallback Turndown 사용 제거, literal HTML passthrough + warning diagnostic 일원화 |
| rawHtml 제거 | `AstBlock`의 `rawHtml` variant, block registry rawHtml option, rawHtml UI/test 제거 또는 대체 |
| Unsupported simplification | candidate/resolution/confirmation/normalizer 경로 제거 또는 무력화 |
| UI 반영 | unsupported case 카드, 확정 요약, export gating, rawHtml output option 제거 |
| Tests/docs | parser/unit/sample/UI 테스트 조정, generated/knowledge projection 갱신 |

## 제외

| 제외 항목 | 이유 |
| --- | --- |
| 새 네이버 block 지원 | 구조 리팩토링과 fallback 정책 단순화가 목표 |
| live fixture refresh | 저장된 fixture 회귀 기준으로 판단 |
| upload/provider 변경 | parser 출력 정책과 별도 경계 |
| manifest resume 계약 변경 | export 복구 구조는 건드리지 않음 |

## 설계 결정

| 결정 | 내용 |
| --- | --- |
| 적용 범위 | `ContainerBlock` / `LeafBlock`은 SE2 전용이 아니라 모든 editor block에 적용된다. |
| 출력 타입 | 지원 block의 `convert()` 최종 출력은 공용 `AstBlock[]`만 사용한다. |
| Container node | 출력하지 않고 자식 parser node 또는 DOM children으로 순회를 넘긴다. |
| Leaf node | 현재 node/component를 소비하고 `handled`, `skip`, `fallback` 결과를 반환한다. |
| Fallback | fallback은 구조화 실패 신호다. Turndown으로 Markdown 복구하지 않는다. |
| Literal HTML | fallback 결과는 raw HTML literal output과 warning diagnostic으로 전달한다. |
| rawHtml block | `rawHtml`을 사용자가 선택 가능한 block/output family로 유지하지 않는다. |
| Turndown 허용 범위 | text/quote/heading/table cell처럼 지원 block 내부 inline HTML 변환에만 허용한다. |
| Capability | parser capability는 계속 `editorVersion + blockType` 기준으로 유지하되 rawHtml capability는 제거 또는 재분류한다. |

## 위험 지점

| 위험 | 방어 기준 |
| --- | --- |
| Parser node 순서가 바뀌어 출력 AST가 달라짐 | 기존 editor별 if-chain 순서를 block 배열 순서로 그대로 이관 |
| fallback Turndown 제거로 Markdown 출력이 크게 변함 | 변경된 expected.md와 warning count를 의도된 결과로 검토 |
| `rawHtml` variant 제거가 renderer/exporter 타입에 연쇄 영향 | `AstBlock`, renderer, block registry, CLI/UI options, tests를 같은 task에서 정리 |
| literal HTML passthrough와 sanitize 정책 충돌 | 보안/위생 정책 충돌 시 stop condition으로 사용자 결정 요청 |
| unsupported gating 제거 뒤 export 시작 조건이 달라짐 | wizard/UI smoke와 app tests로 확인 |

## 검증 방향

| 명령 | 기대 신호 |
| --- | --- |
| `pnpm typecheck` | `rawHtml` 제거와 새 parser block 타입 연결 통과 |
| `pnpm test:offline` | parser, renderer, exporter, UI unit 회귀 통과 |
| `pnpm parser:check` | capability, sample, generated projection 일치 |
| `pnpm samples:verify` | 의도된 fixture 출력과 warning 정책 일치 |
| `pnpm quality:report` | generated docs 갱신 완료 |
| `pnpm smoke:ui` | unsupported/rawHtml option 제거 뒤에도 export wizard 흐름 통과 |
| `pnpm check:local` | 저장소 기본 검증 통과 |

## 중단 조건

| 조건 | 조치 |
| --- | --- |
| literal HTML passthrough가 보안/위생 정책과 충돌 | 사용자 결정 요청 |
| 기존 실패가 `check:local`에서 드러남 | 현재 작업 회귀가 아니면 중단 보고 |
| 출력 정책이 literal HTML + warning을 넘어 확장 필요 | 범위 재승인 요청 |
