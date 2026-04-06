# farewell-naver-blog

네이버 블로그에 남은 글을 다시 검색되고, 옮겨지고, 오래 보존되는 Markdown 자산으로 되돌리는 로컬 exporter.

공개 글 스캔 · 카테고리 선택 export · GFM + YAML frontmatter · 로컬 asset 저장 · manifest 기록

## 왜 이 프로젝트가 태어났나

네이버 블로그에 글은 쌓여 있는데, 시간이 갈수록 내 글은 점점 덜 검색되고, 화면은 광고와 스팸에 더 시달리고, 에디터는 오래 붙잡고 있기 힘듭니다.

이 프로젝트는 그 좌절에서 시작했습니다.

- 내 글을 플랫폼 안에 가둔 채 두고 싶지 않을 때
- SEO가 답답해서 검색 가능한 형태로 다시 정리하고 싶을 때
- 광고와 스팸에 덮이기 전에 글을 내 자산으로 회수하고 싶을 때
- 구시대적인 에디터 대신 더 오래 가는 포맷으로 옮기고 싶을 때

`farewell-naver-blog`는 네이버 블로그의 공개 글을 읽어 와서, 카테고리 구조와 출력 규칙을 유지한 채 Markdown 아카이브로 내보냅니다. 글만 빼오는 수준이 아니라, SE2, SE3, SE4 본문을 공용 AST로 파싱하고, GFM, frontmatter, 로컬 asset 구조, `manifest.json`까지 함께 남깁니다.

## 무엇이 유용한가

- 블로그 ID 또는 URL만으로 공개 글과 카테고리를 스캔할 수 있습니다.
- 카테고리 단위로 export하고 하위 카테고리 포함 여부를 고를 수 있습니다.
- 날짜 범위, 폴더 구조, 파일명 규칙, frontmatter 필드, Markdown 렌더링 규칙을 조절할 수 있습니다.
- 이미지와 썸네일을 내려받아 상대 경로 asset으로 정리할 수 있습니다.
- 결과와 경고를 `manifest.json`에 남겨서 어떤 글이 어떻게 export됐는지 추적할 수 있습니다.

결과적으로 이 도구는 "네이버 블로그를 계속 더 잘 쓰게 해주는 도구"라기보다, "거기 남아 있는 글을 더 검색 가능하고, 더 이식 가능하고, 더 오래 보존 가능한 형태로 꺼내오는 도구"에 가깝습니다.

## 한눈에 보기

블로그를 스캔하고, 카테고리와 규칙을 고른 뒤, Markdown과 asset, manifest를 한 번에 생성합니다.

## 빠른 시작

### 요구 사항

- Node.js 20+
- pnpm

### 설치

```bash
pnpm install
```

### 실행

```bash
pnpm start
```

브라우저에서 `http://localhost:4173`을 열면 로컬 UI를 사용할 수 있습니다.

## 사용 흐름

1. 블로그 ID 또는 네이버 블로그 URL을 입력합니다.
2. `Scan Categories`로 공개 글 수와 카테고리 목록을 가져옵니다.
3. export 대상 카테고리와 옵션을 선택합니다.
4. 출력 디렉터리를 정한 뒤 export를 실행합니다.
5. 진행 로그와 완료 상태를 확인하고 `manifest.json` 결과를 검토합니다.

## 결과물은 이렇게 남습니다

- 출력 포맷: `GFM + YAML frontmatter + 로컬 이미지 자산`
- 기본 폴더 전략: 카테고리 경로 유지
- 기본 파일명: `YYYY-MM-DD-logNo-slug.md`
- 비디오는 기본적으로 썸네일과 원문 링크로 렌더링
- 단순 표는 GFM, 복잡한 표는 HTML fallback 사용
- raw HTML은 기본적으로 보존

```text
output/
  posts/
    category-a/
      2024-01-02-1234567890-post-title.md
  assets/
    1234567890/
      image-1.jpg
  manifest.json
```

## 핵심 특징

### 1. 네이버 블로그 현실을 전제로 만든 exporter

공개 글을 스캔하고, 카테고리와 날짜 범위를 기준으로 export 대상을 좁힐 수 있습니다. "전체를 무작정 긁어 온다"가 아니라, 실제 이관 작업에 맞는 범위를 정하고 시작할 수 있습니다.

### 2. editor 버전 차이를 한 번에 다룬다

SE2, SE3, SE4 본문을 공용 AST로 파싱한 뒤 렌더링합니다. 덕분에 글이 어떤 시기의 에디터로 작성됐든 같은 export 파이프라인으로 다룰 수 있습니다.

### 3. Markdown만이 아니라 자산 구조까지 정리한다

본문 이미지를 내려받고 상대 경로 asset으로 정리하며, frontmatter와 썸네일 정보까지 함께 남길 수 있습니다. 나중에 다른 정적 사이트, 문서 시스템, CMS로 옮기기 쉬운 형태를 목표로 합니다.

### 4. 결과를 추적할 수 있다

export 결과와 경고가 `manifest.json`에 기록됩니다. 어떤 글이 성공했고, 어떤 글이 실패했는지, 어떤 경고가 있었는지 나중에 다시 검토할 수 있습니다.

## 주요 옵션

### Scope

- 카테고리 정확 매칭 또는 하위 카테고리 포함
- 시작일과 종료일 필터

### Structure

- output 디렉터리 초기화 여부
- 글/자산 디렉터리 이름
- 카테고리 경로 유지 또는 flat 구조
- 날짜, `logNo`, slug 규칙

### Frontmatter

- frontmatter 사용 여부
- `title`, `source`, `publishedAt`, `categoryPath`, `warnings` 등 필드별 포함 여부

### Markdown Rules

- 링크 inline/reference
- 링크 카드, 수식, 표, 비디오, 이미지, divider, code fence 스타일
- raw HTML 보존 여부
- heading level offset

### Assets

- 상대 경로 또는 원격 URL 유지
- 본문 이미지 다운로드 여부
- 썸네일 다운로드 여부
- 이미지 캡션 포함 여부
- 썸네일 우선순위 선택

## API

- `GET /api/export-defaults`
- `POST /api/scan`
- `POST /api/export`
- `GET /api/export/:jobId`
- `GET /api/export/:jobId/manifest`

## 검증

문서만 변경했을 때:

```bash
pnpm quality:report
pnpm docs:check
```

빠른 확인:

```bash
pnpm check:quick
```

전체 검증:

```bash
pnpm check:full
```

## 프로젝트 구조

- `src/modules/blog-fetcher`: 네이버 블로그 스캔과 글/자산 fetch
- `src/modules/parser`: SE2, SE3, SE4 본문 파싱
- `src/modules/reviewer`: 파싱 경고 정리
- `src/modules/converter`: Markdown 및 frontmatter 렌더링
- `src/modules/exporter`: export workflow orchestration
- `src/server`: HTTP API와 job 상태 관리
- `src/static`: 로컬 웹 UI
- `src/shared`: 타입, 옵션, capability, 샘플 corpus

## 문서

- [docs/index.md](./docs/index.md)
- [docs/architecture.md](./docs/architecture.md)
- [docs/export-spec.md](./docs/export-spec.md)
- [docs/validation-harness.md](./docs/validation-harness.md)
- [docs/parser-block-catalog.md](./docs/parser-block-catalog.md)
- [docs/samples/index.md](./docs/samples/index.md)
