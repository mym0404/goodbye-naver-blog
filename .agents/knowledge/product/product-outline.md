# Product Outline

## 목적
사용자 흐름, 출력 규약, frontmatter 제약, 검증 hook을 제품 관점에서 요약한다.

## Source Of Truth
- 실제 흐름과 출력 동작은 server, exporter, renderer, React UI 구현이 기준이다.

## 관련 코드
- `src/server/http-server.ts`
- `src/modules/converter/markdown-renderer.ts`
- `src/ui/App.tsx`

## 검증 방법
- `pnpm smoke:ui`: scan, export, upload, 복구 Dialog와 마지막 단계 복귀까지 사용자 흐름을 다시 확인할 때 실행한다.
- `pnpm samples:verify`: renderer나 exporter 출력 규약이 저장된 sample fixture 회귀와 계속 맞는지 확인할 때 실행한다.

## User Flow
1. 사용자가 블로그 ID 또는 URL을 입력한다.
2. scan으로 전체 공개 글 수, 카테고리 목록, 공개 글 메타데이터를 함께 확보한다.
3. 카테고리 범위와 export 옵션을 조정한다.
4. 카테고리 스냅샷과 마지막 output 경로, export option 같은 영속 로컬 상태는 `.cache/` 아래 파일로 유지한다.
5. exporter가 scan snapshot을 재사용해 대상 글을 정하고, 제한된 동시성으로 공개 글 본문을 수집하면서도 결과 반영 순서는 원래 글 순서대로 유지해 Markdown, 자산, `manifest.json`을 생성한다.
6. UI는 job status, summary, logs, 완료 파일 표, warning/error 필터, upload 상태 확인 흐름을 제공하고, 첫 로드에서는 마지막 `outputDir`의 `manifest.json`으로 이전 작업을 복구할 수 있다.

## Output Rules
- 기본 출력은 `GFM + YAML frontmatter + output/public 로컬 이미지 자산`이다.
- 본문 이미지는 옵션에 따라 로컬 파일 경로 또는 원본 URL로 렌더링할 수 있다.
- 네이버 스티커는 기본적으로 무시하고, 필요할 때만 원본 자산 URL로 내려받는다.
- 파일 구조 기본값은 category path 기반 폴더다.
- 기본 글 폴더명은 `YYYY-MM-DD-snake_case_slug`이고 Markdown 본문 파일은 그 안의 `index.md`다.
- 필요하면 구조 설정에서 변수 템플릿으로 글 폴더 이름을 직접 조합할 수 있다.
- 다운로드 자산은 글 폴더 밖 `output/public/<sha256>.<ext>`에 모으고, 같은 바이트의 파일은 하나만 재사용한다.
- `manifest.json`은 최종 결과 파일이면서 동시에 복구용 SoT다. export 중간 상태, upload 중간 상태, 완료 상태를 같은 파일 안에서 읽고 다시 띄운다.
- 같은 자산 URL을 여러 글이 동시에 참조해도 in-flight cache로 중복 다운로드를 피한다.
- 네이버 미리보기형 media/link card와 video는 일반 Markdown 링크로 export한다.
- 본문 `<br>` 줄바꿈은 Markdown hard break로 유지해 미리보기와 실제 렌더에서 줄이 붙지 않게 한다.
- table은 단순 표는 GFM, 복잡한 표는 HTML fallback을 사용한다.
- raw HTML fallback은 경고 callout과 추출 텍스트를 함께 남기는 방향을 기본값으로 둔다.

## Frontmatter Rules
- `category`는 이름 문자열, `categoryPath`는 경로 배열로 별도 기록한다.
- 각 field는 UI에서 toggle, 설명, alias 입력을 함께 보여준다.
- alias가 비어 있으면 기본 field 이름을 쓴다.
- alias는 영문자 또는 `_`로 시작하고 이후 영문자, 숫자, `-`, `_`만 허용한다.
- 활성화된 field끼리 같은 alias를 쓰면 export를 시작하지 않는다.

## Verification Hooks
- 단건 구조 확인은 `scripts/export-single-post.ts`
- 사용자 흐름 확인은 `pnpm smoke:ui`
- parser/sample fixture 현실 확인은 `pnpm samples:verify`
- coverage gate 확인은 `pnpm test:coverage`
