"use client";

import { useMemo, useState } from "react";
import { Film, Image as ImageIcon, Play, RefreshCw, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { getAssetUrl } from "@/lib/api-client";
import { manifestKeyFor } from "@/lib/run-paths";
import type { FileEntry } from "@genblaze-gmicloud-pipeline/shared";

import { FilePreview } from "./file-preview";

interface MediaGalleryProps {
  files: FileEntry[];
  loading: boolean;
  onRefresh: () => void;
}

function isMedia(file: FileEntry): boolean {
  return file.content_type.startsWith("image/") || file.content_type.startsWith("video/");
}

export function MediaGallery({ files, loading, onRefresh }: MediaGalleryProps) {
  const [selected, setSelected] = useState<FileEntry | null>(null);

  const mediaFiles = useMemo(
    () =>
      files
        .filter(isMedia)
        .slice()
        .sort(
          (a, b) =>
            new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime(),
        ),
    [files],
  );

  // Look up the matching manifest.json in the same run folder (if present).
  // Passing it to FilePreview enables the Manifest tab.
  const manifestFor = (file: FileEntry): FileEntry | null => {
    const key = manifestKeyFor(file.key);
    if (!key) return null;
    return files.find((f) => f.key === key) ?? null;
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--attention,theme(colors.amber.500))]" />
            <CardTitle className="text-sm font-semibold">Generated outputs</CardTitle>
            <span className="text-xs text-muted-foreground">
              {loading ? "…" : `${mediaFiles.length} ${mediaFiles.length === 1 ? "asset" : "assets"}`}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            className="h-7 text-xs"
          >
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="p-4">
          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square w-full" />
              ))}
            </div>
          ) : mediaFiles.length === 0 ? (
            <EmptyState
              icon={ImageIcon}
              title="No generated media yet"
              description="Start a run from Studio — images and videos will appear here as they land in the bucket."
            />
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {mediaFiles.map((file) => (
                <MediaTile
                  key={file.key}
                  file={file}
                  onOpen={() => setSelected(file)}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <FilePreview
        file={selected}
        manifestFile={selected ? manifestFor(selected) : null}
        open={!!selected}
        onOpenChange={(open) => !open && setSelected(null)}
      />
    </>
  );
}

function MediaTile({ file, onOpen }: { file: FileEntry; onOpen: () => void }) {
  const isVideo = file.content_type.startsWith("video/");
  const src = getAssetUrl(file.key);

  return (
    <button
      onClick={onOpen}
      onDoubleClick={onOpen}
      type="button"
      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted/40 text-left transition-all hover:-translate-y-0.5 hover:border-foreground/30 hover:shadow-md"
      title={file.filename}
    >
      {/* Thumbnail surface. <video preload="metadata"> renders the first frame
          as a poster without downloading the full payload. */}
      {isVideo ? (
        <video
          src={src}
          preload="metadata"
          muted
          playsInline
          className="h-full w-full object-cover"
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={file.filename}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
        />
      )}

      {/* Type badge, top-right */}
      <span className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
        {isVideo ? (
          <>
            <Film className="h-3 w-3" />
            MP4
          </>
        ) : (
          <>
            <ImageIcon className="h-3 w-3" />
            IMG
          </>
        )}
      </span>

      {/* Play-button overlay for videos */}
      {isVideo && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center opacity-80 transition-opacity group-hover:opacity-100">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 backdrop-blur-sm">
            <Play className="h-5 w-5 fill-white text-white" />
          </span>
        </span>
      )}

      {/* Filename gradient strip, bottom */}
      <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-2 text-[11px] font-medium text-white">
        <span className="block truncate">{file.filename}</span>
      </span>
    </button>
  );
}
