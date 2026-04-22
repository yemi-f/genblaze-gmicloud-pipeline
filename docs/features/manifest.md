# Feature: Manifest and Provenance

## Overview

Every completed pipeline run produces a `manifest.json` in B2 at
`runs/{run_id}/manifest.json`. The manifest is a Genblaze `Manifest` Pydantic
model that records:

- `run_id`, `pipeline_name`, `parent_run_id`
- Per-step `Asset` records with `sha256`, `b2_key`, `media_type`, `cost_usd`
- `canonical_hash` — a deterministic SHA-256 of the whole manifest content

## Verify endpoint

`GET /runs/{run_id}/manifest` returns the raw manifest JSON. The frontend's
**Verify** button fetches it and checks `manifest.canonical_hash` against the
value the API reported on completion.

## Object Lock (optional, doc-only)

To make manifests tamper-proof, enable Object Lock on your B2 bucket and add
`manifest_lock=ObjectLockConfig(...)` to the sink:

```python
ObjectStorageSink(
    backend,
    prefix="runs",
    manifest_lock=ObjectLockConfig(mode="COMPLIANCE", days=365),
)
```

Object Lock is off by default because it requires bucket-level configuration
that is not universal.

## Lifecycle rules

`auto_lifecycle=True` (default) applies two rules via `ensure_lifecycle_defaults()`:

1. Cancel orphaned multipart uploads after 7 days.
2. Expire noncurrent manifest versions after 30 days.

Pass `auto_lifecycle=False` if lifecycle is managed out-of-band (Terraform, IaC).
