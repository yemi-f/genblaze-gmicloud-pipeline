"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { GeneratingLoader } from "@/components/ui/generating-loader";
import { StatusPill } from "@/components/ui/status-pill";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { IMAGE_MODELS, lookupModel } from "@/lib/models";
import type { AspectRatio } from "@genblaze-gmicloud-pipeline/shared";

interface PromptFormProps {
  onSubmit: (
    prompt: string,
    seed: number,
    aspectRatio: AspectRatio,
    imageModel: string,
  ) => void;
  disabled?: boolean;
  onReset?: () => void;
}

export function PromptForm({ onSubmit, disabled, onReset }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState(42);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [imageModel, setImageModel] = useState(IMAGE_MODELS[0].id);

  const selectedModel = lookupModel(imageModel);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSubmit(prompt.trim(), seed, aspectRatio, imageModel);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border p-5">
      {/* Stage header — numbered, with the selected model surfaced as a
          provider badge so the user sees which GMI Cloud model will run. */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">01</span>
          <h2 className="card-title">Compose</h2>
          <StatusPill tone={selectedModel.tone}>{selectedModel.label}</StatusPill>
        </div>
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {selectedModel.hint}
        </span>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="prompt">Prompt</Label>
        <Textarea
          id="prompt"
          placeholder="A cinematic wide shot of a volcanic eruption at sunset..."
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={3}
          disabled={disabled}
          className="resize-none"
        />
      </div>

      <div className="flex flex-wrap gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="model">Image model</Label>
          <Select value={imageModel} onValueChange={setImageModel} disabled={disabled}>
            <SelectTrigger id="model" className="w-[240px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_MODELS.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  <span className="flex items-center gap-2">
                    <span>{m.label}</span>
                    <span className="text-[11px] text-muted-foreground">{m.provider}</span>
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="aspect">Aspect ratio</Label>
          <Select
            value={aspectRatio}
            onValueChange={(v) => setAspectRatio(v as AspectRatio)}
            disabled={disabled}
          >
            <SelectTrigger id="aspect" className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="16:9">16:9</SelectItem>
              <SelectItem value="9:16">9:16</SelectItem>
              <SelectItem value="1:1">1:1</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="seed">Seed</Label>
          <input
            id="seed"
            type="number"
            value={seed}
            onChange={(e) => setSeed(Number(e.target.value))}
            disabled={disabled}
            className="flex h-9 w-24 rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
        </div>
      </div>

      {/* SDK call hint — makes the demo's value prop concrete: the user can
          read exactly which API path streams which Genblaze method against
          which GMI Cloud model. */}
      <div className="rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="text-foreground/80">On submit:</span>{" "}
        <span className="font-mono">POST /runs/stream</span>
        <span className="opacity-60"> → </span>
        <span className="font-mono">genblaze.run(...)</span>
        <span className="opacity-60"> → </span>
        <span className="font-mono">GMI Cloud · {selectedModel.id}</span>
        <span className="opacity-60"> → </span>
        <span>SSE events stream back into the inspector →.</span>
      </div>

      <div className="flex gap-2">
        <Button type="submit" disabled={disabled || !prompt.trim()}>
          {disabled ? (
            <span className="inline-flex items-center gap-2">
              <GeneratingLoader size="sm" />
              Generating...
            </span>
          ) : (
            "Generate"
          )}
        </Button>
        {onReset && (
          <Button type="button" variant="ghost" onClick={onReset} disabled={disabled}>
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
