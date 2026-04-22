<!-- last_verified: 2026-04-22 -->
# Security

Security model for the genblaze-gmicloud-pipeline.

## Credentials

- `GMI_API_KEY`, `B2_KEY_ID`, and `B2_APPLICATION_KEY` are loaded exclusively via
  pydantic-settings from environment variables. They are never returned to the client
  and never appear in API responses, SSE streams, or manifests.
- `.env` is gitignored. `.env.example` ships placeholders only — no real values.
- The `genblaze-s3` library receives credentials via explicit kwargs
  (`key_id=settings.b2_key_id`, `app_key=settings.b2_application_key`) so the
  library's own env-variable fallback (`B2_APP_KEY`) never fires.

## Asset URL lifetime

- **Short-lived presigned URLs** — `backend.get_url(key, expires_in=600)` (10-minute
  default). Used by the UI to fetch thumbnails and play back video. Presigned URL
  generation happens server-side in `repo/pipelines.py::presign_asset_url()`; only
  the temporary URL is returned to the client, never the underlying B2 credentials.
- **Durable credential-free URLs** — `backend.get_durable_url(key)`. Written into
  `Manifest` asset records by `genblaze-s3`'s `AssetTransfer`. Safe to store and
  share; no embedded credentials, no expiry.

## CORS

CORS allowed origins are configured via the `API_CORS_ORIGINS` environment variable
(comma-separated list). The default restricts to `http://localhost:3000` in
development. Set this to your production frontend domain before deploying.

## Prompt injection

This sample does not execute model output as code. Prompt text is passed to GMICloud's
image/video models and the result is opaque media (image bytes, video bytes). There is
no eval path, no tool-calling surface, and no code generation.

## SSE endpoint security

The three SSE POST endpoints (`/runs/stream`, `/runs/{id}/iterate/stream`,
`/runs/{id}/approve/stream`) are stateless per-request streams — they carry no session
token or persistent auth. **For production deployments, add authentication middleware on
these endpoints** (e.g. a Bearer token checked in a FastAPI dependency) to prevent
unauthenticated users from triggering paid GMICloud API calls.

## Manifest integrity

- `genblaze-s3`'s `AssetTransfer` records a per-asset SHA-256 hash at upload time.
- `Manifest.verify()` recomputes the canonical hash over the manifest's asset list and
  compares it to the stored `canonical_hash`. The UI's **Verify** button calls this
  via the `/runs/{run_id}/manifest` endpoint; a mismatch indicates tampering or
  corruption.

## Object Lock

Object Lock is **off by default**. Enabling it requires a B2 bucket configured with
Object Lock and passing `manifest_lock=ObjectLockConfig(...)` to `ObjectStorageSink`.
See `docs/features/manifest.md` for the one-line change. When enabled, manifests
become immutable for the configured retention period — protect against post-generation
deletion of provenance records.

## Agent Security Rules

- Never commit `.env`, credentials, or API keys.
- Never weaken CORS, auth, or input validation without explicit instruction.
- `GMI_API_KEY` and B2 credentials must never appear outside server-side config.
