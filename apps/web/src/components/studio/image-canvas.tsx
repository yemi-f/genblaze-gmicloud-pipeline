"use client";

import { useState } from "react";
import Image from "next/image";
import { RefreshCw, Wand2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { getAssetUrl } from "@/lib/api-client";
import type { Run } from "@genblaze-gmicloud-pipeline/shared";

interface ImageCanvasProps {
  run: Run;
  onIterate: (prompt: string | undefined, referenceAssetKey: string | undefined) => void;
  onApprove: () => void;
  disabled?: boolean;
}

export function ImageCanvas({ run, onIterate, onApprove, disabled }: ImageCanvasProps) {
  const [refineMode, setRefineMode] = useState(false);
  const [refinePrompt, setRefinePrompt] = useState("");

  // First step's first asset is the anchor image
  const step = run.steps[0];
  const asset = step?.assets[0];
  if (!asset) return null;

  const imageUrl = getAssetUrl(asset.b2_key);

  function handleRegenerate() {
    onIterate(undefined, undefined);
  }

  function handleRefine(e: React.FormEvent) {
    e.preventDefault();
    onIterate(refinePrompt || undefined, asset.b2_key);
    setRefineMode(false);
    setRefinePrompt("");
  }

  return (
    <div className="space-y-4 rounded-xl border border-border p-5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-muted-foreground">
          Generated image &mdash; {run.aspect_ratio}
        </span>
        <span className="text-xs text-muted-foreground font-mono">{asset.sha256.slice(0, 12)}...</span>
      </div>

      <div className="relative w-full overflow-hidden rounded-lg bg-muted aspect-video">
        <Image
          src={imageUrl}
          alt={run.prompt}
          fill
          className="object-contain"
          unoptimized
        />
      </div>

      {/* Refine-on-image form */}
      {refineMode && (
        <form onSubmit={handleRefine} className="space-y-2">
          <Textarea
            placeholder="Optional: describe your refinement (or leave blank to use original prompt)..."
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

      {!refineMode && (
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleRegenerate}
            disabled={disabled}
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            Regenerate
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setRefineMode(true)}
            disabled={disabled}
          >
            <Wand2 className="h-3.5 w-3.5 mr-1.5" />
            Refine on this one
          </Button>
          <Button size="sm" onClick={onApprove} disabled={disabled}>
            <Check className="h-3.5 w-3.5 mr-1.5" />
            Approve
          </Button>
        </div>
      )}
    </div>
  );
}
