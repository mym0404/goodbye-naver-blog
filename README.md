# Goodbye Naver Blog

[![codecov](https://codecov.io/gh/mym0404/farewell-naver-blog/graph/badge.svg)](https://codecov.io/gh/mym0404/farewell-naver-blog)

네이버 블로그 공개 글을 스캔해서 Markdown, frontmatter, 로컬 자산, `manifest.json`으로 export하는 도구입니다.

## 핵심

- `SE2`, `SE3`, `ONE(SE4)` 글을 한 번에 export할 수 있습니다.
- 여러 에디터에서 쓰는 본문 블록을 폭넓게 지원합니다.
- 이미지와 썸네일은 중복 저장을 줄이면서 정리합니다.
- 필요하면 export 뒤에 PicList runtime으로 이미지를 업로드하고 Markdown 경로를 바꿉니다.
- 로컬 웹 UI에서 범위 선택과 옵션 조절까지 바로 할 수 있습니다.

지원 범위는 공개 글만입니다.

## 빠른 시작

### 요구 사항

- Node.js `20+`
- pnpm

### 설치

```bash
git clone https://github.com/mym0404/farewell-naver-blog.git
cd farewell-naver-blog
pnpm install
git clone https://github.com/Kuingsmile/PicList.git ~/Downloads/PicList
```

### 실행

```bash
pnpm start
```

브라우저에서 [http://localhost:4173](http://localhost:4173) 을 열면 됩니다.

기본 흐름은 아래와 같습니다.

1. 블로그 ID 또는 URL 입력
2. 공개 글 스캔
3. 카테고리/날짜 범위 선택
4. export 실행
5. `output/` 아래 결과 확인

## 출력 예시

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

## 지원 블록

사용자 기준으로 `SE2 / SE3 / ONE(SE4)`를 지원합니다.

| 에디터 | 지원 블록 |
| --- | --- |
| `SE2` | `paragraph`, `heading`, `quote`, `divider`, `code`, `image`, `imageGroup`, `table`, `rawHtml` |
| `SE3` | `paragraph`, `quote`, `code`, `image`, `imageGroup`, `table` |
| `ONE(SE4)` | `paragraph`, `heading`, `quote`, `divider`, `code`, `formula`, `image`, `imageGroup`, `video`, `linkCard`, `table`, `rawHtml` |

지원 범위는 계속 넓혀 가는 중이며, 각 에디터의 대표 블록들을 같은 export 흐름으로 다룰 수 있게 유지합니다.

## 실제 예시

아래 예시는 `mym0404` 공개 글을 같은 구간으로 맞춰 캡처한 비교입니다.

<table>
  <thead>
    <tr>
      <th>기능</th>
      <th>네이버 블로그</th>
      <th>마크다운</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>SE2 이미지 묶음</td>
      <td><img src="docs/assets/readme/se2-image-group-blog.png" width="260" alt="SE2 이미지 묶음 네이버 블로그 예시"></td>
      <td><img src="docs/assets/readme/se2-image-group-markdown.png" width="260" alt="SE2 이미지 묶음 마크다운 예시"></td>
    </tr>
    <tr>
      <td>SE2 코드 블록</td>
      <td><img src="docs/assets/readme/se2-code-block-blog.png" width="260" alt="SE2 코드 블록 네이버 블로그 예시"></td>
      <td><img src="docs/assets/readme/se2-code-block-markdown.png" width="260" alt="SE2 코드 블록 마크다운 예시"></td>
    </tr>
    <tr>
      <td>SE3 일반 본문</td>
      <td><img src="docs/assets/readme/se3-paragraph-blog.png" width="260" alt="SE3 일반 본문 네이버 블로그 예시"></td>
      <td><img src="docs/assets/readme/se3-paragraph-markdown.png" width="260" alt="SE3 일반 본문 마크다운 예시"></td>
    </tr>
    <tr>
      <td>ONE 동영상 + 표</td>
      <td><img src="docs/assets/readme/se4-video-table-blog.png" width="260" alt="ONE 동영상과 표 네이버 블로그 예시"></td>
      <td><img src="docs/assets/readme/se4-video-table-markdown.png" width="260" alt="ONE 동영상과 표 마크다운 예시"></td>
    </tr>
  </tbody>
</table>

## 이미지 처리

- 본문 이미지와 썸네일을 함께 정리합니다.
- 같은 자산은 중복 저장과 중복 업로드를 줄이는 방식으로 처리합니다.
- 결과는 Markdown과 `manifest.json`에서 다시 추적할 수 있습니다.

## 옵션

UI에서 아래 5개 옵션 묶음을 조절할 수 있습니다.

- 범위 옵션: 카테고리, 날짜 범위
- 구조 옵션: 출력 폴더 구조, slug 규칙, 폴더명 규칙
- frontmatter 옵션: 메타데이터 포함 여부와 필드 선택
- Markdown 옵션: 링크, 표, 이미지, 구분선, 코드 블록 출력 방식
- 자산 옵션: 이미지 다운로드, 썸네일 처리, 압축, 캡션, 업로드 방식

## 검증

- `pnpm parser:check`: 지원 범위와 샘플 검증 계약 확인
- `pnpm samples:verify`: 저장된 대표 샘플 export 결과 회귀 확인
- `pnpm smoke:ui`: Playwright 기반 UI 흐름 확인
- `pnpm check:full`: 전체 기본 회귀 확인

## Upload Providers

- 업로드 모드는 export 뒤에 같은 job에서 이어집니다.
- 업로드 provider Source Of Truth는 `~/Downloads/PicList` clone입니다. 폴더명이 소문자면 `~/Downloads/piclist`도 fallback으로 읽습니다.
- 서버는 clone한 PicList가 runtime에 등록한 uploader 목록과 config schema를 읽어 `/api/upload-providers`로 노출합니다.
- UI는 provider를 하드코딩하지 않고 PicList catalog 기준 schema-driven 폼으로 렌더링합니다.
- GitHub를 고르면 `jsDelivr CDN 사용` 보조 UX를 계속 제공합니다.
- 업로드가 끝나면 Markdown 안의 로컬 자산 경로를 업로드 URL로 치환합니다.

실업로드 검증은 `pnpm test:network:upload`를 사용하며, 현재는 GitHub 경로만 검증합니다.
