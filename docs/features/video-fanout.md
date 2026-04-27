# Feature: Video Fan-out

## Overview

After the user approves an image, three video generation jobs are dispatched
concurrently. Each job reads the approved image as its input (`input_from=0`)
and runs on a different GMICloud video model.

## Models

| Slug | Notes |
|---|---|
| `Kling-Image2Video-V2.1-Master` | Cinematic quality, slower |
| `wan2.6-i2v` | General-purpose motion |
| `pixverse-v5.6-i2v` | Creative style |

## Concurrency

`Pipeline(..., max_concurrency=3)` allows all three steps to run in parallel.
Progress events (`step.progress`) arrive per-step via SSE so the UI can show
independent progress bars.

## Pipeline code

```python
p = Pipeline("genblaze-gmicloud-pipeline", max_concurrency=3).from_result(approved)
for model in ["Kling-Image2Video-V2.1-Master", "wan2.6-i2v", "pixverse-v5.6-i2v"]:
    p = p.step(
        GMICloudVideoProvider(api_key=...),
        model=model,
        modality=Modality.VIDEO,
        prompt=...,
        duration_sec=5,
        input_from=0,  # all three read the approved image
    )
```

## Note on fan-out style

Three sibling `.step()` calls with `input_from=0` is the idiomatic way to fan
out in Genblaze. `PipelineTemplate + StepTemplate` is a serialization/replay
mechanism, not a repetition shorthand — do not use it here.

## To add a fourth model

Add one more `.step(...)` call to the loop in `build_video_fanout()` and bump
`max_concurrency` to 4. No other changes required.
