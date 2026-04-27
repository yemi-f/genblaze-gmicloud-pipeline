import { GeneratingLoader } from "@/components/ui/generating-loader";

// Unlinked preview page for the blaze loader. Visit /design/loader directly.
// Renders every size on the surfaces it actually appears on so you can
// eyeball motion, color, and contrast without kicking off a real run.
export default function LoaderPreviewPage() {
  return (
    <div className="space-y-8 max-w-3xl">
      <div className="animate-fade-in border-b border-border pb-5">
        <h1 className="page-title">Blaze Loader</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Sweep arc + rising scanlines + center pulse + radar (lg only).
          Anchored on <code className="font-mono">#D30035</code>.
        </p>
      </div>

      {/* sm — inline in buttons */}
      <section className="space-y-3">
        <h2 className="card-title">sm — inline (button)</h2>
        <div className="flex items-center gap-3 rounded-xl border border-border p-5">
          <button
            type="button"
            disabled
            className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            <GeneratingLoader size="sm" />
            Generating...
          </button>
        </div>
      </section>

      {/* md — video tile placeholder */}
      <section className="space-y-3">
        <h2 className="card-title">md — video tile</h2>
        <div className="grid grid-cols-3 gap-4 rounded-xl border border-border p-5">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-border bg-muted/30 p-3 space-y-2">
              <p className="text-xs font-semibold">Model {i + 1}</p>
              <div className="flex items-center justify-center w-full aspect-video rounded-md bg-muted">
                <GeneratingLoader size="md" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* lg — canvas placeholder, no label */}
      <section className="space-y-3">
        <h2 className="card-title">lg — canvas placeholder</h2>
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center justify-center rounded-xl border border-border bg-muted/30 aspect-video">
            <GeneratingLoader size="lg" />
          </div>
        </div>
      </section>

      {/* lg with label — first-gen state */}
      <section className="space-y-3">
        <h2 className="card-title">lg — with label</h2>
        <div className="rounded-xl border border-border p-5">
          <div className="flex items-center justify-center rounded-xl border border-border bg-muted/30 aspect-video">
            <GeneratingLoader size="lg" label="Calling GMI Cloud..." />
          </div>
        </div>
      </section>

      {/* md over scrim — iteration overlay */}
      <section className="space-y-3">
        <h2 className="card-title">md over scrim — iterating on existing image</h2>
        <div className="rounded-xl border border-border p-5">
          <div className="relative w-full overflow-hidden rounded-lg aspect-video bg-gradient-to-br from-slate-700 via-slate-800 to-slate-900">
            <div className="absolute inset-0 flex items-center justify-center blaze-scrim">
              <GeneratingLoader size="md" label="Refining..." />
            </div>
          </div>
        </div>
      </section>

      {/* stars variant — md and lg side by side (flames is the default,
          so unlabeled sections above show flames). */}
      <section className="space-y-3">
        <h2 className="card-title">variant=&quot;stars&quot;</h2>
        <div className="grid sm:grid-cols-2 gap-4 rounded-xl border border-border p-5">
          <div className="flex items-center justify-center rounded-lg border border-border bg-muted/30 aspect-video">
            <GeneratingLoader size="md" variant="stars" />
          </div>
          <div className="flex items-center justify-center rounded-lg border border-border bg-muted/30 aspect-video">
            <GeneratingLoader size="lg" variant="stars" label="Calling GMI Cloud..." />
          </div>
        </div>
      </section>
    </div>
  );
}
