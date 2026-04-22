# Feature: Observability

## Always-on: LoggingTracer

`CompositeTracer([LoggingTracer()])` is added to every pipeline. Output is
structured JSON via the `JSONFormatter` in `main.py`. Every step start,
progress, and completion is logged.

## Optional: OTelTracer

Set `OTEL_ENDPOINT` to add an OpenTelemetry tracer to the composite:

```
OTEL_ENDPOINT=http://localhost:4318
```

The `OTelTracer` sends spans for each pipeline run and step to any OTLP-
compatible collector (Jaeger, Tempo, Honeycomb, etc.).

## Optional: WebhookSink

Set `WEBHOOK_URL` to receive a POST on run completion:

```
WEBHOOK_URL=https://example.com/hooks/genblaze
WEBHOOK_HEADER_AUTHORIZATION=Bearer your-token
```

The `WebhookSink` is appended to the sink list at runtime. Useful for long
fan-out runs where you want to be notified without keeping the SSE connection open.

## Step cache

`StepCache(settings.step_cache_dir)` is applied to every pipeline. If an
identical `(provider, model, params, seed)` combination was run before, the
result is served from the local cache directory — no GMICloud call is made.

Default cache dir: `./.cache/genblaze`. Override with `STEP_CACHE_DIR`.
