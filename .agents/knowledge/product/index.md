# Product Knowledge

## 목적
도메인 개념, 사용자 흐름, 샘플 corpus, UI 디자인 시스템처럼 제품 이해에 필요한 지식을 라우팅한다.

## Source Of Truth
- 제품 지식은 이 디렉터리와 실제 server, exporter, React UI 구현이 기준이다.

## 관련 코드
- [../../../src/server/http-server.ts](../../../src/server/http-server.ts)
- [../../../src/modules/exporter/naver-blog-exporter.ts](../../../src/modules/exporter/naver-blog-exporter.ts)
- [../../../src/ui/App.tsx](../../../src/ui/App.tsx)

## 검증 방법
- `pnpm smoke:ui`: scan, category 선택, export, upload 결과 화면까지 사용자 흐름을 다시 확인할 때 실행한다.
- `pnpm quality:report`: sample coverage나 generated 품질 보고서가 제품 문맥에 영향을 줄 수 있을 때 실행한다.

## Read This When
- 네이버 블로그 export가 어떤 문제를 푸는지 이해해야 할 때
- UI와 API의 사용자 흐름, 출력 규약, manifest 의미를 확인해야 할 때
- frontmatter, Markdown, 자산, 카테고리 선택의 제품 제약을 봐야 할 때

## Documents
- [domain.md](./domain.md): 네이버 블로그 export 도메인과 핵심 개념
- [product-outline.md](./product-outline.md): 사용자 흐름, 출력 규약, 주요 제약
- [sample-corpus.md](./sample-corpus.md): 실샘플 검증 대상과 선택 규칙
- [ui-dashboard-design-system.md](./ui-dashboard-design-system.md): React 대시보드의 시각 시스템
