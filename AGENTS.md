<!-- last_verified: 2026-04-22 -->
# AGENTS.md — genblaze-gmicloud-pipeline

This is the authoritative control surface for all coding agents. Read this first.

## Layer discipline

```
types → config → repo → (service) → runtime
```

- **`app/repo/pipelines.py`** is the ONLY file allowed to import `genblaze_core`,
  `genblaze_gmicloud`, or `genblaze_s3`. All other layers talk to it through plain
  function calls.
- **No direct `boto3` or `botocore` import anywhere in the sample.** Storage is
  fully delegated to `genblaze-s3`. `boto3` is a transitive dep only.
- `service/` is intentionally thin. If a "service" call is a one-liner it belongs
  in `runtime/` directly.

## Environment standard (parent CLAUDE.md §3)

Only these env var names are used — no aliases:

```
B2_ENDPOINT, B2_REGION, B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME
GMI_API_KEY
STEP_CACHE_DIR, OTEL_ENDPOINT, WEBHOOK_URL, WEBHOOK_HEADER_AUTHORIZATION (optional)
```

Never `B2_S3_*`, never `B2_APPLICATION_KEY_ID`, never `AWS_*`.

## Genblaze API rules

- Always use the fluent `Pipeline(...).step(...).run()` / `.stream()` form.
  Do NOT use `RunBuilder` / `StepBuilder`.
- Fan-out = three sibling `.step()` calls with `input_from=0` and
  `Pipeline(..., max_concurrency=3)`. Do NOT use `PipelineTemplate`.
- Iteration via `Pipeline(...).from_result(prev).step(...)`. Do NOT
  invent `PipelineResult.from_result(...)` or a `run(from_result=...)` kwarg.
- Response bodies return Genblaze's own `Run` / `Step` / `Asset` Pydantic models
  directly. Do NOT mirror them into custom DTOs.

## Model slugs (canonical, case-sensitive)

| Model | Type |
|---|---|
| `Seedream-5.0-Lite` | Image |
| `FLUX-Kontext-Pro` | Image (reference) |
| `Kling-Image2Video-V2.1-Master` | Video |
| `Wan-2.6-I2V` | Video |
| `PixVerse-v5.6` | Video |

## Sizing targets

- `repo/pipelines.py`: ≤ 100 lines
- All `app/**/*.py` combined: ≤ 400 lines
- No single file > 300 lines

## Tests

- `test_structure.py` — enforces genblaze boundary + no-direct-boto3 + layer direction
- `test_pipelines.py` — builder logic, fan-out concurrency, input_from wiring
- `test_runs_runtime.py` — FastAPI endpoint stubs
- `test_health.py` — health + metrics endpoints

## Ethos

Write as little custom code as possible. Every place we can call a Genblaze
function directly, we do. If you find yourself writing a DTO, a wrapper function,
or an orchestration layer, check first whether `genblaze-core` already provides it.
