"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Braces,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Download,
  FileWarning,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, getFileContent } from "@/lib/api-client";
import type { FileEntry } from "@genblaze-gmicloud-pipeline/shared";

interface JsonViewerProps {
  file: FileEntry;
  /** Presigned URL, used as the Download target. Content is fetched via the API proxy. */
  downloadUrl: string;
}

export function JsonViewer({ file, downloadUrl }: JsonViewerProps) {
  const [rawText, setRawText] = useState<string | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getFileContent(file.key)
      .then((text) => {
        if (cancelled) return;
        setRawText(text);
        try {
          JSON.parse(text);
          setParseError(null);
        } catch (err) {
          setParseError((err as Error).message);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setParseError(err instanceof ApiError ? err.message : "Failed to fetch content");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [file.key]);

  const parsed = useMemo(() => {
    if (!rawText || parseError) return null;
    try {
      return JSON.parse(rawText);
    } catch {
      return null;
    }
  }, [rawText, parseError]);

  const manifestHash = useMemo(() => {
    if (!parsed || typeof parsed !== "object") return null;
    const v = (parsed as Record<string, unknown>).canonical_hash;
    return typeof v === "string" ? v : null;
  }, [parsed]);

  const copyAll = async () => {
    if (!rawText) return;
    await navigator.clipboard.writeText(rawText);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="space-y-3">
      {/* Manifest-aware pill — surfaces the provenance hash at a glance when present */}
      {manifestHash && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs">
          <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
          <span className="font-medium">Manifest</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-muted-foreground">SHA-256</span>
          <code className="rounded bg-background px-1.5 py-0.5 font-mono text-[11px]">
            {manifestHash.slice(0, 16)}…{manifestHash.slice(-8)}
          </code>
        </div>
      )}

      {/* Tree surface */}
      <div
        className="overflow-auto rounded-lg border border-border bg-muted/30 p-4 font-mono text-xs"
        style={{ maxHeight: "62vh" }}
      >
        {loading ? (
          <div className="space-y-1.5">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-3 w-full" />
            ))}
          </div>
        ) : parseError ? (
          <div className="flex items-start gap-2 text-destructive">
            <FileWarning className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-medium">Could not parse JSON</p>
              <p className="mt-1 break-all text-xs opacity-80">{parseError}</p>
              {rawText && (
                <pre className="mt-3 whitespace-pre-wrap text-[11px] text-foreground/80">
                  {rawText.slice(0, 2000)}
                  {rawText.length > 2000 ? "\n…" : ""}
                </pre>
              )}
            </div>
          </div>
        ) : parsed !== null ? (
          <JsonNode value={parsed} name="" isLast />
        ) : null}
      </div>

      {/* Footer metadata + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
          <span className="flex items-center gap-1">
            <Braces className="h-3 w-3" />
            JSON
          </span>
          <span className="font-mono tabular-nums">{file.size_human}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs"
            onClick={copyAll}
            disabled={!rawText}
          >
            {copied ? (
              <Check className="mr-1 h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="mr-1 h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy all"}
          </Button>
          <Button asChild size="sm" className="h-7 text-xs">
            <a href={downloadUrl} download={file.filename}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Download
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- */
/*  Recursive tree node                                                       */
/* ------------------------------------------------------------------------- */

interface JsonNodeProps {
  name: string | number;
  value: unknown;
  isLast: boolean;
}

function JsonNode({ name, value, isLast }: JsonNodeProps) {
  const isContainer = value !== null && typeof value === "object";
  // Containers expand by default — users scroll through the tree and collapse
  // individual subtrees they want out of the way rather than hunting for a
  // "expand all" control.
  const [open, setOpen] = useState(isContainer);

  if (!isContainer) {
    return (
      <div className="flex items-start leading-5">
        {name !== "" && <JsonKey name={name} />}
        <JsonPrimitive value={value} />
        {!isLast && <span className="text-muted-foreground">,</span>}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i, v] as const)
    : Object.entries(value as Record<string, unknown>);
  const openBracket = isArray ? "[" : "{";
  const closeBracket = isArray ? "]" : "}";

  return (
    <div className="leading-5">
      <div
        className="flex cursor-pointer items-start rounded hover:bg-accent/50"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="inline-flex h-5 w-4 items-center justify-center text-muted-foreground">
          {open ? (
            <ChevronDown className="h-3 w-3" />
          ) : (
            <ChevronRight className="h-3 w-3" />
          )}
        </span>
        {name !== "" && <JsonKey name={name} />}
        {open ? (
          <span className="text-muted-foreground">{openBracket}</span>
        ) : (
          <span className="text-muted-foreground">
            {openBracket}
            <span className="mx-1 text-muted-foreground/70">
              {entries.length} {isArray ? "items" : "keys"}
            </span>
            {closeBracket}
            {!isLast && ","}
          </span>
        )}
      </div>
      {open && (
        <>
          <div className="ml-2 border-l border-border pl-3">
            {entries.map(([k, v], i) => (
              <JsonNode
                key={String(k)}
                name={k}
                value={v}
                isLast={i === entries.length - 1}
              />
            ))}
          </div>
          <div className="ml-4 text-muted-foreground">
            {closeBracket}
            {!isLast && ","}
          </div>
        </>
      )}
    </div>
  );
}

function JsonKey({ name }: { name: string | number }) {
  const display = typeof name === "string" ? `"${name}"` : String(name);
  return (
    <span className="mr-1 shrink-0 text-blue-600 dark:text-blue-400">
      {display}
      <span className="text-muted-foreground">: </span>
    </span>
  );
}

function JsonPrimitive({ value }: { value: unknown }) {
  if (value === null) return <span className="text-muted-foreground">null</span>;
  if (typeof value === "string")
    return (
      <span className="break-all text-emerald-600 dark:text-emerald-400">
        &quot;{value}&quot;
      </span>
    );
  if (typeof value === "number")
    return <span className="text-amber-600 dark:text-amber-400">{String(value)}</span>;
  if (typeof value === "boolean")
    return (
      <span className="text-violet-600 dark:text-violet-400">{String(value)}</span>
    );
  return <span className="text-foreground">{String(value)}</span>;
}
