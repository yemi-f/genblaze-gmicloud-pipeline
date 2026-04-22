"use client";

import { useMemo } from "react";
import { Play, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { getAssetUrl } from "@/lib/api-client";
import type { Run, StreamEvent } from "@genblaze-gmicloud-pipeline/shared";

// Video models in display order (matches DEFAULT_VIDEO_MODELS on the backend)
const VIDEO_MODEL_LABELS: Record<string, string> = {
  "Kling-Image2Video-V2.1-Master": "Kling V2.1 Master",
  "Wan-2.6-I2V": "Wan 2.6 I2V",
  "PixVerse-v5.6": "PixVerse v5.6",
};

interface VideoFanoutProps {
  events: StreamEvent[];
  run: Run | null;
}

export function VideoFanout({ events, run }: VideoFanoutProps) {
  // Compute per-step progress from SSE events (step.progress payload)
  const progressByIndex = useMemo(() => {
    const map: Record<number, number> = {};
    for (const ev of events) {
      if (ev.type === "step.progress" && ev.step_index !== undefined) {
        const pct = (ev.payload as { percent?: number }).percent;
        if (typeof pct === "number") map[ev.step_index] = pct;
      }
    }
    return map;
  }, [events]);

  // Three tiles (one per video model). Steps are at indices 0, 1, 2 after from_result.
  const tiles = [0, 1, 2].map((idx) => {
    const step = run?.steps[idx];
    const model = step?.model ?? Object.keys(VIDEO_MODEL_LABELS)[idx];
    const label = VIDEO_MODEL_LABELS[model] ?? model;
    const asset = step?.assets[0];
    const progress = progressByIndex[idx] ?? (step?.status === "running" ? 0 : undefined);
    const done = step?.status === "succeeded" && !!asset;

    return { idx, label, model, asset, progress, done, status: step?.status };
  });

  return (
    <div className="space-y-3 rounded-xl border border-border p-5">
      <p className="text-sm font-medium text-muted-foreground">
        Video fan-out &mdash; three models in parallel
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.idx}
            className="rounded-lg border border-border bg-muted/30 p-3 space-y-2"
          >
            <p className="text-xs font-semibold truncate">{tile.label}</p>

            {/* Video element when complete */}
            {tile.done && tile.asset && (
              <video
                src={getAssetUrl(tile.asset.b2_key)}
                controls
                className="w-full rounded-md aspect-video bg-black"
              />
            )}

            {/* Placeholder while generating */}
            {!tile.done && (
              <div className="flex items-center justify-center w-full aspect-video rounded-md bg-muted">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {/* Progress bar while running */}
            {typeof tile.progress === "number" && !tile.done && (
              <Progress value={tile.progress} className="h-1.5" />
            )}

            {/* Download link when done */}
            {tile.done && tile.asset && (
              <a
                href={getAssetUrl(tile.asset.b2_key)}
                download
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Play className="h-3 w-3" />
                Download
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
