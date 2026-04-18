# Knowledge Home

## 시작점
- 스택, 검증 명령, 구현 규칙: [engineering/index.md](./engineering/index.md)
- 모듈 경계, 파이프라인, parser 지원 범위: [architecture/index.md](./architecture/index.md)
- 도메인 제약, 사용자 흐름, UI 규약: [product/index.md](./product/index.md)

## 문서 지도
- `.agents/knowledge/`: 반복해서 참조해야 하는 evergreen 저장소 지식
- `docs/runbooks/`: 브라우저 검증, 단건 검증 같은 운영 절차
- `docs/generated/`: harness가 다시 만드는 품질 보고서와 UI 스크린샷
- `docs/plans/active/`: 진행 중 작업 메모
- `README.md`, `CONTRIBUTING.md`: 사용자와 기여자용 진입 문서

## 대표 코드 기준점
- 저장소 명령과 검증 루프: [../../package.json](../../package.json)
- parser 지원 범위: [../../src/shared/parser-capabilities.ts](../../src/shared/parser-capabilities.ts)
- 실샘플 기준: [../../src/shared/sample-corpus.ts](../../src/shared/sample-corpus.ts)
- export/upload API 흐름: [../../src/server/http-server.ts](../../src/server/http-server.ts)
- export 파이프라인: [../../src/modules/exporter/naver-blog-exporter.ts](../../src/modules/exporter/naver-blog-exporter.ts)

## 먼저 봐야 하는 seam
- parser block 지원 범위나 fallback 정책을 바꾸면 `src/shared/parser-capabilities.ts`와 [architecture/parser-block-catalog.md](./architecture/parser-block-catalog.md)를 함께 본다.
- sample 추가나 교체는 `src/shared/sample-corpus.ts`와 [product/sample-corpus.md](./product/sample-corpus.md)를 함께 본다.
- export 후 upload 상태 전이나 결과 패널을 바꾸면 [product/domain.md](./product/domain.md), [product/product-outline.md](./product/product-outline.md), `src/server/http-server.ts`를 함께 본다.

## 검증
- `pnpm quality:report`: parser capability나 sample corpus 변경으로 generated 품질 보고서가 달라질 때 실행한다.
- 수정한 링크와 코드 기준점 수동 spot-check: knowledge 문서를 바꾼 뒤 라우팅과 앵커가 여전히 맞는지 확인할 때 실행한다.

## 우선순위
1. 사용자 지시와 루트 [../../AGENTS.md](../../AGENTS.md)
2. 실제 코드, 설정, 스크립트, 테스트
3. 이 knowledge 문서
4. `docs/` 아래 runbook, 계획, generated 산출물
