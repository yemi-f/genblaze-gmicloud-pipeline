"use client";

import { useCallback, useReducer } from "react";
import { toast } from "sonner";
import type { Run, StreamEvent } from "@genblaze-gmicloud-pipeline/shared";
import { approveRun, iterateRun, startRun } from "@/lib/api-client";
import { PromptForm } from "./prompt-form";
import { ImageCanvas } from "./image-canvas";
import { VideoFanout } from "./video-fanout";
import { RunTimeline } from "./run-timeline";
import { ManifestPanel } from "./manifest-panel";

// Simple state machine for the three-stage pipeline
type Stage = "idle" | "generating-image" | "image-ready" | "generating-videos" | "complete";

interface StudioState {
  stage: Stage;
  imageRunId: string | null;
  videoRunId: string | null;
  imageRun: Run | null;
  videoRun: Run | null;
  events: StreamEvent[];
}

type Action =
  | { type: "START_IMAGE"; runId: string }
  | { type: "IMAGE_DONE"; run: Run }
  | { type: "START_VIDEOS"; runId: string }
  | { type: "VIDEOS_DONE"; run: Run }
  | { type: "ADD_EVENT"; event: StreamEvent }
  | { type: "RESET" };

function reducer(state: StudioState, action: Action): StudioState {
  switch (action.type) {
    case "START_IMAGE":
      return { ...state, stage: "generating-image", imageRunId: action.runId, events: [] };
    case "IMAGE_DONE":
      return { ...state, stage: "image-ready", imageRun: action.run };
    case "START_VIDEOS":
      return { ...state, stage: "generating-videos", videoRunId: action.runId };
    case "VIDEOS_DONE":
      return { ...state, stage: "complete", videoRun: action.run };
    case "ADD_EVENT":
      return { ...state, events: [...state.events, action.event] };
    case "RESET":
      return {
        stage: "idle",
        imageRunId: null,
        videoRunId: null,
        imageRun: null,
        videoRun: null,
        events: [],
      };
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
};

export function StudioPage() {
  const [state, dispatch] = useReducer(reducer, INITIAL);

  // --- Stage 1: Generate anchor image ---
  const handleGenerate = useCallback(
    (prompt: string, seed: number, aspectRatio: "16:9" | "9:16" | "1:1", imageModel: string) => {
      startRun(
        { prompt, seed, aspect_ratio: aspectRatio, image_model: imageModel },
        (ev) => {
          dispatch({ type: "ADD_EVENT", event: ev });
          if (ev.type === "pipeline.started") {
            dispatch({ type: "START_IMAGE", runId: ev.run_id });
          }
        },
        (runId) => {
          if (runId) {
            // Fetch the Run snapshot so ImageCanvas can render the asset
            fetch(`/api/runs/${runId}`)
              .then((r) => r.json())
              .then((run: Run) => dispatch({ type: "IMAGE_DONE", run }))
              .catch(() => toast.error("Failed to load run result"));
          }
        },
        (err) => toast.error(err.message),
      );
    },
    [],
  );

  // --- Stage 2: Iterate (regenerate or refine-on-image) ---
  const handleIterate = useCallback(
    (prompt: string | undefined, referenceAssetKey: string | undefined) => {
      if (!state.imageRunId) return;
      iterateRun(
        state.imageRunId,
        { parent_run_id: state.imageRunId, prompt, reference_asset_key: referenceAssetKey },
        (ev) => {
          dispatch({ type: "ADD_EVENT", event: ev });
          if (ev.type === "pipeline.started") {
            dispatch({ type: "START_IMAGE", runId: ev.run_id });
          }
        },
        (runId) => {
          if (runId) {
            fetch(`/api/runs/${runId}`)
              .then((r) => r.json())
              .then((run: Run) => dispatch({ type: "IMAGE_DONE", run }))
              .catch(() => toast.error("Failed to load iteration result"));
          }
        },
        (err) => toast.error(err.message),
      );
    },
    [state.imageRunId],
  );

  // --- Stage 3: Approve image, fan out to videos ---
  const handleApprove = useCallback(() => {
    if (!state.imageRunId || !state.imageRun) return;
    const approvedStep = state.imageRun.steps[0];
    if (!approvedStep) return;

    approveRun(
      state.imageRunId,
      { run_id: state.imageRunId, approved_step_id: approvedStep.id },
      (ev) => {
        dispatch({ type: "ADD_EVENT", event: ev });
        if (ev.type === "pipeline.started") {
          dispatch({ type: "START_VIDEOS", runId: ev.run_id });
        }
      },
      (runId) => {
        if (runId) {
          fetch(`/api/runs/${runId}`)
            .then((r) => r.json())
            .then((run: Run) => dispatch({ type: "VIDEOS_DONE", run }))
            .catch(() => toast.error("Failed to load video results"));
        }
      },
      (err) => toast.error(err.message),
    );
  }, [state.imageRunId, state.imageRun]);

  const isGenerating =
    state.stage === "generating-image" || state.stage === "generating-videos";

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="border-b border-border pb-5">
        <h1 className="page-title">Studio</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Prompt → image → iterate → fan out to three video models simultaneously.
        </p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {/* Stage 1: Prompt */}
          <PromptForm
            onSubmit={handleGenerate}
            disabled={isGenerating}
            onReset={() => dispatch({ type: "RESET" })}
          />

          {/* Stage 2: Image canvas (shows after first generation) */}
          {state.imageRun && (
            <ImageCanvas
              run={state.imageRun}
              onIterate={handleIterate}
              onApprove={handleApprove}
              disabled={isGenerating || state.stage === "generating-videos"}
            />
          )}

          {/* Stage 3: Video fan-out tiles (shows after approve) */}
          {(state.stage === "generating-videos" || state.stage === "complete") &&
            state.videoRunId && (
              <VideoFanout
                events={state.events.filter((e) => e.run_id === state.videoRunId)}
                run={state.videoRun}
              />
            )}

          {/* Manifest panel — once videos complete */}
          {state.stage === "complete" && state.videoRun?.manifest_key && (
            <ManifestPanel
              runId={state.videoRun.id}
              manifestKey={state.videoRun.manifest_key}
              canonicalHash={state.videoRun.canonical_hash ?? undefined}
            />
          )}
        </div>

        {/* Right rail: live event timeline */}
        <aside>
          <RunTimeline events={state.events} />
        </aside>
      </div>
    </div>
  );
}
