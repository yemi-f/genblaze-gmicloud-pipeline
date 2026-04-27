"use client";

import { useState } from "react";
import Image from "next/image";
import { RefreshCw, Wand2, Check, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { GeneratingLoader } from "@/components/ui/generating-loader";
import { StatusPill } from "@/components/ui/status-pill";
import { getAssetUrl } from "@/lib/api-client";
import { humanizeBytes, humanizeDuration } from "@/lib/utils";
import { lookupModel } from "@/lib/models";
import type { Run } from "@genblaze-gmicloud-pipeline/shared";

// Pipeline stage values mirrored from studio-page.tsx — kept inline (rather
// than extracted to a shared file) because StudioPage owns the state machine
// and these are presentation-only ports.
type Stage =
  | "idle"
  | "generating-image"
  | "image-ready"
  | "image-failed"
  | "generating-videos"
  | "videos-failed"
  | "complete";

interface ImageCanvasProps {
  stage: Stage;
  run: Run | null;
  onIterate: (prompt: string | undefined, referenceAssetKey: string | undefined) => void;
  onApprove: () => void;
}

export function ImageCanvas({ stage, run, onIterate, onApprove }: ImageCanvasProps) {
  const [refineMode, setRefineMode] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");

  const step = run?.steps[0];
  const asset = step?.assets?.[0];
  const imageUrl = asset ? getAssetUrl(asset.url) : null;
  const promptText = step?.prompt ?? "Generated image";
  const aspectRatio = (run?.metadata?.aspect_ratio as string | undefined) ?? "";
  const model = step?.model ?? null;
  const modelInfo = lookupModel(model);
  const duration = humanizeDuration(step?.started_at, step?.completed_at);

  // Iteration scrim only when a refine/regenerate run is in flight AND we
  // already have an image to overlay.
  const iterating = stage === "generating-image" && !!run;
  // Buttons are disabled while ANY generation is happening — including video
  // fan-out, where the image is stable but shouldn't be re-iterated mid-run.
  const disabled = stage === "generating-image" || stage === "generating-videos";

  function handleRegenerate() {
    onIterate(undefined, undefined);
  }

  function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    onIterate(refinePrompt || undefined, asset?.url);
    setRefineMode(false);
    setRefinePrompt("");
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      {/* Stage header — numbered label, current image model (if known),
          aspect ratio, and a status pill for at-a-glance state. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">02</span>
          <h2 className="card-title">Anchor image</h2>
          {model && (
            <StatusPill tone={modelInfo.tone}>
              {modelInfo.label}
            </StatusPill>
          )}
          {aspectRatio && (
            <span className="text-xs text-muted-foreground font-mono">{aspectRatio}</span>
          )}
        </div>
        {iterating && <StatusPill tone="active" dot>Iterating</StatusPill>}
        {!iterating && stage === "image-ready" && <StatusPill tone="green">Ready</StatusPill>}
        {!iterating && stage === "image-failed" && <StatusPill tone="red">Failed</StatusPill>}
      </div>

      {/* Frame — always aspect-video so the layout doesn't jump between
          states. Renders one of: dotted placeholder (idle), big loader
          (first-gen, no image yet), the image, or the image + scrim
          (iterating). */}
      <div className="relative w-full overflow-hidden rounded-lg aspect-video">
        {!imageUrl && stage === "generating-image" && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/30">
            <GeneratingLoader size="lg" label={`Calling ${modelInfo.label || "GMI Cloud"}...`} />
          </div>
        )}

        {!imageUrl && stage !== "generating-image" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 stage-placeholder rounded-lg">
            <ImageIcon className="h-8 w-8 opacity-60" />
            <p className="text-xs">Anchor image will render here</p>
            <p className="text-[11px] opacity-70">Compose a prompt above and click Generate</p>
          </div>
        )}

        {imageUrl && (
          <>
            <div className="absolute inset-0 bg-muted" aria-hidden />
            <Image
              src={imageUrl}
              alt={promptText}
              fill
              className="object-contain"
              unoptimized
            />
            {iterating && (
              <div className="absolute inset-0 flex items-center justify-center blaze-scrim animate-fade-in">
                <GeneratingLoader size="md" label="Refining..." />
              </div>
            )}
          </>
        )}
      </div>

      {/* Metadata strip — surfaces what the SDK actually returned: model,
          seed, sha256, file size, generation time. Only shown when we have
          a concrete asset to describe. */}
      {asset && (
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-2 text-xs pt-2 border-t border-border">
          <MetaCell label="Model" value={modelInfo.label} mono={false} />
          <MetaCell label="Seed" value={step?.seed?.toString() ?? "—"} />
          <MetaCell
            label="SHA-256"
            value={asset.sha256 ? `${asset.sha256.slice(0, 12)}…` : "unhashed"}
            title={asset.sha256 ?? undefined}
          />
          <MetaCell
            label="Size"
            value={
              asset.size_bytes
                ? `${humanizeBytes(asset.size_bytes)}${duration ? ` · ${duration}` : ""}`
                : duration ?? "—"
            }
          />
        </dl>
      )}

      {/* Refine-on-image form */}
      {run && refineMode && (
        <form onSubmit={handleRefine} className="space-y-2">
          <Textarea
            placeholder="Describe your refinement (or leave blank to use the original prompt)..."
            value={refinePrompt}
            onChange={(e) => setRefinePrompt(e.target.value)}
            rows={2}
            className="resize-none text-sm"
            disabled={disabled}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={disabled}>
              <Wand2 className="h-3.5 w-3.5 mr-1.5" />
              Refine
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setRefineMode(false)}
              disabled={disabled}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}

      {run && !refineMode && (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={handleRegenerate} disabled={disabled}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Regenerate
          </Button>
          <Button size="sm" variant="outline" onClick={() => setRefineMode(true)} disabled={disabled}>
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Refine on this one
          </Button>
          <Button size="sm" onClick={onApprove} disabled={disabled}>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Approve & fan out
          </Button>
        </div>
      )}
    </div>
  );
}

function MetaCell({
  label,
  value,
  mono = true,
  title,
}: {
  label: string;
  value: string;
  mono?: boolean;
  title?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-[11px] uppercase tracking-wider">{label}</dt>
      <dd
        className={mono ? "font-mono text-foreground/90 truncate" : "text-foreground/90 truncate"}
        title={title ?? value}
      >
        {value}
      </dd>
    </div>
  );
}
