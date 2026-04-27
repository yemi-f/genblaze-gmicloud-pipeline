"use client";

import { useMemo } from "react";
import { Download, Lock, Video as VideoIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { GeneratingLoader } from "@/components/ui/generating-loader";
import { StatusPill } from "@/components/ui/status-pill";
import { getAssetUrl } from "@/lib/api-client";
import { humanizeBytes, humanizeDuration } from "@/lib/utils";
import { VIDEO_MODELS, lookupModel } from "@/lib/models";
import type { Run, StreamEvent } from "@genblaze-gmicloud-pipeline/shared";

type Stage =
  | "idle"
  | "generating-image"
  | "image-ready"
  | "image-failed"
  | "generating-videos"
  | "videos-failed"
  | "complete";

interface VideoFanoutProps {
  stage: Stage;
  run: Run | null;
  events: StreamEvent[];
}

export function VideoFanout({ stage, run, events }: VideoFanoutProps) {
  // Per-step progress from SSE events. Backend emits progress_pct as a
  // top-level field on step.progress events.
  const progressByIndex = useMemo(() => {
    const map: Record<number, number> = {};
    for (const ev of events) {
      if (ev.type !== "step.progress") continue;
      const idx = (ev as { step_index?: number }).step_index;
      if (idx !== undefined && typeof ev.progress_pct === "number") {
        map[idx] = ev.progress_pct;
      }
    }
    return map;
  }, [events]);

  // Tiles always come from the registry so the fan-out is visible from page
  // load. Once the run lands we splice in the actual step (model id reported
  // by the SDK takes precedence over the registry order).
  const tiles = VIDEO_MODELS.map((m, idx) => {
    const step = run?.steps[idx];
    const liveModel = step?.model ?? m.id;
    const info = lookupModel(liveModel);
    const asset = step?.assets?.[0];
    const progress =
      progressByIndex[idx] ?? (step?.status === "processing" ? 0 : undefined);
    const done = step?.status === "succeeded" && !!asset;
    const failed = step?.status === "failed";
    const duration = humanizeDuration(step?.started_at, step?.completed_at);

    return { idx, info, asset, progress, done, failed, status: step?.status, duration };
  });

  const preApproval =
    stage === "idle" ||
    stage === "generating-image" ||
    stage === "image-ready" ||
    stage === "image-failed";

  return (
    <div className="space-y-3 rounded-xl border border-border p-5">
      {/* Stage header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">03</span>
          <h2 className="card-title">Video fan-out</h2>
          <span className="text-xs text-muted-foreground">
            three GMI Cloud image-to-video models in parallel
          </span>
        </div>
        {stage === "generating-videos" && <StatusPill tone="active" dot>Running</StatusPill>}
        {stage === "complete" && <StatusPill tone="green">Complete</StatusPill>}
        {stage === "videos-failed" && <StatusPill tone="red">Failed</StatusPill>}
        {preApproval && <StatusPill tone="neutral">Awaiting approval</StatusPill>}
      </div>

      {/* Tile grid. Tiles always stack 1-per-row inside this dedicated
          column so each one reads at the full column width. On viewports
          below `lg` the column itself is full-width, so we briefly switch
          to 2 cols (and 3 on very wide phones) before the column layout
          kicks in. */}
      <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-1">
        {tiles.map((tile) => (
          <div
            key={tile.idx}
            className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
          >
            {/* Per-tile header — model label + provider tag */}
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold truncate">{tile.info.label}</p>
              <StatusPill tone={tile.info.tone} className="text-[10px]">
                {tile.info.provider}
              </StatusPill>
            </div>

            {/* Frame: video / loader / awaiting / failed */}
            {tile.done && tile.asset && (
              <video
                src={getAssetUrl(tile.asset.url)}
                controls
                className="w-full rounded-md aspect-video bg-black"
              />
            )}

            {!tile.done && !tile.failed && stage === "generating-videos" && (
              <div className="flex items-center justify-center w-full aspect-video rounded-md bg-muted">
                <GeneratingLoader size="md" />
              </div>
            )}

            {!tile.done && !tile.failed && preApproval && (
              <div className="flex flex-col items-center justify-center gap-1 w-full aspect-video rounded-md stage-placeholder">
                <Lock className="h-5 w-5 opacity-60" />
                <p className="text-[11px]">Awaiting approval</p>
              </div>
            )}

            {tile.failed && (
              <div className="flex flex-col items-center justify-center gap-1 w-full aspect-video rounded-md bg-destructive/10 border border-destructive/30 text-destructive">
                <VideoIcon className="h-5 w-5 opacity-80" />
                <p className="text-[11px]">Generation failed</p>
              </div>
            )}

            {/* Progress bar — only visible while a step is actively running. */}
            {typeof tile.progress === "number" && !tile.done && !tile.failed && (
              <Progress value={tile.progress} className="h-1.5" />
            )}

            {/* Per-tile metadata + download — only when we have a finished asset. */}
            {tile.done && tile.asset && (
              <div className="space-y-1 pt-1">
                <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                  <span title={tile.asset.sha256 ?? undefined}>
                    sha · <span className="font-mono">{tile.asset.sha256?.slice(0, 10) ?? "—"}</span>
                  </span>
                  <span>
                    {tile.asset.size_bytes ? humanizeBytes(tile.asset.size_bytes) : "—"}
                  </span>
                  <span>
                    {tile.asset.duration ? `${tile.asset.duration.toFixed(1)}s clip` : ""}
                  </span>
                  <span>{tile.duration ? `gen ${tile.duration}` : ""}</span>
                </div>
                <a
                  href={getAssetUrl(tile.asset.url)}
                  download
                  className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Download className="h-3 w-3" />
                  Download
                </a>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
