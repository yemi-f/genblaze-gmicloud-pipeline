"use client";

import { useCallback, useReducer } from "react";
import { AlertCircle } from "lucide-react";
import type { Run, StreamEvent } from "@genblaze-gmicloud-pipeline/shared";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { approveRun, getRun, iterateRun, startRun } from "@/lib/api-client";
import { PromptForm } from "./prompt-form";
import { ImageCanvas } from "./image-canvas";
import { VideoFanout } from "./video-fanout";
import { RunTimeline } from "./run-timeline";
import { ManifestPanel } from "./manifest-panel";

// Terminal states land in `*-failed` instead of staying stuck in `generating-*`,
// so the prompt form re-enables and the user can switch models and retry.
type Stage =
  | "idle"
  | "generating-image"
  | "image-ready"
  | "image-failed"
  | "generating-videos"
  | "videos-failed"
  | "complete";

interface FailureInfo {
  message: string;
  model: string | null;
  stage: "image" | "videos";
}

interface StudioState {
  stage: Stage;
  imageRunId: string | null;
  videoRunId: string | null;
  imageRun: Run | null;
  videoRun: Run | null;
  events: StreamEvent[];
  failure: FailureInfo | null;
}

type Action =
  | { type: "START_IMAGE"; runId: string | null }
  | { type: "IMAGE_DONE"; run: Run }
  | { type: "IMAGE_FAIL"; message: string; model: string | null }
  | { type: "START_VIDEOS"; runId: string | null }
  | { type: "VIDEOS_DONE"; run: Run }
  | { type: "VIDEOS_FAIL"; message: string }
  | { type: "ADD_EVENT"; event: StreamEvent }
  | { type: "RESET" };

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "START_IMAGE": {
      // Dispatched twice: once on click (runId=null) so the loader shows
      // immediately during the POST round-trip, then again when the
      // pipeline.started SSE event lands with the real runId. On the
      // runId-update pass we keep events/failure intact so the started
      // event itself isn't wiped from the timeline.
      const transitioning = state.stage !== "generating-image";
      return {
        ...state,
        stage: "generating-image",
        imageRunId: action.runId,
        events: transitioning ? [] : state.events,
        failure: transitioning ? null : state.failure,
      };
    }
    case "IMAGE_DONE":
      return { ...state, stage: "image-ready", imageRun: action.run, failure: null };
    case "IMAGE_FAIL":
      return {
        ...state,
        stage: "image-failed",
        failure: { message: action.message, model: action.model, stage: "image" },
      };
    case "START_VIDEOS": {
      const transitioning = state.stage !== "generating-videos";
      return {
        ...state,
        stage: "generating-videos",
        videoRunId: action.runId,
        failure: transitioning ? null : state.failure,
      };
    }
    case "VIDEOS_DONE":
      return { ...state, stage: "complete", videoRun: action.run, failure: null };
    case "VIDEOS_FAIL":
      return {
        ...state,
        stage: "videos-failed",
        failure: { message: action.message, model: null, stage: "videos" },
      };
    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event] };
    case "RESET":
      return INITIAL;
    default:
      return state;
  }
}

const INITIAL: StudioState = {
  stage: "idle",
  imageRunId: null,
  videoRunId: null,
  imageRun: null,
  videoRun: null,
  events: [],
  failure: null,
};

/**
 * Returns true when an SSE event marks the whole pipeline as ended in failure.
 * Covers both `pipeline.failed` (explicit) and `pipeline.completed` +
 * run_status="failed" (library emits either depending on version).
 */
function isTerminalFailure(ev: StreamEvent): boolean {
  if (ev.type === "pipeline.failed") return true;
  if (ev.type === "pipeline.completed" && ev.run_status === "failed") return true;
  return false;
}

/** Header status pill copy/tone for each pipeline stage. */
function statusPillFor(stage: Stage): { tone: PillTone; text: string; dot: boolean } {
  switch (stage) {
    case "idle":              return { tone: "neutral", text: "Ready",              dot: false };
    case "generating-image":  return { tone: "active",  text: "Generating image",   dot: true  };
    case "image-ready":       return { tone: "blue",    text: "Image ready",        dot: false };
    case "image-failed":      return { tone: "red",     text: "Image failed",       dot: false };
    case "generating-videos": return { tone: "active",  text: "Generating videos",  dot: true  };
    case "videos-failed":     return { tone: "red",     text: "Videos failed",      dot: false };
    case "complete":          return { tone: "green",   text: "Complete",           dot: false };
  }
}

