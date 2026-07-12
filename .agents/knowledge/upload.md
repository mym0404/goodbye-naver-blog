# Upload And Resume

## Upload Flow
- Export discovers local asset candidates while rendering posts.
- `download-and-upload` adds an upload provider setup step before export starts.
- Upload provider metadata comes from the server runtime catalog.
- The provider setup step can run a test upload through `POST /api/upload-providers/test`.
- Export requests in `download-and-upload` mode must include provider settings.
- Export rejects provider settings for non-upload asset modes.
- The server keeps provider credentials out of stored job state, polling payloads, and manifests.
- After export writes local assets, the server automatically runs upload, optional image preprocessing, Markdown URL rewrite, and manifest update inside the export job.
- Upload progress tracks candidate counts, uploaded counts, failures, rewrite status, and final terminal state.

## Resume Flow
- Manifest and local state are the source of truth for resumable jobs.
- Bootstrap can restore a running, upload-ready, uploading, failed-upload, or completed result state without requiring provider credentials.
- Resume summaries must contain enough information for the web UI to show the right step and dialog.
- Resumed upload-ready, uploading, or failed-upload jobs show existing progress state and do not start upload requests by themselves.

## Boundaries
- Domain schema files define shared job/upload/manifest contracts.
- Engine owns asset records, upload candidate dedupe, upload phase execution, and Markdown rewrite.
- Output adapters format only the document reference. Upload candidates keep output-root-relative local paths so upload and rewrite remain profile-neutral.
- Fumadocs and Nextra local assets live under output-root `public/`; Docusaurus local assets live under `static/`. MDX adapters render local assets as public-root URLs. Fumadocs remote image templates use `unoptimized`, and Nextra remote image templates use raw `img` elements, so copied bundles do not require Next image-domain configuration.
- Server owns runtime upload provider catalog, provider test upload, export request validation, and automatic upload orchestration.
- Web owns provider setup form state, field rules, test upload action, export payload assembly, and progress display.

## Verification
- Upload or resume contract changes require server/job tests, web hook tests, and `build:ui` followed by `check:playwright`.
- Local e2e proves provider setup, test upload, export payload shape, automatic upload progress, result-screen uploaded links, manifest URL replacement, and absence of manual upload POSTs.
- Live upload Playwright e2e is the bundled proof for external upload state, Markdown rewrite, provider metadata use, and credential non-leakage.
