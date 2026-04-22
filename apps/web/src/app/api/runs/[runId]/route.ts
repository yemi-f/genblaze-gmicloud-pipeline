import { NextRequest, NextResponse } from "next/server";

// Proxy GET /api/runs/{runId} → FastAPI GET /runs/{runId}
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const upstream = await fetch(`${API_BASE}/runs/${runId}`, {
    headers: { "Content-Type": "application/json" },
  });
  const data = await upstream.json();
  return NextResponse.json(data, { status: upstream.status });
}
