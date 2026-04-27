"use client";

import { useState } from "react";
import { Check, Copy, Download, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { FileEntry } from "@genblaze-gmicloud-pipeline/shared";

interface VideoViewerProps {
  file: FileEntry;
  url: string;
}

function formatDuration(sec: number): string {
  if (!isFinite(sec) || sec < 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VideoViewer({ file, url }: VideoViewerProps) {
  const [meta, setMeta] = useState<{ w: number; h: number; dur: number } | null>(null);
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    await navigator.clipboard.writeText(file.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="space-y-3">
      <div className="relative w-full overflow-hidden rounded-lg border border-border bg-black">
        <video
          src={url}
          controls
          preload="metadata"
          playsInline
          onLoadedMetadata={(e) => {
            const el = e.currentTarget;
            setMeta({
              w: el.videoWidth,
              h: el.videoHeight,
              dur: el.duration,
            });
          }}
          className="block h-auto w-full"
          style={{ maxHeight: "74vh" }}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {meta && (
            <>
              <span className="font-mono tabular-nums">{formatDuration(meta.dur)}</span>
              <span className="font-mono tabular-nums">
                {meta.w} × {meta.h}
              </span>
            </>
          )}
          <span className="font-mono tabular-nums">{file.size_human}</span>
          <span className="truncate">{file.content_type}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={copyKey}>
            {copied ? (
              <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="mr-1 h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy key"}
          </Button>
          <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
            <a href={url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1 h-3.5 w-3.5" />
              Open
            </a>
          </Button>
          <Button asChild size="sm" className="h-7 text-xs">
            <a href={url} download={file.filename}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
