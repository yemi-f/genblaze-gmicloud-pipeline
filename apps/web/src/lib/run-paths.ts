// Derive the manifest key for a run given any asset key that lives under the
// same run folder. Matches `KeyStrategy.HIERARCHICAL` in genblaze-core:
//   {prefix}/runs/{tenant}/{date}/{run_id}/assets/{asset_id}.{ext}
//   {prefix}/runs/{tenant}/{date}/{run_id}/manifest.json
// Returns null when the key doesn't look like it belongs to a run folder.
export function manifestKeyFor(assetKey: string): string | null {
  const parts = assetKey.split("/");
  if (parts.length < 2) return null;
  parts.pop(); // drop filename
  if (parts[parts.length - 1] === "assets") parts.pop();
  if (parts.length === 0) return null;
  return `${parts.join("/")}/manifest.json`;
}
