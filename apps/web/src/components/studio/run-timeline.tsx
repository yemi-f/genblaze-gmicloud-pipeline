"use client";

import { useMemo, useRef, useEffect } from "react";
import { Activity } from "lucide-react";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { lookupModel } from "@/lib/models";
import { humanizeDuration } from "@/lib/utils";
import type { Run, StreamEvent } from "@genblaze-gmicloud-pipeline/shared";

type Stage =
  | "idle"
  | "generating-image"
  | "image-ready"
  | "image-failed"
  | "generating-videos"
  | "videos-failed"
  | "complete";

interface RunTimelineProps {
  events: StreamEvent[];
  stage: Stage;
  imageRunId: string | null;
  videoRunId: string | null;
  // Authoritative run snapshots fetched via getRun() once a stream closes.
  // Used to overlay terminal step statuses on top of the SSE event log,
  // since some library versions don't always emit step.completed before
  // pipeline.completed.
  imageRun: Run | null;
  videoRun: Run | null;
}

interface StepState {
  index: number;
  model?: string;
  status: "pending" | "processing" | "succeeded" | "failed";
  startedAt?: string;
  completedAt?: string;
  progress?: number;
  error?: string;
}

/** Reduce a flat event list into per-step state for one specific run id,
 *  then overlay terminal statuses from the run snapshot when available. */
function buildSteps(
  events: StreamEvent[],
  runId: string | null,
  run: Run | null,
): StepState[] {
  const map = new Map<number, StepState>();

  // Live SSE events — drive transitions and progress while a run is active.
  if (runId) {
    for (const ev of events) {
      const evRunId = (ev as { run_id?: string | null }).run_id;
      if (evRunId !== runId) continue;
      const idx = (ev as { step_index?: number }).step_index;
      if (idx === undefined) continue;
      const s = map.get(idx) ?? { index: idx, status: "pending" as const };
      if (ev.type === "step.started") {
        s.status = "processing";
        s.startedAt = ev.timestamp;
        s.model = (ev as { model?: string }).model;
      } else if (ev.type === "step.progress") {
        s.status = "processing";
        if (typeof ev.progress_pct === "number") s.progress = ev.progress_pct;
      } else if (ev.type === "step.completed") {
        s.status = "succeeded";
        s.completedAt = ev.timestamp;
      } else if (ev.type === "step.failed") {
        s.status = "failed";
        s.completedAt = ev.timestamp;
        if ("error" in ev) s.error = ev.error ?? undefined;
      }
      map.set(idx, s);
    }
  }

  // Run snapshot — authoritative source of truth once a run finishes.
  // Fills in any step we never saw an event for, and forces terminal
  // statuses if the SSE log was missing a step.completed for any reason.
  if (run) {
    run.steps.forEach((step, idx) => {
      const existing = map.get(idx) ?? { index: idx, status: "pending" as const };
      if (!existing.model && step.model) existing.model = step.model;
      if (!existing.startedAt && step.started_at) existing.startedAt = step.started_at;
      if (!existing.completedAt && step.completed_at) existing.completedAt = step.completed_at;
      if (step.status === "succeeded") existing.status = "succeeded";
      else if (step.status === "failed") existing.status = "failed";
      else if (step.status === "processing" && existing.status === "pending") {
        existing.status = "processing";
      }
      map.set(idx, existing);
    });
  }

  return [...map.values()].sort((a, b) => a.index - b.index);
}

function statusTone(status: StepState["status"]): PillTone {
  switch (status) {
    case "processing": return "active";
    case "succeeded":  return "green";
    case "failed":     return "red";
    case "pending":    return "neutral";
  }
}

/** Friendly event-type → short label, used in the trailing event log. */
const EVENT_LABEL: Record<string, string> = {
  "pipeline.started":   "Pipeline started",
  "pipeline.completed": "Pipeline completed",
  "pipeline.failed":    "Pipeline failed",
  "step.started":       "Step started",
  "step.progress":      "Step progress",
  "step.completed":     "Step completed",
  "step.failed":        "Step failed",
};

