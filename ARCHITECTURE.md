<!-- last_verified: 2026-04-22 -->
# Architecture — genblaze-gmicloud-pipeline

## Pipeline topology

```
POST /runs/stream
  └─ build_image_pipeline(RunRequest)
       └─ Pipeline("genblaze-gmicloud-pipeline", max_concurrency=1)
            .step(GMICloudImageProvider, model="Seedream-5.0-Lite", ...)
            .stream(sink=ObjectStorageSink)

POST /runs/{id}/iterate/stream
  └─ build_iteration_pipeline(IterateRequest, prev_result)
       └─ Pipeline(...).from_result(prev)
            .step(GMICloudImageProvider, ...)  ← text-only regen
            .step(..., input_from=0)           ← image-as-reference

POST /runs/{id}/approve/stream
  └─ build_video_fanout(ApproveRequest, approved_result)
       └─ Pipeline(..., max_concurrency=3).from_result(approved)
            .step(GMICloudVideoProvider, model="Kling-Image2Video-V2.1-Master", input_from=0)
            .step(GMICloudVideoProvider, model="Wan-2.6-I2V",                   input_from=0)
            .step(GMICloudVideoProvider, model="PixVerse-v5.6",                  input_from=0)
            .stream(sink=ObjectStorageSink)
```

## Streaming bridge (SSE)

Each endpoint returns a `StreamingResponse` that iterates `pipeline.stream()`.
`StreamEvent.to_dict()` is the wire format — no custom serialization.

```
pipeline.stream(sink=...)
  └─ yields StreamEvent objects
       └─ runtime/runs.py converts each to "data: {json}\n\n"
            └─ client EventSource parses typed StreamEvent records
```

The terminal `pipeline.completed` event carries the `PipelineResult` which is
stored in the in-memory `_run_store` dict for future iterate/approve lookups.

## Storage flows

All storage goes through the single `@lru_cache(maxsize=1)` backend in
`repo/pipelines.py`. No direct boto3 anywhere in the sample.

| Operation | Path |
|---|---|
| Upload | `pipeline.stream(sink=ObjectStorageSink)` — library-managed |
| Thumbnail / playback | `GET /assets/{key}` → 302 to `backend.get_url(key, expires_in=600)` |
| Manifest JSON | `GET /runs/{id}/manifest` → `backend.get(key)` |
| Durable asset URLs | `backend.get_durable_url()` — library embeds in Manifest |
| Health probe | `backend.exists("__genblaze_health_probe__")` |

## B2 object layout

```
runs/
  {run_id}/
    {step_id}/
      image.jpg         ← anchor image
      manifest.json     ← SHA-256-verified run record
  {video_run_id}/
    {step_0_id}/
      video.mp4         ← Kling output
    {step_1_id}/
      video.mp4         ← Wan output
    {step_2_id}/
      video.mp4         ← PixVerse output
    manifest.json
```

## User-agent attribution

The sample carries no `(backblaze-b2-samples)` UA string because it owns no
boto3 client. B2 request logs show `b2ai-genblaze/<version>` (set by
`genblaze-s3`). Per-sample identity is carried by `Pipeline(name=...)`, written
into every `Manifest.pipeline_name` field persisted in B2.
