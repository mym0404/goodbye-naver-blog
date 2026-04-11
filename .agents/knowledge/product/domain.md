# Domain

## 목적
네이버 블로그 export 문제 영역과 핵심 엔티티, 도메인 제약을 정리한다.

## Source Of Truth
- 실제 도메인 계약은 `src/shared/types.ts`, `src/shared/export-options.ts`, exporter/server/UI 구현이 기준이다.

## 관련 코드
- [../../../src/shared/types.ts](../../../src/shared/types.ts)
- [../../../src/shared/export-options.ts](../../../src/shared/export-options.ts)
- [../../../src/server/http-server.ts](../../../src/server/http-server.ts)

## 검증 방법
- `pnpm test`
- `pnpm smoke:ui`

## Problem Space
이 저장소는 공개 네이버 블로그 글을 다른 환경으로 옮기기 쉬운 Markdown 세트로 export하는 도구다. 대상은 블로그 전체 또는 선택 카테고리이며, 결과물에는 본문 Markdown, YAML frontmatter, 자산 파일, `manifest.json`이 포함된다.

## Core Entities
- `blogIdOrUrl`: scan과 export의 시작점
- `CategoryInfo`: 카테고리 계층, path, post count를 포함하는 선택 단위
- `ScanResult`: 전체 공개 글 수, 카테고리 목록, UI 즉시 집계를 위한 post summary snapshot
- `ExportOptions`: scope, structure, frontmatter, markdown, assets 규칙
- `ParsedPost`: 공용 AST 블록, 태그, 비디오, 경고를 가진 파싱 결과
- `ExportManifest`: 전체 작업 결과와 post별 성공/실패를 기록하는 요약

## Domain Constraints
- 공개 글만 대상으로 한다.
- category path와 post 메타데이터는 export 구조와 frontmatter에 같이 영향을 준다.
- SE2, SE3, SE4 글을 공용 AST로 맞춘 뒤 Markdown으로 렌더링한다.
- frontmatter는 field on/off와 alias를 같이 조절할 수 있고, 활성 field끼리 alias 충돌이 나면 export를 막는다.
