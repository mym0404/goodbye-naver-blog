# Product Knowledge

## 여기서 찾는 것
- 도메인 엔티티와 상태 전이: [domain.md](./domain.md)
- 사용자 흐름과 출력 규약: [product-outline.md](./product-outline.md)
- 실샘플 대표성과 선택 규칙: [sample-corpus.md](./sample-corpus.md)
- 대시보드 UI 규약과 회귀 기준: [ui-dashboard-design-system.md](./ui-dashboard-design-system.md)

## 대표 기준점
- scan/export/upload API: [../../../src/server/http-server.ts](../../../src/server/http-server.ts)
- export 파이프라인: [../../../src/modules/exporter/naver-blog-exporter.ts](../../../src/modules/exporter/naver-blog-exporter.ts)
- UI 셸과 단계 전환: [../../../src/ui/App.tsx](../../../src/ui/App.tsx)

## 언제 읽는가
- 네이버 블로그 export가 어떤 문제를 푸는지 이해해야 할 때
- UI와 API의 사용자 흐름, 출력 규약, manifest 의미를 확인해야 할 때
- frontmatter, Markdown, 자산, 카테고리 선택 제약을 확인해야 할 때

## 검증
- `pnpm smoke:ui`: scan, category 선택, export, upload 결과 화면까지 사용자 흐름을 다시 확인할 때 실행한다.
- `pnpm quality:report`: sample coverage나 generated 품질 보고서가 제품 문맥에 영향을 줄 수 있을 때 실행한다.
