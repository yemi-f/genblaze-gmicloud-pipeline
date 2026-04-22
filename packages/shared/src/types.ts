// Shared types mirroring Genblaze's own models (Run, Step, Asset) and
// the three request bodies the API accepts.

export type AspectRatio = "16:9" | "9:16" | "1:1";

export type RunStatus = "pending" | "running" | "succeeded" | "failed";
export type StepStatus = "pending" | "running" | "succeeded" | "failed";

// Mirrors genblaze_core.models.Asset
export interface Asset {
  step_id: string;
  media_type: string;
  url: string;         // durable (non-presigned) — use /assets/{key} for playback
  b2_key: string;
  sha256: string;
  cost_usd: number | null;
}

// Mirrors genblaze_core.models.Step
export interface Step {
  id: string;
  index: number;
  model: string;
  status: StepStatus;
  prompt: string | null;
  assets: Asset[];
  progress: number | null;
  elapsed_sec: number | null;
  cost_usd: number | null;
}

// Mirrors genblaze_core.models.Run
export interface Run {
  id: string;
  name: string;
  status: RunStatus;
  prompt: string;
  seed: number | null;
  aspect_ratio: AspectRatio;
  steps: Step[];
  manifest_key: string | null;
  canonical_hash: string | null;
  parent_run_id: string | null;
}

// SSE stream event (mirrors genblaze_core.observability.events.StreamEvent.to_dict())
export interface StreamEvent {
  type: string;
  run_id: string;
  step_index?: number;
  payload: Record<string, unknown>;
}

// Request bodies
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
