# farewell-naver-blog

[![codecov](https://codecov.io/gh/mym0404/farewell-naver-blog/graph/badge.svg)](https://codecov.io/gh/mym0404/farewell-naver-blog)

네이버 블로그의 공개 글을 내 컴퓨터로 가져와, 오래 보관하고 다른 곳으로 옮기기 쉬운 Markdown 자산으로 정리해 주는 로컬 exporter.

공개 글 스캔 · 카테고리별 export · GFM + YAML frontmatter · 로컬 asset 저장 · `manifest.json` 기록

## 이 프로젝트가 하는 일

네이버 블로그에 쌓인 글을 플랫폼 안에만 남겨 두지 않고, 다시 활용할 수 있는 형태로 꺼내옵니다.

이 도구는 공개 글을 읽어 와서 다음 결과물을 한 번에 만듭니다.

- Markdown 본문
- YAML frontmatter
- 이미지와 썸네일 같은 로컬 asset
- export 결과와 경고를 담은 `manifest.json`

즉, "네이버 블로그를 더 편하게 쓰는 도구"라기보다, "내 글을 다시 내 자산으로 되돌리는 도구"에 가깝습니다.

## 왜 이 프로젝트가 태어났나

글은 분명 내가 썼는데, 시간이 지나면 플랫폼 안에 갇혀 관리하기도, 검색되게 만들기도, 다른 곳으로 옮기기도 점점 어려워집니다.

이 프로젝트는 그런 상황에서 시작했습니다.

- 내 글을 플랫폼 안에 가둔 채 두고 싶지 않을 때
- SEO가 답답해서 검색 가능한 형태로 다시 정리하고 싶을 때
- 광고와 스팸에 덮이기 전에 글을 내 자산으로 회수하고 싶을 때
- 구시대적인 에디터 대신 더 오래 가는 포맷으로 옮기고 싶을 때

`farewell-naver-blog`는 네이버 블로그의 공개 글을 읽어 와서, 카테고리 구조와 출력 규칙을 최대한 유지한 채 Markdown 아카이브로 export 합니다. 단순 복사 수준이 아니라, SE2, SE3, SE4 본문을 공용 AST로 파싱하고, GFM, frontmatter, 로컬 asset 구조, `manifest.json`까지 함께 남깁니다.

## 이런 점이 편합니다

- 블로그 ID 또는 URL만으로 공개 글과 카테고리를 스캔할 수 있습니다.
- 카테고리 단위로 export하고 하위 카테고리 포함 여부를 고를 수 있습니다.
- 날짜 범위, 폴더 구조, 파일명 규칙, frontmatter 필드, Markdown 렌더링 규칙을 조절할 수 있습니다.
- 이미지와 썸네일을 내려받아 상대 경로 asset으로 정리할 수 있습니다.
- 결과와 경고를 `manifest.json`과 UI 완료 리스트에 남겨서 어떤 글이 어떻게 export됐는지 추적할 수 있습니다.

## 사용 대상

아래 같은 경우에 특히 잘 맞습니다.

- 네이버 블로그 글을 다른 정적 사이트, CMS, 문서 시스템으로 옮기려는 경우
- 예전 글을 백업해 두고 싶지만 HTML 덤프보다 Markdown 자산이 필요한 경우
- 카테고리 구조와 발행일, 원문 링크 같은 메타데이터를 함께 보존하고 싶은 경우
- 전체 글이 아니라 특정 카테고리나 기간만 골라서 정리하고 싶은 경우

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
pnpm dev
```

개발 중에는 위 명령으로 HMR 개발 서버를 띄웁니다.

```bash
pnpm start
```

빌드 결과를 기준으로 실행할 때는 `pnpm start`를 사용합니다.

브라우저에서 `http://localhost:4173`을 열면 로컬 UI가 뜹니다.

## 사용 방법

1. 블로그 ID 또는 네이버 블로그 URL을 입력합니다.
2. `Scan Categories`를 눌러 공개 글 수와 카테고리 목록을 불러옵니다.
3. 내보낼 카테고리와 날짜 범위를 고릅니다.
4. 출력 경로와 Markdown, frontmatter, asset 옵션을 정합니다.
5. export를 실행합니다.
6. 진행 로그와 완료 목록을 확인합니다.
7. 생성된 Markdown, asset, `manifest.json`을 검토합니다.

## 처음 쓸 때 가장 쉬운 흐름

복잡한 옵션을 바로 만질 필요는 없습니다. 처음에는 아래 순서로 써도 충분합니다.

1. 블로그를 스캔합니다.
2. 필요한 카테고리만 선택합니다.
3. 출력 경로를 기본값 `./output` 그대로 둡니다.
4. 그대로 export 합니다.
5. 생성된 `output/manifest.json`과 `output/posts/` 내용을 확인합니다.

## 결과물은 이렇게 남습니다

- 출력 포맷: `GFM + YAML frontmatter + 로컬 이미지 자산`
- 기본 폴더 전략: 카테고리 경로 유지
- 기본 글 폴더명: `YYYY-MM-DD-slug` (`index.md` 저장)
- 비디오는 기본적으로 썸네일과 원문 링크로 렌더링
- 단순 표는 GFM, 복잡한 표는 HTML fallback 사용
- raw HTML fallback은 기본적으로 경고와 함께 Markdown 텍스트로 최대한 복구

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

## 결과물을 어디에 쓸 수 있나

생성된 결과물은 다음 용도로 바로 활용할 수 있습니다.

- 정적 블로그 마이그레이션 준비
- 개인 문서 저장소 백업
- 다른 CMS나 노트 시스템으로 재정리
- LLM, 검색, 인덱싱용 원문 자산 보관

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
- 링크 카드, 표, 비디오, 이미지, divider, code fence 스타일
- LaTeX inline/block 렌더링 분리와 wrapper 문자열 설정
- raw HTML fallback 경고와 추출 텍스트 보존
- heading level offset

### Assets

- 상대 경로 또는 원격 URL 유지
- 본문 이미지 base64 data URL 임베딩 여부
- 네이버 스티커 무시 또는 원본 자산 다운로드
- 본문 이미지 다운로드 여부
- 썸네일 다운로드 여부
- 이미지 캡션 포함 여부
- 썸네일 우선순위 선택

## 작업 상태 확인

- 실행 중인 job은 진행 로그와 함께 완료된 파일 트리로 표시됩니다.
- 경고만, 에러만 필터링해서 볼 수 있습니다.
- 완료 항목을 누르면 Modal에서 Markdown 렌더링 결과를 바로 확인할 수 있습니다.

## API

- `GET /api/export-defaults`
- `POST /api/scan`
- `POST /api/export`
- `GET /api/export/:jobId`
- `GET /api/export/:jobId/manifest`

## 검증

문서만 변경했을 때:

수정한 링크와 코드 기준점을 수동으로 점검한 뒤, generated 리포트 축을 건드렸다면 아래 명령을 실행합니다.

```bash
pnpm quality:report
```

빠른 확인:

```bash
pnpm check:quick
```

coverage 확인:

```bash
pnpm test:coverage
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
- `src/ui`: React 로컬 웹 UI
- `src/shared`: 타입, 옵션, capability, 샘플 corpus

## 문서

- [docs/index.md](./docs/index.md)
- [.agents/knowledge/architecture/index.md](./.agents/knowledge/architecture/index.md)
- [.agents/knowledge/product/index.md](./.agents/knowledge/product/index.md)
- [.agents/knowledge/engineering/validation.md](./.agents/knowledge/engineering/validation.md)
- [.agents/knowledge/architecture/parser-block-catalog.md](./.agents/knowledge/architecture/parser-block-catalog.md)
- [.agents/knowledge/product/sample-corpus.md](./.agents/knowledge/product/sample-corpus.md)
