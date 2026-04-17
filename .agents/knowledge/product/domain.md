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
- `pnpm check:local`: shared 타입, export 옵션, 서버 계약 같은 도메인 규칙을 바꾼 뒤 기본 회귀를 확인할 때 실행한다.
- `pnpm smoke:ui`: scan/export/upload 상태 전이와 사용자 흐름까지 바뀌었는지 확인할 때 실행한다.

## Problem Space
이 저장소는 공개 네이버 블로그 글을 다른 환경으로 옮기기 쉬운 Markdown 세트로 export하는 도구다. 대상은 블로그 전체 또는 선택 카테고리이며, 결과물에는 본문 Markdown, YAML frontmatter, 자산 파일, `manifest.json`이 포함된다.

## Core Entities
- `blogIdOrUrl`: scan과 export의 시작점
- `CategoryInfo`: 카테고리 계층, path, post count를 포함하는 선택 단위
- `ScanResult`: 전체 공개 글 수, 카테고리 목록, UI 즉시 집계를 위한 post summary snapshot
- `ExportOptions`: scope, structure, frontmatter, markdown, assets 규칙
- `ParsedPost`: 공용 AST 블록, 태그, 비디오, 경고를 가진 파싱 결과
- `UploadCandidate`: 로컬로 저장된 이미지/썸네일이 PicGo 업로드 단계로 넘어갈 때 쓰는 자산 단위
- `PostUploadSummary`: 글별 업로드 대상 수, 완료 수, 실패 수, candidate 목록을 가진 결과 묶음
- `ExportManifest`: 전체 작업 결과와 post별 성공/실패, 업로드 요약을 기록하는 최종 묶음
- `ExportJobState`: export 단계와 upload 단계를 같은 job 안에서 이어서 보여 주는 UI/API 상태

## Domain Constraints
- 공개 글만 대상으로 한다.
- category path와 post 메타데이터는 export 구조와 frontmatter에 같이 영향을 준다.
- SE2, SE3, SE4 글을 공용 AST로 맞춘 뒤 Markdown으로 렌더링한다.
- frontmatter는 field on/off와 alias를 같이 조절할 수 있고, 활성 field끼리 alias 충돌이 나면 export를 막는다.
- 출력 파일은 글마다 독립 폴더를 만들고 Markdown 본문은 항상 그 안의 `index.md`에 쓴다.
- `structure.groupByCategory`, `includeDateInPostFolderName`, `includeLogNoInPostFolderName` 조합으로 글 폴더 경로가 결정되고, 기본값은 날짜 + slug다.
- 이미지 처리 방식은 `download`, `remote`, `download-and-upload` 세 가지다.
- `download-and-upload`는 export를 먼저 끝낸 뒤 같은 job을 `upload-ready -> uploading -> upload-completed | upload-failed`로 진행한다.
- post-export 업로드 입력은 export 옵션에 저장하지 않고 결과 패널에서만 `providerKey + providerFields` 형태로 받는다.
- 업로드 대상이 하나도 없으면 `download-and-upload`여도 upload 단계로 넘어가지 않고 `completed + skipped-no-candidates`로 닫힌다.
- `imageContentMode === base64`는 업로드 모드와 양립하지 않으므로 로컬 다운로드 기반 경로만 허용한다.
