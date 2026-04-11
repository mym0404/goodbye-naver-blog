# Docs Index

## 목적
이 문서는 사용자 문서, runbook, generated 보고서를 빠르게 찾도록 돕는 `docs/` 인덱스다.

## Source Of Truth
- evergreen agent knowledge의 system of record는 `.agents/knowledge/`다.
- `docs/`는 사용자 문서, 검증 절차, 참고 자료, generated 산출물을 담는다.
- 코드 계약은 `src/shared/*`, `scripts/harness/*`, `src/modules/*`, `src/server/*`, `src/ui/*`, 루트 `index.html`을 기준으로 확인한다.

## 관련 코드
- [../AGENTS.md](../AGENTS.md)
- [../.agents/knowledge/index.md](../.agents/knowledge/index.md)
- [../src/shared/parser-capabilities.ts](../src/shared/parser-capabilities.ts)
- [../src/shared/sample-corpus.ts](../src/shared/sample-corpus.ts)

## 검증 방법
- `pnpm quality:report`
- 수정한 링크와 코드 기준점을 수동으로 확인

## Read First
1. [../.agents/knowledge/index.md](../.agents/knowledge/index.md)
2. [runbooks/browser-verification.md](./runbooks/browser-verification.md)
3. [runbooks/single-post-verification.md](./runbooks/single-post-verification.md)
4. [plans/README.md](./plans/README.md)
5. [generated/quality-score.md](./generated/quality-score.md)

## User Docs
- [runbooks/browser-verification.md](./runbooks/browser-verification.md)
- [runbooks/single-post-verification.md](./runbooks/single-post-verification.md)
- [plans/active/2026-04-11-export-options-job-filetree-coverage.md](./plans/active/2026-04-11-export-options-job-filetree-coverage.md)
- [plans/active/2026-04-11-react-shadcn-dashboard-migration.md](./plans/active/2026-04-11-react-shadcn-dashboard-migration.md)

## Reference And History
- [naver-blog-300-audit-progress.md](./naver-blog-300-audit-progress.md)
- [plans/README.md](./plans/README.md)

## Generated Reports
- [generated/quality-score.md](./generated/quality-score.md)
- [generated/sample-coverage.md](./generated/sample-coverage.md)
