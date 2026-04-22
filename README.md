<!-- last_verified: 2026-04-22 -->
# Genblaze x GMICloud Generative Pipeline

One prompt turns into an anchor image, iterated to your liking, then fanned out
concurrently to three GMICloud video models — all persisted to Backblaze B2 with
a SHA-256-verified manifest. Under 100 lines of Genblaze-specific glue code.

```
prompt → Seedream-5.0-Lite → (iterate / refine) → Approve
    ↓                                                ↓
                         ┌─── Kling-Image2Video-V2.1-Master ─┐
                         ├─── Wan-2.6-I2V ────────────────────┤  → manifest.json (B2)
                         └─── PixVerse-v5.6 ─────────────────┘
```

## Stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 16 + React 19 + shadcn/ui |
| Backend | FastAPI + Genblaze Core |
| Image models | GMICloud via `genblaze-gmicloud` |
| Video models | GMICloud via `genblaze-gmicloud` |
| Storage | Backblaze B2 via `genblaze-s3` |

## Run it in 5 minutes

```bash
git clone https://github.com/backblaze-b2-samples/genblaze-gmicloud-pipeline
cd genblaze-gmicloud-pipeline

# Backend
cp services/api/.env.example services/api/.env
# Fill in B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_REGION, GMI_API_KEY
cd services/api && python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Frontend + start both
cd ../..
pnpm install
pnpm dev
# → http://localhost:3000  (UI)  http://localhost:8000/docs  (API)
```

## Environment variables

```
# Backblaze B2
B2_ENDPOINT=https://s3.<region>.backblazeb2.com
B2_REGION=<region>           # e.g. us-west-004
B2_KEY_ID=
B2_APPLICATION_KEY=
B2_BUCKET_NAME=

# GMICloud (https://gmicloud.ai/)
GMI_API_KEY=

# Optional
STEP_CACHE_DIR=./.cache/genblaze   # skip GMI calls for same prompt+seed
OTEL_ENDPOINT=                      # OpenTelemetry collector endpoint
WEBHOOK_URL=                        # POST completion events here
WEBHOOK_HEADER_AUTHORIZATION=       # Bearer token for webhook
```

## Model catalog

| Model slug | Type | Notes |
|---|---|---|
| `Seedream-5.0-Lite` | Image | Default anchor model |
| `FLUX-Kontext-Pro` | Image | Image-as-reference refine flow |
| `Kling-Image2Video-V2.1-Master` | Video | Fan-out slot 1 |
| `Wan-2.6-I2V` | Video | Fan-out slot 2 |
| `PixVerse-v5.6` | Video | Fan-out slot 3 |

Slugs are hyphenated and case-sensitive exactly as GMICloud expects.

## Architecture in one paragraph

All Genblaze imports live in `services/api/app/repo/pipelines.py` (≤ 100 lines).
Three builder functions (`build_image_pipeline`, `build_iteration_pipeline`,
`build_video_fanout`) return configured `Pipeline` objects. The runtime layer
streams each pipeline via `pipeline.stream(sink=ObjectStorageSink(...))`, yielding
`StreamEvent` JSON lines as SSE. On completion the `PipelineResult` is cached
in-memory so the iterate/approve endpoints can fork from it. Assets and a
SHA-256-verified manifest land in B2 at `runs/{run_id}/…`.

See [ARCHITECTURE.md](ARCHITECTURE.md) for the full topology.

## Storage model

This sample has **no direct `boto3` import**. All storage is delegated to
`genblaze-s3.S3StorageBackend.for_backblaze(...)`, which:

- Sets `user_agent_extra="b2ai-genblaze/<version>"` on the internal boto3 client
  (B2-side traffic attribution is preserved).
- Per-sample identity rides in `Pipeline(name="genblaze-gmicloud-pipeline")`,
  written into every `Manifest` in B2 — a stronger provenance signal than a UA.

Credentials are passed explicitly via `key_id=settings.b2_key_id` and
`app_key=settings.b2_application_key` so the library's `B2_APP_KEY` env-var
fallback never fires and `.env.example` uses only the project-standard names.

## Checks

```bash
pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure
```

The structural tests enforce that `genblaze_*` imports appear only in
`app/repo/pipelines.py` and that `boto3`/`botocore` are never imported
directly anywhere in the sample source.

## Object Lock (doc-only)

To make manifests tamper-proof, enable Object Lock on your bucket and add one
line to `_sink()` in `repo/pipelines.py`:

```python
ObjectStorageSink(backend, prefix="runs",
                  manifest_lock=ObjectLockConfig(mode="COMPLIANCE", days=365))
```

## License

[MIT](LICENSE)
