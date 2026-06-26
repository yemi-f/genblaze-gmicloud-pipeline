// Model registry. Maps GMI Cloud model ids to display label, provider,
// and a one-line hint. The model id strings are forwarded verbatim to
// GMI Cloud's case-sensitive queue (verified against the live catalog),
// so this is the canonical source of truth for the UI.

export interface ModelInfo {
  id: string;
  label: string;
  provider: string;
  /** Provider tone — drives the badge color. Maps to a token in CSS. */
  tone: "cyan" | "blue" | "violet" | "amber" | "green";
  /** One-line capability hint shown next to the model. */
  hint: string;
}

export const IMAGE_MODELS: ModelInfo[] = [
  {
    id: "seedream-5.0-lite",
    label: "Seedream 5.0 Lite",
    provider: "ByteDance",
    tone: "cyan",
    hint: "Fast text-to-image, photorealistic.",
  },
  {
    id: "gemini-2.5-flash-image",
    label: "Gemini 2.5 Flash Image",
    provider: "Google",
    tone: "blue",
    hint: "Strong prompt adherence, broad style range.",
  },
  {
    id: "gemini-3.1-flash-image-preview",
    label: "Gemini 3.1 Flash Image Preview",
    provider: "Google",
    tone: "blue",
    hint: "Generates and edits images from text and image inputs with fast speed and balanced cost ",
  },
  {
    id: "gpt-image-2-generate",
    label: "GPT Image 2 Generate",
    provider: "OpenAI",
    tone: "blue",
    hint: "Superior instruction following and accurate text rendering",
  },
  {
    id: "flux-kontext-pro",
    label: "FLUX Kontext Pro",
    provider: "Black Forest Labs",
    tone: "violet",
    hint: "High-fidelity, painterly tendencies.",
  },
  {
    id: "reve-edit-fast-20251030",
    label: "Reve Edit Fast",
    provider: "Reve",
    tone: "amber",
    hint: "Edit-on-image, low-latency iteration.",
  },
];

export const VIDEO_MODELS: ModelInfo[] = [
  {
    id: "Kling-Image2Video-V2.1-Master",
    label: "Kling V2.1 Master",
    provider: "Kuaishou",
    tone: "violet",
    hint: "Cinematic motion, strong subject coherence.",
  },
  {
    id: "wan2.6-i2v",
    label: "Wan 2.6 I2V",
    provider: "Alibaba",
    tone: "amber",
    hint: "Natural physics, rich textures.",
  },
  {
    id: "pixverse-v5.6-i2v",
    label: "PixVerse v5.6",
    provider: "PixVerse",
    tone: "cyan",
    hint: "Stylized motion, fast turn-around.",
  },
];

const ALL = [...IMAGE_MODELS, ...VIDEO_MODELS];

/** Resolve a model id to its registry entry, falling back to a label-only stub. */
export function lookupModel(id: string | null | undefined): ModelInfo {
  if (!id) return { id: "", label: "—", provider: "", tone: "blue", hint: "" };
  return (
    ALL.find((m) => m.id === id) ?? {
      id,
      label: id,
      provider: "GMI Cloud",
      tone: "blue",
      hint: "",
    }
  );
}
