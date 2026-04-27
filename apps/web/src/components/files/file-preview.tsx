"use client";

import { useEffect, useState } from "react";
import { Braces, Play as PlayIcon } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, getAssetUrl, getFilePreviewUrl } from "@/lib/api-client";
import type { FileEntry } from "@genblaze-gmicloud-pipeline/shared";

import { ImageViewer } from "./viewers/image-viewer";
import { JsonViewer } from "./viewers/json-viewer";
import { VideoViewer } from "./viewers/video-viewer";

interface FilePreviewProps {
  file: FileEntry | null;
  /** Optional manifest that belongs to the same run as `file`. When provided,
   * the modal renders with Media/Manifest tabs so the provenance for a
   * pipeline output sits one click away. */
  manifestFile?: FileEntry | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ViewerKind = "image" | "video" | "json" | "unsupported";

function kindFor(file: FileEntry): ViewerKind {
  const ct = file.content_type;
  if (ct.startsWith("image/")) return "image";
  if (ct.startsWith("video/")) return "video";
  if (ct === "application/json" || file.key.toLowerCase().endsWith(".json")) return "json";
  return "unsupported";
}

// Per-viewer modal sizing. DialogContent ships a default `sm:max-w-lg` (512px)
// that is active on every desktop screen; the `sm:` prefix on these overrides
// is what lets them actually win at ≥640px. Without it, twMerge treats the
// two classes as different variants and keeps both, so desktop stays clamped.
// Media gets a generous horizontal budget (object-contain inside handles
// portrait ratios); JSON stays narrower since wide reading columns for
// serialized text hurt more than they help.
const DIALOG_CLASS_BY_KIND: Record<ViewerKind, string> = {
  image: "w-[96vw] sm:max-w-[min(96vw,1400px)] max-h-[94vh] overflow-y-auto",
  video: "w-[96vw] sm:max-w-[min(96vw,1400px)] max-h-[94vh] overflow-y-auto",
  json: "w-[96vw] sm:max-w-[min(96vw,960px)] max-h-[94vh] overflow-y-auto",
  unsupported: "sm:max-w-md",
};

export function FilePreview({ file, manifestFile, open, onOpenChange }: FilePreviewProps) {
  const [url, setUrl] = useState<string | null>(null);
  const [urlError, setUrlError] = useState<string | null>(null);

  useEffect(() => {
    if (!file || !open) return;
    let cancelled = false;
    // External-system sync (presigned URL fetch); reset before the request
    // lands so a re-open on a new file doesn't flash the previous URL.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setUrl(null);
    setUrlError(null);
    getFilePreviewUrl(file.key)
      .then(({ url }) => {
        if (!cancelled) setUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setUrlError(err instanceof ApiError ? err.message : "Failed to load preview URL");
      });
    return () => {
      cancelled = true;
    };
  }, [file, open]);

  if (!file) return null;

  const kind = kindFor(file);
  const needsUrl = kind === "image" || kind === "video" || kind === "json";
  const ready = !!url && !urlError;
  const showTabs = !!manifestFile && (kind === "image" || kind === "video");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={DIALOG_CLASS_BY_KIND[kind]}>
        <DialogHeader>
          <DialogTitle className="truncate pr-8">{file.filename}</DialogTitle>
          <DialogDescription className="truncate font-mono text-xs">
            {file.key}
          </DialogDescription>
        </DialogHeader>

        {urlError ? (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
            {urlError}
          </div>
        ) : needsUrl && !ready ? (
          <div className="space-y-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-4 w-1/3" />
          </div>
        ) : showTabs && url && manifestFile ? (
          <Tabs defaultValue="media">
            <TabsList>
              <TabsTrigger value="media">
                {kind === "video" ? (
                  <PlayIcon className="h-3.5 w-3.5" />
                ) : (
                  <PlayIcon className="h-3.5 w-3.5" />
                )}
                Media
              </TabsTrigger>
              <TabsTrigger value="manifest">
                <Braces className="h-3.5 w-3.5" />
                Manifest
              </TabsTrigger>
            </TabsList>
            <TabsContent value="media">
              {kind === "image" ? (
                <ImageViewer file={file} url={url} />
              ) : (
                <VideoViewer file={file} url={url} />
              )}
            </TabsContent>
            <TabsContent value="manifest">
              {/* Radix unmounts inactive tab content by default, so the manifest
                  fetch is lazy — only fires the first time the user switches. */}
              <JsonViewer file={manifestFile} downloadUrl={getAssetUrl(manifestFile.key)} />
            </TabsContent>
          </Tabs>
        ) : kind === "image" && url ? (
          <ImageViewer file={file} url={url} />
        ) : kind === "video" && url ? (
          <VideoViewer file={file} url={url} />
        ) : kind === "json" && url ? (
          <JsonViewer file={file} downloadUrl={url} />
        ) : (
          <UnsupportedViewer file={file} url={url} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function UnsupportedViewer({ file, url }: { file: FileEntry; url: string | null }) {
  return (
    <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
      <p className="font-medium text-foreground">Preview not available</p>
      <p className="mt-1">{file.content_type}</p>
      {url && (
        <a
          href={url}
          download={file.filename}
          className="mt-4 inline-block text-xs font-medium underline underline-offset-4 hover:text-foreground"
        >
          Download instead
        </a>
      )}
    </div>
  );
}
