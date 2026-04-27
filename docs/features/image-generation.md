# Feature: Image Generation

## Overview

The first stage of the pipeline: a text prompt is sent to a GMICloud image model
via `genblaze-gmicloud`, the asset is uploaded to B2, and a partial manifest is
written.

## Models

| Slug | Notes |
|---|---|
| `seedream-5.0-lite` | Default. Fast, high quality. |
| `flux-kontext-pro` | Image-as-reference model for the iterate stage. |

## Parameters

- `prompt` — text description (required)
- `seed` — integer for reproducibility (default 42)
- `aspect_ratio` — `"16:9"` | `"9:16"` | `"1:1"` (default `"16:9"`)

## Pipeline code

```python
Pipeline("genblaze-gmicloud-pipeline", max_concurrency=1)
.step(
    GMICloudImageProvider(api_key=...),
    model="seedream-5.0-lite",
    modality=Modality.IMAGE,
    prompt=req.prompt,
    seed=req.seed,
    aspect_ratio=req.aspect_ratio,
)
```

## Storage

The library writes the image asset to `runs/{run_id}/{step_id}/image.*` and a
partial manifest to `runs/{run_id}/manifest.json` via `ObjectStorageSink`.
