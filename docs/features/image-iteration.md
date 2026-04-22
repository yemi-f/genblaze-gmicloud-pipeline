# Feature: Image Iteration

## Overview

After the anchor image is generated, the user can fork the run to generate
variations without re-entering the full prompt.

## Two iteration modes

### Text-only regen

A new `Pipeline(...).from_result(prev).step(GMICloudImageProvider, ...)` is
created without `input_from`. The model generates a fresh image from the updated
(or original) prompt and a new seed.

### Image-as-reference (FLUX-Kontext-Pro)

When `reference_asset_key` is set, the step adds `input_from=0` so the library
passes the previous image as the visual reference. The model refines rather than
regenerating from scratch.

## Lineage

`Pipeline.from_result(prev)` copies the parent run's step results into the new
pipeline so the `Manifest` records `parent_run_id`, creating a full provenance
chain across all iterations.

## Pipeline code (image-as-reference path)

```python
Pipeline("genblaze-gmicloud-pipeline", max_concurrency=1)
.from_result(prev_result)
.step(
    GMICloudImageProvider(api_key=...),
    model="FLUX-Kontext-Pro",
    modality=Modality.IMAGE,
    prompt=req.prompt,
    seed=req.seed,
    input_from=0,  # previous image as visual reference
)
```
