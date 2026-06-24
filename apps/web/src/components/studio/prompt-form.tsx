"use client";

import { useRef, useState } from "react";
import { ImageIcon, X } from "lucide-react";
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
import { uploadReferenceImage } from "@/lib/api-client";
import type { AspectRatio } from "@genblaze-gmicloud-pipeline/shared";

interface PromptFormProps {
  onSubmit: (
    prompt: string,
    seed: number,
    aspectRatio: AspectRatio,
    imageModel: string,
    referenceImageKey?: string,
  ) => void;
  disabled?: boolean;
  onReset?: () => void;
}

export function PromptForm({ onSubmit, disabled, onReset }: PromptFormProps) {
  const [prompt, setPrompt] = useState("");
  const [seed, setSeed] = useState(42);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [imageModel, setImageModel] = useState(IMAGE_MODELS[0].id);
  const [referencePreview, setReferencePreview] = useState<string | null>(null);
  const [referenceKey, setReferenceKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedModel = lookupModel(imageModel);

  async function handleReferenceFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    setReferencePreview(URL.createObjectURL(file));
    setReferenceKey(null);
    setUploading(true);
    try {
      const { key } = await uploadReferenceImage(file);
      setReferenceKey(key);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
      setReferencePreview(null);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearReference() {
    setReferencePreview(null);
    setReferenceKey(null);
    setUploadError(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim() || uploading) return;
    onSubmit(prompt.trim(), seed, aspectRatio, imageModel, referenceKey ?? undefined);
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

      {/* Reference image upload */}
      <div className="space-y-1.5">
        <Label>Style reference <span className="text-muted-foreground font-normal">(optional)</span></Label>
        {referencePreview ? (
          <div className="flex items-start gap-3">
            <div className="relative w-16 h-16 rounded-md overflow-hidden border border-border shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={referencePreview} alt="Style reference" className="w-full h-full object-cover" />
              {uploading && (
                <div className="absolute inset-0 bg-background/70 flex items-center justify-center">
                  <GeneratingLoader size="sm" />
                </div>
              )}
            </div>
            <div className="flex flex-col gap-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                {uploading ? "Uploading…" : uploadError ? (
                  <span className="text-destructive">{uploadError}</span>
                ) : (
                  <span className="text-green-600 dark:text-green-400">Uploaded — will be passed as style reference</span>
                )}
              </p>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs w-fit"
                onClick={clearReference}
                disabled={disabled}
              >
                <X className="w-3 h-3 mr-1" /> Remove
              </Button>
            </div>
          </div>
        ) : (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleReferenceFile}
              disabled={disabled}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 gap-1.5"
              onClick={() => fileInputRef.current?.click()}
              disabled={disabled}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              Upload reference image
            </Button>
            {uploadError && <p className="mt-1 text-xs text-destructive">{uploadError}</p>}
          </div>
        )}
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
        <Button type="submit" disabled={disabled || !prompt.trim() || uploading}>
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
          <Button type="button" variant="ghost" onClick={() => { clearReference(); onReset(); }} disabled={disabled}>
            Reset
          </Button>
        )}
      </div>
    </form>
  );
}
