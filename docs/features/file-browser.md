<!-- last_verified: 2026-04-23 -->
# Feature: File Browser

## Purpose
Give operators a tree view of the B2 bucket so they can verify which manifests
and assets landed there after each pipeline run.

## Used By
- UI: `/files` — tree + preview modal (dispatches to image / video / JSON viewer) + delete confirm
- API: `GET /files`, `GET /files/{key}/preview`, `GET /files/{key}/content`, `DELETE /files/{key}`

## Core Functions
- `app.runtime.files` — FastAPI router (list / preview URL / content proxy / delete)
- `app.repo.pipelines.list_assets` / `delete_asset` / `fetch_manifest_bytes` — storage accessors
- `apps/web/src/components/files/file-browser.tsx` — tree + actions
- `apps/web/src/lib/file-tree.ts` — flat-list → nested tree
- `apps/web/src/components/files/file-preview.tsx` — dispatcher modal
- `apps/web/src/components/files/viewers/image-viewer.tsx` — checkerboard bg, fit/actual toggle
- `apps/web/src/components/files/viewers/video-viewer.tsx` — native controls, duration + dims readout
- `apps/web/src/components/files/viewers/json-viewer.tsx` — recursive tree, collapsible, manifest-aware

## Canonical Files
- Pattern exemplar: `services/api/app/runtime/files.py`
- Tree builder: `apps/web/src/lib/file-tree.ts`

## Inputs
- `prefix`: string (optional query, defaults to "")
- `limit`: int 1..1000 (optional query, default 200)
- `key`: URL path (for preview + delete)

## Outputs
- `FileEntry[]` — key, filename, folder, size_bytes, size_human, content_type, uploaded_at
- `{ url }` — short-lived presigned preview URL
- `{ deleted, key }` — delete confirmation

## Flow
1. `/files` page loads → `listFiles()` calls `GET /files`
2. `buildFileTree` groups entries under folders; top-level folders auto-expand
3. Preview opens a modal that fetches a short-lived presigned URL from `GET /files/{key}/preview`
4. Modal routes to a per-type viewer: image viewer, video player, or JSON tree
5. JSON viewer additionally fetches bytes via `GET /files/{key}/content` (server-proxied; capped at 5 MB) so CORS on the bucket doesn't matter
6. Download reuses the presigned URL and opens it in a new tab
7. Delete shows a confirm dialog before `DELETE /files/{key}`

## Edge Cases
- Empty bucket → EmptyState with a pointer to start a run
- Invalid or path-traversal key → 400 from runtime
- B2 list failure → 502 with `Storage list failed: <detail>`
- Delete failure → 500 with generic message (detail in server logs)
- JSON > 5 MB → 413 from `/content`; viewer surfaces the error message
- Malformed JSON → viewer falls back to a raw text preview with the parse error

## UX States
- Loading: six skeleton rows
- Empty: EmptyState with folder icon
- Error: sonner toast with the ApiError message

## Verification
- Test files: `services/api/tests/test_files_runtime.py`
- Required cases: list happy path, invalid limit, path traversal preview, delete
  success, delete storage error, content proxy happy path, content over 5 MB returns 413
- Quick verify command: `pnpm test:api`
- Full verify command: `pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure`
- Pass criteria: all tests pass, `/files` page renders the tree against a live bucket

## Related Docs
- [README.md](../../README.md)
- [ARCHITECTURE.md](../../ARCHITECTURE.md)
- [docs/app-workflows.md](../app-workflows.md)
