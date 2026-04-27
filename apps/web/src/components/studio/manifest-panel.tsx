"use client";

import { useState } from "react";
import { ShieldCheck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { GeneratingLoader } from "@/components/ui/generating-loader";
import { getManifest } from "@/lib/api-client";

interface ManifestPanelProps {
  runId: string;
  manifestKey: string;
  canonicalHash?: string;
}

export function ManifestPanel({ runId, manifestKey, canonicalHash }: ManifestPanelProps) {
  const [verified, setVerified] = useState<boolean | null>(null);
  const [verifying, setVerifying] = useState(false);

  async function handleVerify() {
    setVerifying(true);
    try {
      const manifest = await getManifest(runId);
      // A canonical hash in the manifest matches what the API reported
      setVerified(manifest.canonical_hash === canonicalHash);
    } catch {
      setVerified(false);
    } finally {
      setVerifying(false);
    }
  }

  return (
    <div className="rounded-xl border border-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">Manifest</span>
      </div>

      {canonicalHash && (
        <div className="space-y-0.5">
          <p className="text-xs text-muted-foreground">Canonical hash</p>
          <p className="text-xs font-mono break-all">{canonicalHash}</p>
        </div>
      )}

      <div className="space-y-0.5">
        <p className="text-xs text-muted-foreground">B2 key</p>
        <p className="text-xs font-mono break-all">{manifestKey}</p>
      </div>

      <div className="flex gap-2">
        <Button
          size="sm"
          variant="outline"
          onClick={handleVerify}
          disabled={verifying}
        >
          {verifying ? (
            <span className="inline-flex items-center gap-1.5">
              <GeneratingLoader size="sm" />
              Verifying...
            </span>
          ) : (
            "Verify hash"
          )}
        </Button>
        <Button size="sm" variant="ghost" asChild>
          <a href={`/api/runs/${runId}/manifest`} target="_blank" rel="noopener noreferrer">
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            View manifest
          </a>
        </Button>
      </div>

      {verified === true && (
        <p className="text-xs text-green-600 dark:text-green-400">Hash verified — manifest is intact.</p>
      )}
      {verified === false && (
        <p className="text-xs text-red-600 dark:text-red-400">Hash mismatch — manifest may have been modified.</p>
      )}
    </div>
  );
}
