"use client";

import { useState } from "react";
import { Check, Copy, Download, ExternalLink, Maximize2, Minimize2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { FileEntry } from "@genblaze-gmicloud-pipeline/shared";

interface ImageViewerProps {
  file: FileEntry;
  url: string;
}

// Transparent-checkerboard used as the backdrop so PNGs with alpha read
// correctly (otherwise a pure-white or pure-black bg lies about the asset).
const CHECKER_STYLE: React.CSSProperties = {
  backgroundImage:
    "linear-gradient(45deg, var(--muted) 25%, transparent 25%), linear-gradient(-45deg, var(--muted) 25%, transparent 25%), linear-gradient(45deg, transparent 75%, var(--muted) 75%), linear-gradient(-45deg, transparent 75%, var(--muted) 75%)",
  backgroundSize: "20px 20px",
  backgroundPosition: "0 0, 0 10px, 10px -10px, 10px 0",
};

export function ImageViewer({ file, url }: ImageViewerProps) {
  const [loading, setLoading] = useState(true);
  const [dims, setDims] = useState<{ w: number; h: number } | null>(null);
  const [fit, setFit] = useState<"contain" | "actual">("contain");
  const [copied, setCopied] = useState(false);

  const copyKey = async () => {
    await navigator.clipboard.writeText(file.key);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="space-y-3">
      {/* Viewer surface */}
      <div
        className="relative w-full overflow-auto rounded-lg border border-border"
        style={{
          ...CHECKER_STYLE,
          maxHeight: "78vh",
        }}
      >
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center">
            <Skeleton className="h-64 w-full" />
          </div>
        )}
        <div
          className={
            fit === "contain"
              ? "flex min-h-[40vh] items-center justify-center p-4"
              : "inline-block p-4"
          }
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={url}
            alt={file.filename}
            onLoad={(e) => {
              const el = e.currentTarget;
              setDims({ w: el.naturalWidth, h: el.naturalHeight });
              setLoading(false);
            }}
            onError={() => setLoading(false)}
            className={
              fit === "contain"
                ? "max-h-[74vh] w-auto object-contain transition-opacity duration-200"
                : "block transition-opacity duration-200"
            }
            style={{ opacity: loading ? 0 : 1 }}
          />
        </div>
      </div>

      {/* Footer metadata + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          {dims && (
            <span className="font-mono tabular-nums">
              {dims.w} × {dims.h}
            </span>
          )}
          <span className="font-mono tabular-nums">{file.size_human}</span>
          <span className="truncate">{file.content_type}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={() => setFit((f) => (f === "contain" ? "actual" : "contain"))}
            title={fit === "contain" ? "Show at natural size" : "Fit to window"}
          >
            {fit === "contain" ? (
              <Maximize2 className="mr-1 h-3.5 w-3.5" />
            ) : (
              <Minimize2 className="mr-1 h-3.5 w-3.5" />
            )}
            {fit === "contain" ? "Actual" : "Fit"}
          </Button>
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
