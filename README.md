# Goodbye Naver Blog

[![codecov](https://codecov.io/gh/mym0404/farewell-naver-blog/graph/badge.svg)](https://codecov.io/gh/mym0404/farewell-naver-blog)

네이버 블로그의 공개 글을 로컬에서 스캔하고, 오래 보관하고 옮겨 쓰기 쉬운 Markdown 자산으로 정리하는 exporter입니다.

`farewell-naver-blog`는 단순 HTML 덤프가 아니라, 공개 글을 읽어 공용 AST로 파싱한 뒤 Markdown 본문, YAML frontmatter, 로컬 자산, `manifest.json`까지 한 번에 만듭니다.

## 한눈에 보는 장점

- SE2, SE3, SE4 글을 공용 AST로 맞춰서 같은 파이프라인으로 export합니다.
- GFM Markdown과 YAML frontmatter를 함께 만들어서 정적 사이트, CMS, 노트 시스템으로 옮기기 쉽습니다.
- 이미지와 썸네일을 `output/public/<sha256>.<ext>` 형태로 저장하고, 같은 바이트의 파일은 재사용합니다.
- 카테고리 범위, 날짜 범위, 폴더 구조, slug 규칙을 조절할 수 있어서 전체 이전과 부분 이전 모두 잘 맞습니다.
- 결과 요약, 경고, 실패, 업로드 상태를 `manifest.json`에 남겨서 나중에 다시 추적하기 쉽습니다.
- 필요하면 export 뒤에 PicGo로 이미지를 업로드하고 Markdown 경로를 업로드 URL로 치환할 수 있습니다.
- 로컬 웹 UI가 있어서 복잡한 옵션도 단계별로 확인하면서 진행할 수 있습니다.

## 이런 상황에 잘 맞습니다

- 네이버 블로그 글을 내 자산으로 백업하고 싶을 때
- 정적 블로그, CMS, 문서 저장소로 옮길 Markdown 결과물이 필요할 때
- 카테고리 구조, 발행일, 원문 링크, 태그 같은 메타데이터도 같이 보존하고 싶을 때
- 전체 글이 아니라 특정 카테고리나 특정 기간만 골라서 export하고 싶을 때
- 이미지까지 정리된 형태로 가져오고 싶을 때

## 이 도구가 만드는 결과물

- Markdown 본문
- YAML frontmatter
- 이미지, 썸네일 같은 로컬 자산
- export 결과와 경고, 업로드 요약을 담은 `manifest.json`

기본 출력 구조 예시는 아래와 같습니다.

```text
output/
  개발/
    JavaScript/
      2024-01-02-hello-world/
        index.md
  public/
    2a4c...9f.png
  manifest.json
```

기본값은 카테고리 경로 유지, 글 폴더명 `YYYY-MM-DD-slug`, Markdown 파일명 `index.md`입니다.

## 어떻게 동작하나

1. 블로그 ID 또는 URL로 공개 글과 카테고리를 스캔합니다.
2. 카테고리 범위와 날짜 범위를 고릅니다.
3. exporter가 글을 순회하면서 본문을 파싱하고 Markdown으로 렌더링합니다.
4. 로컬 자산을 저장하고 `manifest.json`에 성공, 실패, 경고를 기록합니다.
5. 선택한 경우 같은 job에서 PicGo 업로드와 Markdown 경로 치환까지 이어집니다.

지원 범위는 공개 글만입니다.

## 빠른 시작

### 요구 사항

- Node.js 20+
- pnpm

### 설치와 실행

저장소를 clone한 뒤 바로 웹사이트처럼 실행할 수 있습니다.

```bash
git clone https://github.com/mym0404/farewell-naver-blog.git
cd farewell-naver-blog
pnpm install
pnpm start
```

`pnpm start`는 UI를 빌드한 뒤 서버를 띄우는 실행 명령입니다. 브라우저에서 [http://localhost:4173](http://localhost:4173) 을 열면 바로 사용할 수 있습니다.

처음 실행할 때 사용자는 보통 아래만 알면 충분합니다.

- 블로그 ID 또는 URL을 입력하고 공개 글을 스캔합니다.
- 내보낼 범위를 고른 뒤 export를 실행합니다.
- 결과는 `output/` 아래 Markdown, 자산 파일, `manifest.json`으로 저장됩니다.

## 업로드 모드

`download-and-upload`를 선택하면 export가 끝난 뒤 같은 job에서 업로드 단계로 이어집니다.

- 현재 UI에서 지원하는 업로드 대상: GitHub, Imgur
- 업로드 대상이 없으면 upload 단계로 넘어가지 않고 export만 완료됩니다.
- 업로드 입력은 결과 패널에서 별도로 받기 때문에 export 옵션과 섞이지 않습니다.
- 업로드가 끝나면 Markdown 안의 로컬 자산 경로를 업로드 URL로 치환합니다.

### 실업로드 e2e

`pnpm test:network:upload`는 opt-in Playwright e2e입니다. 업로드 대상은 항상 GitHub `mym0404/image-archive`, branch는 항상 `master`, path는 항상 `/`입니다. 루트 `.env`에서 `FAREWELL_UPLOAD_E2E=1`, `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`를 읽습니다.

`.env` 준비:

```bash
cp .env.example .env
```

`.env` 예시:

```bash
FAREWELL_UPLOAD_E2E=1
FAREWELL_UPLOAD_E2E_GITHUB_TOKEN=ghp_xxx
```

로컬 실행:

```bash
pnpm test:network:upload
```

이 명령은 브라우저에서 실제 UI로 scan, category/date scope 설정, export, upload를 수행하고, 업로드 뒤 공개 GitHub raw URL 이미지 렌더를 확인합니다. 같은 글을 같은 루트 경로로 다시 올리는 idempotent 재실행에서는 branch head가 안 바뀔 수 있고, 그 경우에는 기존 파일 존재 여부를 기준으로 검증합니다.

GitHub Actions 준비:

- Repository secret: `FAREWELL_UPLOAD_E2E_GITHUB_TOKEN`

현재 [required-checks.yml](./.github/workflows/required-checks.yml)에서는 실행 전에 `.env`를 만들고 `pnpm test:network:upload` Playwright e2e를 항상 실행합니다.

## 핵심 특징

### 1. 네이버 블로그 현실을 전제로 한 parser

SE2, SE3, SE4 본문을 공용 AST로 맞춘 뒤 렌더링합니다. 글이 어떤 시기의 에디터로 작성됐는지와 무관하게 같은 export 파이프라인으로 다룰 수 있습니다.

### 2. Markdown만이 아니라 자산 구조까지 정리

본문 이미지와 썸네일을 로컬 자산으로 저장하고, frontmatter와 결과 manifest까지 함께 남깁니다. 같은 바이트의 이미지는 URL이 달라도 하나의 파일만 재사용합니다.

### 3. 결과를 다시 검토하기 쉬움

성공, 실패, 경고, 업로드 상태를 `manifest.json`에 남깁니다. 어떤 글이 어떻게 처리됐는지 나중에 다시 확인할 수 있습니다.

### 4. 단계형 로컬 웹 UI

clone 후 `pnpm start`만으로 브라우저에서 바로 쓸 수 있는 로컬 웹 UI를 제공합니다.
