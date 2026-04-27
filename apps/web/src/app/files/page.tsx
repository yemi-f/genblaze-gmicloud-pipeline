"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { FileBrowser } from "@/components/files/file-browser";
import { MediaGallery } from "@/components/files/media-gallery";
import { ApiError, listFiles } from "@/lib/api-client";
import type { FileEntry } from "@genblaze-gmicloud-pipeline/shared";

export default function FilesPage() {
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchFiles = useCallback(() => {
    setLoading(true);
    listFiles()
      .then(setFiles)
      .catch((err) => {
        setFiles([]);
        const detail = err instanceof ApiError ? err.message : "Failed to load files";
        toast.error(detail);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // Initial fetch — the rule objects because fetchFiles() toggles setLoading
    // synchronously, but this is an external-system sync (remote bucket listing).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFiles();
  }, [fetchFiles]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Files</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            Browse the pipeline&rsquo;s B2 bucket — manifests and generated
            assets from every run land here.
          </p>
        </div>
      </div>
      <MediaGallery files={files} loading={loading} onRefresh={fetchFiles} />
      <FileBrowser files={files} loading={loading} onRefresh={fetchFiles} />
    </div>
  );
}
