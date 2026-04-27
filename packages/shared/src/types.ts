// Canonical genblaze shapes come from @genblaze/spec — auto-generated from
// the JSON Schemas that are conformance-tested against the Pydantic models.
// Only sample-local types (request bodies, browser DTOs) are hand-rolled.
//
// StreamEvent is a discriminated union (spec 0.3.0+): narrow via `ev.type`
// to get per-variant field types (e.g. StepFailedEvent.error,
// PipelineCompletedEvent.manifest_hash).
export type { Asset, Manifest, Run, Step, StreamEvent } from "@genblaze/spec";

// Narrow string-literal unions for status, used in reducer/JSX switches.
// These mirror the enum inlined in @genblaze/spec's Run.status / Step.status.
export type RunStatus = "pending" | "running" | "completed" | "failed" | "cancelled";
export type StepStatus =
  | "pending"
  | "submitted"
  | "processing"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AspectRatio = "16:9" | "9:16" | "1:1";

// Request bodies — mirror app/types/runs.py
export interface RunRequest {
  prompt: string;
  seed?: number;
  aspect_ratio?: AspectRatio;
  image_model?: string;
}

export interface IterateRequest {
  parent_run_id: string;
  prompt?: string;
  seed?: number;
  reference_asset_key?: string;
  image_model?: string;
}

export interface ApproveRequest {
  run_id: string;
  approved_step_id: string;
  duration_sec?: number;
  video_models?: string[];
}

// File browser entry — mirrors FileEntry from services/api/app/types/files.py
export interface FileEntry {
  key: string;
  filename: string;
  folder: string;
  size_bytes: number;
  size_human: string;
  content_type: string;
  uploaded_at: string;
}