export function RunTimeline({
  events,
  stage,
  imageRunId,
  videoRunId,
  imageRun,
  videoRun,
}: RunTimelineProps) {
  const imageSteps = useMemo(
    () => buildSteps(events, imageRunId, imageRun),
    [events, imageRunId, imageRun],
  );
  const videoSteps = useMemo(
    () => buildSteps(events, videoRunId, videoRun),
    [events, videoRunId, videoRun],
  );

  // Auto-scroll the event log to the bottom on each new event. Using
  // `scrollIntoView` here would also scroll the page (since it bubbles up
  // to the window when the target is off-screen), which jumps the user
  // down on Generate. Scroll the inner container's scrollTop directly so
  // the page stays put.
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [events.length]);

  const isLive = stage === "generating-image" || stage === "generating-videos";

  return (
    <div className="rounded-xl border border-border bg-card">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-muted-foreground" />
          <h3 className="card-title">Pipeline inspector</h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            live SSE stream from <span className="font-mono">genblaze.run()</span>
          </span>
        </div>
        {isLive ? (
          <StatusPill tone="active" dot>Live</StatusPill>
        ) : (
          <StatusPill tone="neutral">Idle</StatusPill>
        )}
      </div>

      {/* Empty state — single line when nothing has happened yet. */}
      {events.length === 0 && (
        <p className="px-4 py-4 text-xs text-muted-foreground">
          Pipeline events will appear here once a run starts. Each Genblaze
          SDK call streams events back over SSE — you&apos;ll see step.started,
          step.progress, step.completed as they fire.
        </p>
      )}

      {/* Sections stack vertically — the inspector lives inside the narrow
          left column, so a horizontal 3-up doesn't fit. Image run, video
          fan-out, and event log read top-to-bottom. */}
      {events.length > 0 && (
        <div className="space-y-4 p-4">
          <RunSection
            title="Image run"
            runId={imageRunId}
            steps={imageSteps}
            placeholder="No image run yet."
          />
          <RunSection
            title="Video fan-out"
            runId={videoRunId}
            steps={videoSteps}
            placeholder="Approve the image to start the fan-out."
          />
          <div className="space-y-2 min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              Event stream
            </p>
            <div
              ref={logRef}
              className="space-y-0.5 max-h-48 overflow-y-auto rounded-md bg-muted/40 p-2 font-mono text-[11px]"
            >
              {events.slice(-20).map((ev, i) => {
                const stepIdx = (ev as { step_index?: number }).step_index;
                const label = EVENT_LABEL[ev.type] ?? ev.type;
                return (
                  <div key={i} className="text-muted-foreground">
                    <span className="text-foreground/80">{label}</span>
                    {stepIdx !== undefined && (
                      <span className="opacity-60"> · step {stepIdx}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RunSection({
  title,
  runId,
  steps,
  placeholder,
}: {
  title: string;
  runId: string | null;
  steps: StepState[];
  placeholder: string;
}) {
  return (
    <section className="space-y-2 min-w-0">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </p>
        {runId && (
          <span className="text-[11px] font-mono text-muted-foreground truncate" title={runId}>
            {runId.slice(0, 12)}…
          </span>
        )}
      </div>

      {!runId && <p className="text-xs text-muted-foreground italic">{placeholder}</p>}
      {runId && steps.length === 0 && (
        <p className="text-xs text-muted-foreground italic">Waiting for first event…</p>
      )}

      {steps.map((s) => {
        const info = lookupModel(s.model);
        const dur = humanizeDuration(s.startedAt, s.completedAt);
        return (
          <div key={s.index} className="inspector-step text-xs space-y-0.5" data-status={s.status}>
            <span className="step-chip">{s.index}</span>
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium truncate" title={info.label}>
                {info.label}
              </span>
              <StatusPill tone={statusTone(s.status)} dot={s.status === "processing"}>
                {s.status}
              </StatusPill>
            </div>
            <div className="text-muted-foreground flex items-center gap-2 flex-wrap">
              <span>{info.provider}</span>
              {s.status === "processing" && typeof s.progress === "number" && (
                <>
                  <span>·</span>
                  <span>{Math.round(s.progress)}%</span>
                </>
              )}
              {dur && (
                <>
                  <span>·</span>
                  <span>{dur}</span>
                </>
              )}
            </div>
            {s.error && (
              <p className="text-[11px] text-destructive font-mono break-all">{s.error}</p>
            )}
          </div>
        );
      })}
    </section>
  );
}
