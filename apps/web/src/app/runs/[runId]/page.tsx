import Link from "next/link";
import { ArrowLeft } from "lucide-react";

interface Props {
  params: Promise<{ runId: string }>;
}

export default async function RunDetailPage({ params }: Props) {
  const { runId } = await params;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="border-b border-border pb-5 flex items-center gap-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="page-title">Run detail</h1>
          <p className="text-xs font-mono text-muted-foreground mt-0.5">{runId}</p>
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Load this run in the Studio to continue iterating or view its manifest.
      </p>
      <p className="text-xs font-mono text-muted-foreground">
        API: <code>GET /runs/{runId}</code> &mdash; returns the Genblaze{" "}
        <code>Run</code> model with all step assets and the manifest key.
      </p>
    </div>
  );
}
