# Knowledge Home

## 시작점
- 프로젝트 개요와 출력 규약: `.agents/knowledge/product/product-outline.md`
- 검증 의미와 bundle 구성: `.agents/knowledge/engineering/validation.md`
- engineering 라우터: `.agents/knowledge/engineering/index.md`
- architecture 라우터: `.agents/knowledge/architecture/index.md`
- product 라우터: `.agents/knowledge/product/index.md`
- design system canon: `.agents/knowledge/DESIGN.md`
- reference tier: `.agents/knowledge/reference/index.md`

## 라우터 운영 규칙
- evergreen 지식은 이 트리에서 관리한다. 루트 `AGENTS.md`가 항상 첫 진입점이다.
- 실제 source of truth 우선순위는 사용자 지시와 루트 `AGENTS.md`, 코드/설정/테스트, evergreen knowledge, reference/generated 문서 순서다.
- 스택, verification bundle, 구현 규칙은 `.agents/knowledge/engineering/`, 모듈 경계와 파이프라인은 `.agents/knowledge/architecture/`, 도메인 제약과 출력 규약은 `.agents/knowledge/product/`, UI 규칙은 `.agents/knowledge/DESIGN.md`로 내려간다.
- `.agents/knowledge/reference/` 아래 문서는 반복 절차와 산출물 참고용이다. 제품 계약이나 구조 계약의 source of truth가 아니다.

## 문서 지도
- `.agents/knowledge/`: 반복해서 참조해야 하는 evergreen 저장소 지식
- `.agents/knowledge/reference/`: runbook, generated 보고서, 플랜 아카이브, 트러블슈팅, README 이미지처럼 깊게 보는 참고 자료
- `.cache/`: 카테고리 스캔 캐시와 export UI 설정 같은 영속 로컬 상태 저장 위치
- `public/brand/`: 로고, favicon, OG image, preview 원본 같은 정적 브랜드 자산 위치
- `.agents/plan/`: 현재 plan-execute 번들과 evidence
- `README.md`, `CONTRIBUTING.md`: 사용자와 기여자용 진입 문서

## 대표 코드 기준점
- 저장소 명령과 검증 루프: `package.json`
- parser/block SoT: `src/shared/block-registry.ts`
- parser editor dispatch: `src/modules/parser/post-parser.ts`, `src/modules/parser/editors/*`
- parser 지원 범위 projection: `src/shared/parser-capabilities.ts`
- 실샘플 기준: `src/shared/sample-corpus.ts`
- export/upload API 흐름: `src/server/http-server.ts`
- export 파이프라인: `src/modules/exporter/naver-blog-exporter.ts`

## 먼저 봐야 하는 seam
- parser block 지원 범위나 fallback 정책을 바꾸면 `src/shared/block-registry.ts`, `src/shared/parser-capabilities.ts`, `.agents/knowledge/architecture/parser-block-catalog.md`를 함께 본다.
- sample 추가나 교체는 `src/shared/sample-corpus.ts`와 generated projection인 `.agents/knowledge/product/sample-corpus.md`를 함께 본다.
- export 후 upload 상태 전이나 결과 패널을 바꾸면 `.agents/knowledge/product/domain.md`, `.agents/knowledge/product/product-outline.md`, `src/server/http-server.ts`를 함께 본다.

## 검증
- `pnpm check:local`: 저장소 파일 변경 뒤 가장 먼저 보는 기본 기준선이다.
- `pnpm quality:report`: parser/sample knowledge projection과 generated 품질 보고서를 다시 만들 때 실행한다.
- 수정한 링크와 코드 기준점 수동 spot-check: knowledge 문서를 바꾼 뒤 라우팅과 앵커가 여전히 맞는지 확인할 때 실행한다.
- verification bundle 구성은 `.agents/knowledge/engineering/validation.md`, `package.json`만 기준으로 본다.

## 우선순위
1. 사용자 지시와 루트 `AGENTS.md`
2. 실제 코드, 설정, 스크립트, 테스트
3. 이 knowledge 문서
4. `.agents/knowledge/reference/`, `README.md`, `.agents/plan/`
