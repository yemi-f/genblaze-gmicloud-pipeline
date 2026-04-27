# GeneratingLoader ("blaze pulse")

Self-contained "something is generating" indicator. A perforated rotating dot ring at the perimeter, with a flame field (vertical scanlines in mixed reds/ambers/yellows) or AI sparkles (4-point stars popping in/rotating/vanishing) at the center.

## Usage

```tsx
import { GeneratingLoader } from "@/components/ui/generating-loader";

<GeneratingLoader size="lg" />                           // flame field (default)
<GeneratingLoader size="lg" variant="stars" />           // AI sparkles instead
<GeneratingLoader size="lg" label="Calling GMI Cloud" /> // shimmer label
<GeneratingLoader size="md" />                           // video tile placeholder
<GeneratingLoader size="sm" />                           // inline in buttons
```

`size`: `"sm" | "md" | "lg"` (default `"md"`) — 16 / 48 / 96 px.
`variant`: `"flames" | "stars"` (default `"flames"`). Ignored at `sm` (which always renders a single rotating sparkle since the field compositions don't read at 16 px).
`label`: optional shimmer caption rendered below the orb.
`className`: extends the outer wrapper.

There's also a sibling utility class `.blaze-scrim` for when you want to overlay the loader on an existing image while it's being refined:

```tsx
<div className="absolute inset-0 flex items-center justify-center blaze-scrim">
  <GeneratingLoader size="md" label="Refining..." />
</div>
```

## Drop-in to another app

Both files in this folder (`index.tsx`, `styles.css`) are everything the loader needs. Copy the folder to `apps/web/src/components/ui/generating-loader/` in the target app — that's it. The component imports its own CSS, so nothing has to be added to the target app's `globals.css`.

Requirements in the target app:
- A `cn` helper at `@/lib/utils` (the standard shadcn one — `clsx` + `tailwind-merge`).
- Three theme CSS variables in the target app's `globals.css`: `--muted-foreground`, `--foreground`, `--background`. These ship by default in any shadcn-based theme.
- React 18+ and a CSS-in-JS / CSS imports setup (Next.js handles this natively).

The brand palette (`--blaze-red` / `--blaze-orange` / `--blaze-amber` / `--blaze-yellow`) is scoped to `.blaze-orb` inside `styles.css` — it does *not* leak to the host app, and the host doesn't need to define it.

## What's inside

- `index.tsx` — component, props, scanline + sparkle presets per size, four-point sparkle SVG.
- `styles.css` — keyframes + `.blaze-*` classes. Imported by `index.tsx`; ships only when the component is used.

## Tuning

Common knobs are at the top of `index.tsx`:

- `DIM` — perforated ring geometry (dot count, orbit radius, dot size) per size.
- `SCANLINES_MD` / `SCANLINES_LG` — flame line presets. Each entry: `{ dur, delay, x, color, o }`.
- `SPARKLES_MD` / `SPARKLES_LG` — sparkle presets. The first entry of each is the "hero" sparkle (≈1/5 of the orb diameter).

Animation speeds and the warm palette live in `styles.css` near the keyframe definitions.

## Accessibility

The loader exposes `role="status"` and `aria-live="polite"`. When `label` is provided, it's used as the `aria-label`; otherwise the default "Generating" is announced. All decorative DOM is `aria-hidden`. A `prefers-reduced-motion: reduce` media query pauses every animation while leaving the visuals in place.
