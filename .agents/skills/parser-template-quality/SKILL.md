---
name: parser-template-quality
description: Audit and automatically fix every parser block's extracted prop schema, block boundary, and Markdown preset quality in this repository. Use when Codex needs to validate parser template props, nested prop contracts, preset semantics, optional-value rendering, parser block coverage, or remove P0-P2 parser/template defects across Naver and Tistory.
---

# Parser Template Quality

전체 registry를 실제 코드에서 읽고, 플랫폼별로 모든 block을 감사한 뒤 P0·P1·P2를 직접 수정하고 같은 inventory를 다시 검사해요.

## 완료 조건

- Naver와 Tistory를 독립적으로 판정해요.
- registry에서 읽은 모든 block을 검사해요. 문서의 고정 개수는 inventory로 쓰지 않아요.
- P0·P1·P2가 0개일 때만 완료해요.
- 하위 호환 prop, preset alias, migration shim은 만들지 않아요.
- 영구 audit script나 결과 ledger는 만들지 않아요.
- 결정적 계약은 Vitest에 남기고 semantic 판단은 이 스킬과 `.agents/knowledge/parser-blocks.md`를 따라요.

## 실행 순서

1. Naver editor의 `supportedBlocks`와 Tistory의 parser registry에서 전체 key 순서를 읽어요.
2. 각 block의 parser, `templateDefinition`, focused spec을 함께 읽어요.
3. 대표 source HTML 또는 module data, 정확한 parsed props assertion, 모든 preset의 정확한 Markdown 결과를 증거로 확보해요.
4. 아래 기준으로 P0·P1·P2를 기록하고 즉시 수정해요.
5. parser 추출, prop schema, block 경계, preset, focused spec을 한 묶음으로 갱신해요.
6. 변경된 공개 샘플이 이미 있으면 fixture 기대값을 갱신해요. 적합한 공개 글이 있을 때만 새 live fixture를 추가해요.
7. Storybook catalog를 실제 registry에서 다시 생성해요.
8. 같은 inventory를 재검사하고 P0·P1·P2가 0개인지 확인해요.

## Prop 기준

- 원문에서 안정적으로 얻는 정규 데이터만 공개해요.
- 사용자에게 보이는 텍스트, 링크, 캡션, 썸네일, 목록 계층, 표 구조를 빠뜨리지 않아요.
- built-in preset에서 쓰지 않아도 안정적인 원본 데이터면 유지할 수 있어요.
- `marker`, `prefix`처럼 다른 prop에서 바로 계산하는 출력 전용 값은 제거해요.
- 요청마다 바뀌는 토큰이나 지속성을 증명하지 못한 값은 제거해요.
- `array`에는 `items`, `object`에는 `properties`를 끝까지 기술해요.
- optional 표기와 parser가 반환하는 `null`·`undefined`·누락 가능성을 일치시켜요.
- 구조·무시 block은 자체 가시 콘텐츠가 없거나 자식에게 위임한다는 증거를 확인해요.

## Preset 기준

- 첫 preset은 기본값이며 원문의 Markdown 의미를 보존해야 해요.
- 제목 단계, 수식 inline/display, 목록 순서, 링크, 캡션 등 표현 가능한 의미를 유지해요.
- 너비, 정렬, 장식처럼 Markdown에서 안정적으로 표현하기 어려운 시각 속성은 정규화할 수 있어요.
- 서로 다른 출력 의도가 있을 때만 추가 preset을 둬요.
- 정보 생략 preset은 `링크만`처럼 라벨에서 범위를 밝혀요.
- optional 값이 없어도 모든 preset이 오류나 `undefined` 없이 렌더되어야 해요.
- Markdown으로 의미를 보존하기 어려운 복합 표에만 raw HTML을 사용해요.
- 빈 template은 `ignore`/`무시` 또는 `children`/`하위 블록`처럼 이유가 명시된 경우만 허용해요.

## 심각도

- P0: parser·template 렌더 실패 또는 schema/type 계약 위반. 반드시 수정해요.
- P1: 기본 preset의 가시 정보 손실, URL·계층·표현 오류, visible block 오인 무시. 반드시 수정해요.
- P2: 중복 파생 prop, 부정확한 라벨, 중복 preset, 불필요한 HTML, 중첩 schema 누락. 반드시 수정해요.
- P3: 의미를 바꾸지 않는 이름·표현 다듬기. 통과를 막지 않고 마지막에만 보고해요.

## 수정 규칙

- block별 template 문자열과 parsed props 생성은 owning block 파일에 둬요.
- 다른 content responsibility가 다른 prop 계약을 요구하면 block을 분리해요.
- custom template 호환을 위해 제거한 prop이나 preset을 남기지 않아요.
- semantic 판단을 억지로 공통 자동화하지 않아요.
- 변경한 block에는 source shape, 정확한 props, 정확한 preset Markdown을 검증하는 focused spec을 남겨요.
- `tests/support/parser-test-utils.ts`의 재귀 schema와 preset 렌더 검사를 사용해요.

## 검증

변경 범위의 focused Vitest를 먼저 실행하고 마지막에 아래 명령을 모두 실행해요.

```sh
mise exec -- pnpm check:fmt
mise exec -- pnpm check:lint
mise exec -- pnpm check:type
mise exec -- pnpm build:server
mise exec -- pnpm check:storybook
mise exec -- pnpm build:ui
mise exec -- pnpm check:unused
mise exec -- pnpm check:coverage
mise exec -- pnpm check:playwright
```

`check:coverage`가 전체 Vitest를 포함하므로 `check:test`를 다시 실행하지 않아요.

## 보고

- 플랫폼별 전체 block 수와 검사 수를 적어요.
- 수정한 block 수를 적어요.
- P0·P1·P2의 발견 수와 최종 잔여 수를 적어요.
- 남은 P3만 근거와 함께 적어요.
