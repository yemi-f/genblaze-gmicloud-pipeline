<!-- last_verified: 2026-04-22 -->
# App Workflows

User journeys inside the Genblaze x GMICloud Pipeline Studio.

## Journey 1: First generation

1. Open the Studio at `/`.
2. Enter a prompt, pick aspect ratio, seed, and image model.
3. Click **Generate**. The SSE connection opens; the run timeline shows events.
4. The anchor image appears in the Image Canvas when the run completes.

## Journey 2: Iterate

From the Image Canvas:

- **Regenerate**: click the button. A new run forks from the current one with a
  new seed (or the same seed if unchanged). The new image replaces the canvas.
- **Refine on this one**: click, optionally add a refinement prompt, then click
  **Refine**. FLUX-Kontext-Pro uses the current image as a visual reference and
  applies the prompt edits.

Iteration history is implicit — each run stores `parent_run_id` in its manifest.

## Journey 3: Approve and fan out to videos

1. When satisfied with the image, click **Approve**.
2. The SSE connection opens for the video fan-out run.
3. Three video tiles appear side by side, each with its own progress bar.
4. When complete, each tile shows a `<video>` player and a download link.
5. The Manifest panel appears below with the `canonical_hash` and a **Verify** button.

## Journey 4: Share / deep-link

The run ID from the `X-Run-Id` response header is the permanent address of the
run. `/runs/{runId}` is a stub deep-link page; the manifest at
`runs/{run_id}/manifest.json` in B2 is the durable record.

## Journey 5: Webhook-notified fan-out (async)

Set `WEBHOOK_URL`. Start a fan-out run and close the browser tab.
The backend posts the completion event to your webhook endpoint when all three
videos are done. Retrieve the manifest from B2 to inspect assets.
