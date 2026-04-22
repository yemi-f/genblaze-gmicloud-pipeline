"use client";

import { useRef, useEffect } from "react";
import type { StreamEvent } from "@genblaze-gmicloud-pipeline/shared";

interface RunTimelineProps {
  events: StreamEvent[];
}

export function RunTimeline({ events }: RunTimelineProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest event
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events.length]);

  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-border p-4 text-xs text-muted-foreground">
        Pipeline events will appear here once a run starts.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-1 max-h-[520px] overflow-y-auto">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
        Event stream
      </p>
      {events.map((ev, i) => (
        <div key={i} className="text-xs font-mono text-muted-foreground">
          <span className="text-foreground/70">{ev.type}</span>
          {ev.step_index !== undefined && (
            <span className="ml-1.5 text-muted-foreground/60">[step {ev.step_index}]</span>
          )}
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
