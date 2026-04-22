"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { AspectRatio } from "@genblaze-gmicloud-pipeline/shared";

const IMAGE_MODELS = [
  { value: "Seedream-5.0-Lite", label: "Seedream 5.0 Lite" },
  { value: "FLUX-Kontext-Pro", label: "FLUX Kontext Pro" },
];

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
  const [imageModel, setImageModel] = useState("Seedream-5.0-Lite");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    onSubmit(prompt.trim(), seed, aspectRatio, imageModel);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-border p-5">
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
            <SelectTrigger id="model" className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IMAGE_MODELS.map((m) => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
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

      <div className="flex gap-2">
        <Button type="submit" disabled={disabled || !prompt.trim()}>
          {disabled ? "Generating..." : "Generate"}
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