export function StudioPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // --- Stage 1: Generate anchor image ---
  const handleGenerate = useCallback(
    (prompt: string, seed: number, aspectRatio: "16:9" | "9:16" | "1:1", imageModel: string) => {
      // Flip the stage immediately so the loader renders during the POST
      // round-trip (before any SSE event arrives). Real runId is attached
      // when pipeline.started fires.
      dispatch({ type: "START_IMAGE", runId: null });

      // Capture state per-invocation so onDone/onError don't rely on stale
      // reducer state (the X-Run-Id header is never set upstream).
      let runId: string | null = null;
      let lastStepError: string | null = null;
      let terminalDispatched = false;

      startRun(
        { prompt, seed, aspect_ratio: aspectRatio, image_model: imageModel },
        (ev) => {
          dispatch({ type: "ADD_EVENT", event: ev });
          if (ev.type === "pipeline.started" && ev.run_id) {
            runId = ev.run_id;
            dispatch({ type: "START_IMAGE", runId: ev.run_id });
          }
          if (ev.type === "step.failed" && ev.error) {
            lastStepError = ev.error;
          }
          if (!terminalDispatched && isTerminalFailure(ev)) {
            terminalDispatched = true;
            dispatch({
              type: "IMAGE_FAIL",
              // PipelineCompletedEvent (in the failed-via-run_status path)
              // has no `message` field; PipelineFailedEvent does. Read safely.
              message: lastStepError ?? ("message" in ev ? ev.message ?? undefined : undefined) ?? "Pipeline failed",
              model: imageModel,
            });
          }
        },
        () => {
          // Stream closed. If we already marked a terminal failure, don't
          // fetch the run snapshot — the canvas should stay on whatever image
          // was there before. On success, pull the run so ImageCanvas renders.
          if (terminalDispatched || !runId) return;
          getRun(runId)
            .then((run) => {
              // RunStatus enum uses "completed" (not "succeeded", which is a
              // StepStatus value); the only failure terminal is "failed".
              if (run.status === "completed") {
                dispatch({ type: "IMAGE_DONE", run });
              } else {
                dispatch({
                  type: "IMAGE_FAIL",
                  message: lastStepError ?? `Run ended with status: ${run.status}`,
                  model: imageModel,
                });
              }
            })
            .catch((err: Error) =>
              dispatch({ type: "IMAGE_FAIL", message: err.message, model: imageModel }),
            );
        },
        (err) => {
          if (terminalDispatched) return;
          terminalDispatched = true;
          dispatch({ type: "IMAGE_FAIL", message: err.message, model: imageModel });
        },
      );
    },
    [],
  );

  // --- Stage 2: Iterate (regenerate or refine-on-image) ---
  const handleIterate = useCallback(
    (prompt: string | undefined, referenceAssetKey: string | undefined) => {
      if (!state.imageRunId) return;
      const parentId = state.imageRunId;
      // Re-use the prior run's image model so retry stays consistent.
      const modelTried = state.imageRun?.steps[0]?.model ?? null;

      // Flip stage immediately so the iterating overlay shows during the POST.
      dispatch({ type: "START_IMAGE", runId: null });

      let runId: string | null = null;
      let lastStepError: string | null = null;
      let terminalDispatched = false;

      iterateRun(
        parentId,
        { parent_run_id: parentId, prompt, reference_asset_key: referenceAssetKey },
        (ev) => {
          dispatch({ type: "ADD_EVENT", event: ev });
          if (ev.type === "pipeline.started" && ev.run_id) {
            runId = ev.run_id;
            dispatch({ type: "START_IMAGE", runId: ev.run_id });
          }
          if (ev.type === "step.failed" && ev.error) {
            lastStepError = ev.error;
          }
          if (!terminalDispatched && isTerminalFailure(ev)) {
            terminalDispatched = true;
            dispatch({
              type: "IMAGE_FAIL",
              message: lastStepError ?? ("message" in ev ? ev.message ?? undefined : undefined) ?? "Iteration failed",
              model: modelTried,
            });
          }
        },
        () => {
          if (terminalDispatched || !runId) return;
          getRun(runId)
            .then((run) => {
              if (run.status === "completed") {
                dispatch({ type: "IMAGE_DONE", run });
              } else {
                dispatch({
                  type: "IMAGE_FAIL",
                  message: lastStepError ?? `Run ended with status: ${run.status}`,
                  model: modelTried,
                });
              }
            })
            .catch((err: Error) =>
              dispatch({ type: "IMAGE_FAIL", message: err.message, model: modelTried }),
            );
        },
        (err) => {
          if (terminalDispatched) return;
          terminalDispatched = true;
          dispatch({ type: "IMAGE_FAIL", message: err.message, model: modelTried });
        },
      );
    },
    [state.imageRunId, state.imageRun],
  );

  // --- Stage 3: Approve image, fan out to videos ---
  const handleApprove = useCallback(() => {
    if (!state.imageRunId || !state.imageRun) return;
    const approvedStep = state.imageRun.steps[0];
    if (!approvedStep) return;
    const parentId = state.imageRunId;

    // Flip stage immediately so VideoFanout (with empty tile loaders) shows
    // during the POST round-trip, not after pipeline.started arrives.
    dispatch({ type: "START_VIDEOS", runId: null });

    let runId: string | null = null;
    let lastStepError: string | null = null;
    let terminalDispatched = false;

    approveRun(
      parentId,
      { run_id: parentId, approved_step_id: approvedStep.step_id },
      (ev) => {
        dispatch({ type: "ADD_EVENT", event: ev });
        if (ev.type === "pipeline.started" && ev.run_id) {
          runId = ev.run_id;
          dispatch({ type: "START_VIDEOS", runId: ev.run_id });
        }
        if (ev.type === "step.failed" && ev.error) {
          lastStepError = ev.error;
        }
        // For a 3-step fan-out, individual step failures don't mean the whole
        // run failed — only a terminal pipeline event does.
        if (!terminalDispatched && isTerminalFailure(ev)) {
          terminalDispatched = true;
          dispatch({
            type: "VIDEOS_FAIL",
            message: lastStepError ?? ("message" in ev ? ev.message ?? undefined : undefined) ?? "Video fan-out failed",
          });
        }
      },
      () => {
        if (!runId) return;
        getRun(runId)
          .then((run) => {
            // Even if one of the three video steps failed, we still surface
            // the Run so VideoFanout can show which succeeded.
            dispatch({ type: "VIDEOS_DONE", run });
          })
          .catch((err: Error) => {
            if (!terminalDispatched) {
              dispatch({ type: "VIDEOS_FAIL", message: err.message });
            }
          });
      },
      (err) => {
        if (terminalDispatched) return;
        terminalDispatched = true;
        dispatch({ type: "VIDEOS_FAIL", message: err.message });
      },
    );
  }, [state.imageRunId, state.imageRun]);

  const isGenerating =
    state.stage === "generating-image" || state.stage === "generating-videos";

  const status = statusPillFor(state.stage);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header — frames the page as a GMI Cloud × Genblaze demo and surfaces
          live run state (status pill + parent run ID) so the user always
          knows where the pipeline is. */}
      <div className="border-b border-border pb-5 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">GMI Cloud Pipeline</h1>
          <p className="text-sm text-muted-foreground mt-1.5">
            Prompt → image → image-to-video fan-out, orchestrated by the{" "}
            <span className="font-mono text-foreground/80">genblaze</span> SDK
            over GMI Cloud models. Every step is logged, hashed, and persisted
            to Backblaze B2.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusPill tone={status.tone} dot={status.dot}>
            {status.text}
          </StatusPill>
          {state.imageRunId && (
            <span className="status-pill font-mono" title={`Run ID: ${state.imageRunId}`}>
              run · {state.imageRunId.slice(0, 8)}
            </span>
          )}
        </div>
      </div>

      <div className="space-y-6">
        {/* Persistent error banner — visible until the next run starts or
            reset. Full-width above the columns so it's hard to miss. */}
        {state.failure && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>
              {state.failure.stage === "image" ? "Image generation failed" : "Video fan-out failed"}
              {state.failure.model ? ` · ${state.failure.model}` : ""}
            </AlertTitle>
            <AlertDescription>
              <p className="font-mono text-xs break-all">{state.failure.message}</p>
              <p className="mt-1">
                Pick a different image model above and click Generate to retry, or Reset to start over.
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* Three-column pipeline view at lg+. Reads left → right exactly as
            the data flows: prompt + live SDK stream, anchor image, video
            fan-out. Stacks vertically below lg. Ratios (4 / 4 / 5) give the
            video column a bit more room since each tile is full-width
            inside that column. */}
        <div className="grid gap-6 lg:grid-cols-[4fr_4fr_5fr]">
          {/* Column 1 — Compose + live Pipeline Inspector */}
          <div className="space-y-6 min-w-0">
            <PromptForm
              onSubmit={handleGenerate}
              disabled={isGenerating}
              onReset={() => dispatch({ type: "RESET" })}
            />
            <RunTimeline
              events={state.events}
              stage={state.stage}
              imageRunId={state.imageRunId}
              videoRunId={state.videoRunId}
              imageRun={state.imageRun}
              videoRun={state.videoRun}
            />
          </div>

          {/* Column 2 — Anchor image + manifest (the verifiable artifact
              for the whole run lives next to the canvas it summarizes). */}
          <div className="space-y-6 min-w-0">
            <ImageCanvas
              stage={state.stage}
              run={state.imageRun}
              onIterate={handleIterate}
              onApprove={handleApprove}
            />
            {state.stage === "complete" && state.videoRunId && (
              <ManifestPanel
                runId={state.videoRunId}
                manifestKey={`runs/${state.videoRunId}/manifest.json`}
                canonicalHash={
                  state.events
                    .filter(
                      (e): e is Extract<StreamEvent, { type: "pipeline.completed" }> =>
                        e.type === "pipeline.completed" &&
                        (e as { run_id?: string | null }).run_id === state.videoRunId,
                    )
                    .slice(-1)[0]?.manifest_hash ?? undefined
                }
              />
            )}
          </div>

          {/* Column 3 — Video fan-out (3 tiles, stacked vertically inside
              this column so each tile reads at full column width). */}
          <div className="min-w-0">
            <VideoFanout
              stage={state.stage}
              run={state.videoRun}
              // Agent event variants in the spec union lack run_id; read via
              // a narrow cast so the predicate works across all variants.
              events={state.events.filter(
                (e) => (e as { run_id?: string | null }).run_id === state.videoRunId,
              )}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
