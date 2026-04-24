# Single Post Verification Runbook

## 목적
공개 네이버 블로그 글 1건을 브라우저로 확인한 직후 같은 글을 단건 CLI로 변환하고, 결과를 같은 작업의 검증 메모에 남긴다.

## Source Of Truth
단건 변환은 `scripts/export-single-post.ts`와 `src/modules/exporter/single-post-export.ts`의 동일한 Markdown/export option 규약을 따른다.

## 관련 코드
- `scripts/export-single-post.ts`
- `scripts/lib/single-post-cli.ts`
- `src/modules/exporter/single-post-export.ts`

## 검증 방법
이 예시는 `blogId`, `logNo`, `outputDir`, `report`, `manualReviewMarkdownPath`, `metadataCachePath` 경로를 1건 분량으로 보여주는 기준값이다. 같은 블로그를 반복 검증할 때는 `metadataCachePath`를 재사용한다.

```bash
pnpm exec tsx scripts/export-single-post.ts \
  --blogId mym0404 \
  --logNo 223034929697 \
  --outputDir tmp/manual-audit/223034929697/output \
  --report tmp/manual-audit/223034929697/report.json \
  --manualReviewMarkdownPath tmp/manual-audit/223034929697/post.md \
  --metadataCachePath tmp/manual-audit/223034929697/metadata-cache.json
```

## Manual Loop
1. `mkdir -p tmp/manual-audit/223034929697`로 출력 디렉터리를 만든다.
2. `browser-use open https://blog.naver.com/mym0404/223034929697`로 공개 글을 연다.
3. 본문 구조, editor version, 눈에 보이는 block type, 예외 여부를 기록한다.
4. 위 command로 `post.md`, `report.json`, `metadata-cache.json`을 생성한다.
5. 브라우저에서 본 구조와 `post.md`, `report.json`을 비교한다.
6. 현재 작업 메모나 검증 로그에 결과를 남긴다.

## What To Record
- `status`: `candidate`, `reviewed`, `excluded-inaccessible`, `excluded-duplicate`, `followup-needed`
- `observedBlocks`: 재집계 가능한 짧은 정규화 값
- `markdownResult`: `as-expected`, `mismatch`, `error`, `not-checked`
- `suspectedIssues`: parser, renderer, option, verification 관점의 짧은 근거
- `followUp`: `parse-edge`, `render-edge`, `option-gap`, `test-gap`, `none`
