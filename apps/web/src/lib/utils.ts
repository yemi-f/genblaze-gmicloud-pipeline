import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function humanizeBytes(bytes: number) {
  for (const unit of ["B", "KB", "MB", "GB"]) {
    if (Math.abs(bytes) < 1024) {
      // No decimals for bytes, one decimal for larger units
      return unit === "B"
        ? `${Math.round(bytes)} ${unit}`
        : `${bytes.toFixed(1)} ${unit}`;
    }
    bytes /= 1024;
  }
  return `${bytes.toFixed(1)} TB`;
}

export function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Diff two ISO timestamps and render as "780 ms" / "12.4s" / "1m 03s". */
export function humanizeDuration(startIso?: string | null, endIso?: string | null) {
  if (!startIso || !endIso) return null;
  const ms = Date.parse(endIso) - Date.parse(startIso);
  if (!Number.isFinite(ms) || ms < 0) return null;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rs = Math.round(s - m * 60);
  return `${m}m ${rs.toString().padStart(2, "0")}s`;
}
