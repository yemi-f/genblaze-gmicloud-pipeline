import type {
  ApproveRequest,
  IterateRequest,
  Run,
  RunRequest,
  StreamEvent,
} from "@genblaze-gmicloud-pipeline/shared";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** Typed API error with HTTP status code for caller-side branching. */
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isRetryable(): boolean {
    return [408, 429, 500, 502, 503, 504].includes(this.status);
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }
}

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, init);
  } catch {
    throw new ApiError("Network error — check your connection", 0);
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(body.detail || `API error: ${res.status}`, res.status);
  }
  return res.json();
}

export async function getHealth() {
  return apiFetch<{ status: string; b2_connected: boolean; gmi_key_present: boolean }>("/health");
}

export async function getRun(runId: string) {
  return apiFetch<Run>(`/runs/${runId}`);
}

export async function getManifest(runId: string) {
  return apiFetch<Record<string, unknown>>(`/runs/${runId}/manifest`);
}

/** Returns a redirect-resolved asset URL for UI playback (presigned, short-lived). */
export function getAssetUrl(b2Key: string): string {
  return `${API_BASE}/assets/${b2Key}`;
}

/**
 * Opens an SSE POST to the given path. Calls onEvent per JSON line,
 * onDone when the stream closes (with the X-Run-Id header value).
 * Returns an AbortController for early cancellation.
 */
export function streamPost(
  path: string,
  body: unknown,
  onEvent: (event: StreamEvent) => void,
  onDone?: (runId: string | null) => void,
  onError?: (err: Error) => void,
): AbortController {
  const ctrl = new AbortController();

  (async () => {
    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: ctrl.signal,
      });
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}));
        throw new ApiError(msg.detail || `API error: ${res.status}`, res.status);
      }
      const runId = res.headers.get("x-run-id");
      const reader = res.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              onEvent(JSON.parse(line.slice(6)));
            } catch {
              // skip malformed event lines
            }
          }
        }
      }
      onDone?.(runId);
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return ctrl;
}

/** Start a first-generation image run. */
export function startRun(
  req: RunRequest,
  onEvent: (event: StreamEvent) => void,
  onDone?: (runId: string | null) => void,
  onError?: (err: Error) => void,
) {
  return streamPost("/runs/stream", req, onEvent, onDone, onError);
}

/** Fork from a prior run (text regen or image-as-reference). */
export function iterateRun(
  parentId: string,
  req: IterateRequest,
  onEvent: (event: StreamEvent) => void,
  onDone?: (runId: string | null) => void,
  onError?: (err: Error) => void,
) {
  return streamPost(`/runs/${parentId}/iterate/stream`, req, onEvent, onDone, onError);
}

/** Fan out to video models from an approved image. */
export function approveRun(
  parentId: string,
  req: ApproveRequest,
  onEvent: (event: StreamEvent) => void,
  onDone?: (runId: string | null) => void,
  onError?: (err: Error) => void,
) {
  return streamPost(`/runs/${parentId}/approve/stream`, req, onEvent, onDone, onError);
}
