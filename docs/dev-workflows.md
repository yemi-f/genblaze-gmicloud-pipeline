<!-- last_verified: 2026-04-22 -->
# Dev Workflows

Engineering workflows for genblaze-gmicloud-pipeline.

## Setup

```bash
# Credentials — single .env at the project root drives both services
cp .env.example .env  # fill in credentials

# Backend
cd services/api
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Frontend
cd ../..
pnpm install
```

## Running locally

```bash
pnpm dev   # starts Next.js on :3000 and uvicorn on :8000 concurrently
```

## Running tests

```bash
pnpm test:api          # pytest (backend only, fast)
pnpm check:structure   # structural enforcement tests
pnpm lint              # Next.js ESLint
pnpm lint:api          # ruff check
pnpm lint && pnpm lint:api && pnpm test:api && pnpm check:structure  # full CI suite
```

## Adding a fourth video model

1. Add the slug to `DEFAULT_VIDEO_MODELS` in `app/types/runs.py`.
2. Bump `max_concurrency` to 4 in `build_video_fanout()` in `repo/pipelines.py`.
3. Add a fourth tile to `VideoFanout` in the frontend.
4. Update `docs/features/video-fanout.md`.

## Changing the image model

Pass `image_model="flux-kontext-pro"` in the `RunRequest`. No backend changes
needed — the model slug is a passthrough to GMICloudImageProvider.

## Enabling Object Lock

See `docs/features/manifest.md`.

## Enabling webhooks

Set `WEBHOOK_URL` and optionally `WEBHOOK_HEADER_AUTHORIZATION` in `.env`.

## Debugging step cache

The step cache lives at `STEP_CACHE_DIR` (default `./.cache/genblaze`). Delete
it to force a fresh GMICloud call for any prompt+seed combination.

## Layer discipline

The structural test `test_genblaze_only_in_repo` enforces that no genblaze import
exists outside `app/repo/pipelines.py`. `test_no_direct_boto3_anywhere` enforces
that no direct boto3/botocore import exists in the sample source. Fix violations
before merging.
