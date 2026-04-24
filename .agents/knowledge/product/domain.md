# Domain

## 목적
네이버 블로그 export 문제 영역과 핵심 엔티티, 도메인 제약을 정리한다.

## Source Of Truth
- 실제 도메인 계약은 `src/shared/types.ts`, `src/shared/export-options.ts`, exporter/server/UI 구현이 기준이다.

## 관련 코드
- `src/shared/types.ts`
- `src/shared/export-options.ts`
- `src/server/http-server.ts`

## 검증 방법
- `pnpm check:local`: shared 타입, export 옵션, 서버 계약 같은 도메인 규칙을 바꾼 뒤 기본 회귀를 확인할 때 실행한다.
- `pnpm smoke:ui`: scan/export/upload 상태 전이와 사용자 흐름까지 바뀌었는지 확인할 때 실행한다.

## Problem Space
이 저장소는 공개 네이버 블로그 글을 다른 환경으로 옮기기 쉬운 Markdown 세트로 export하는 도구다. 대상은 블로그 전체 또는 선택 카테고리이며, 결과물에는 본문 Markdown, YAML frontmatter, 자산 파일, 진행 상태까지 포함한 `manifest.json`이 포함된다.

## Core Entities
- `blogIdOrUrl`: scan과 export의 시작점
- `CategoryInfo`: 카테고리 계층, path, post count를 포함하는 선택 단위
- `ScanResult`: 전체 공개 글 수, 카테고리 목록, UI 즉시 집계를 위한 post summary snapshot
- `ExportOptions`: scope, structure, frontmatter, markdown, assets 규칙
- `ParsedPost`: 공용 AST 블록, 태그, 비디오, 경고를 가진 파싱 결과
- `UploadCandidate`: 로컬로 저장된 이미지/썸네일이 image upload 단계로 넘어갈 때 쓰는 자산 단위
- `PostUploadSummary`: 글별 업로드 대상 수, 완료 수, 실패 수, candidate 목록을 가진 결과 묶음
- `ExportManifest`: 전체 작업 결과와 post별 성공/실패, 업로드 요약, UI 복구용 job snapshot을 함께 기록하는 단일 묶음
- `ExportJobState`: export 단계와 upload 단계를 같은 job 안에서 이어서 보여 주는 UI/API 상태

## Domain Constraints
- 공개 글만 대상으로 한다.
- category path와 post 메타데이터는 export 구조와 frontmatter에 같이 영향을 준다.
- SE2, SE3, SE4 글을 공용 AST로 맞춘 뒤 Markdown으로 렌더링한다.
- frontmatter는 field on/off와 alias를 같이 조절할 수 있고, 활성 field끼리 alias 충돌이 나면 export를 막는다.
- 출력 파일은 글마다 독립 폴더를 만들고 Markdown 본문은 항상 그 안의 `index.md`에 쓴다.
- `structure.groupByCategory`, `includeDateInPostFolderName`, `includeLogNoInPostFolderName`, `slugStyle`, `slugWhitespace`, `postFolderNameMode`, `postFolderNameCustomTemplate` 조합으로 글 폴더 경로가 결정되고, 기본값은 날짜 + snake_case slug다.
- 다운로드 자산은 `output/public/<sha256>.<ext>` 단일 저장소에 쓴다.
- 같은 자산 여부는 원본 응답 바이트의 SHA-256 해시로 판단한다. URL이 달라도 바이트가 같으면 같은 파일을 재사용한다.
- 기본 이미지 처리 방식은 `download-and-upload`이고, 기본 로컬 압축은 켜져 있다.
- 이미지 처리 방식은 `download`, `remote`, `download-and-upload` 세 가지다.
- 다운로드 실패 처리는 `warn-and-use-source`, `warn-and-omit` 두 가지다.
- 업로드 provider catalog는 설치된 runtime uploader catalog를 영문 라벨 + 한국어 설명 중심으로 정규화한 결과를 따른다.
- 업로드 provider form은 field 설명을 기본으로 보여 주고, 명확한 의존 조건이 있는 field는 비활성화 이유까지 같이 노출한다.
- GitHub 이미지 업로드는 마지막 업로드 단계에서 `jsDelivr CDN 사용`을 켜면 `customUrl` 입력을 잠그고 `https://cdn.jsdelivr.net/gh/<repo>@<branch>` 기준 주소를 자동으로 사용한다. branch가 비어 있으면 `@<branch>`는 생략한다.
- 경고/실패 처리 옵션은 asset 전략과 분리된 마지막 `진단 설정` 단계에서 조정한다.
- 블로그 입력 단계의 `카테고리 불러오기`는 현재 블로그 ID 기준으로 카테고리 스냅샷을 재사용한다.
- 영속적인 UI 설정과 서버 캐시는 `.cache/` 아래에 저장한다.
- 카테고리 스캔 캐시는 서버 파일 `.cache/scan-cache.json`에 저장되어 새로고침 뒤에도 유지된다.
- 마지막 출력 디렉토리와 export option은 `.cache/export-ui-settings.json`의 `lastOutputDir`, `options`로 저장된다.
- `강제로 불러오기`는 같은 블로그 입력이어도 파일 캐시를 무효화하고 `/api/scan`을 다시 호출한다.
- `download-and-upload`는 export를 먼저 끝낸 뒤 같은 job을 `upload-ready -> uploading -> upload-completed | upload-failed`로 진행한다.
- 웹 UI 복구 기준은 마지막 `outputDir`의 `manifest.json` 하나다. 별도 `metadata.json`은 두지 않는다.
- `manifest.json.job`은 `request`, `status`, `phase`, `logs`, `progress`, `items`, `scanResult`, `summary`를 담고, 새로고침/서버 재시작 뒤 UI bootstrap이 이 값을 기준으로 마지막 단계를 복구한다.
- post-export 업로드 입력은 export 옵션에 저장하지 않고 결과 패널에서만 `providerKey + providerFields` 형태로 받는다.
- `providerFields` 값 타입은 문자열만이 아니라 `string | number | boolean` scalar union이다.
- job 단위 업로드 대상 수는 글별 참조 수 합계가 아니라 고유 `localPath` 수를 뜻한다.
- 실행 단계 progress bar는 `처리한 글 수 / 전체 글 수`를 기준으로 한다.
- 업로드 단계 progress bar는 `업로드된 고유 자산 수 / 전체 대상 자산 수`를 기준으로 한다.
- upload row 상태는 글 기준 `대기 / 부분 완료 / 완료 / 실패`만 사용한다.
- upload row 상태 표현은 통합 결과 표 안에서 soft badge로 유지한다. `대기`도 outline만 쓰지 않고 별도 soft 색을 준다.
- 글 row의 `완료`는 업로드 수만이 아니라 글 단위 rewrite 완료까지 포함해 판단한다.
- `upload-failed`가 되어도 이미 rewrite가 끝난 row는 `완료`를 유지하고, 미완료 row만 `실패`로 보인다.
- `uploading` 중에 `uploadedCount === candidateCount`가 먼저 될 수 있지만, 이때는 아직 남은 글 rewrite가 있을 수 있다.
- `upload-completed`로 넘어간 뒤에도 업로드 대상이 있었던 job은 결과 단계에서 마지막 upload progress와 row 상태를 계속 볼 수 있어야 한다.
- `running / upload / result` 단계는 분리된 row 표를 쓰지 않고 같은 결과 표에서 row 상태를 이어서 보여 준다.
- 업로드 대상이 하나도 없으면 `download-and-upload`여도 upload 단계로 넘어가지 않고 `completed + skipped-no-candidates`로 닫힌다.
