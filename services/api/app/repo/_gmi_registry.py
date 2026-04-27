"""Local overrides for genblaze-gmicloud's video ModelRegistry.

The library's shared spec assumes uniformity across GMICloud's video models
that doesn't actually hold at the wire layer. This module rebuilds the
registry with the per-model patches needed to match live contracts.

Verified by probing `POST /requests` with empty payloads — the 400 body
names each model's required keys. Drop when the SDK fixes these per-model.
"""

from __future__ import annotations

from functools import lru_cache

from genblaze_core.providers import ModelSpec
from genblaze_gmicloud import GMICloudVideoProvider


# (PascalCase required by GMICloud, lowercase the library chose as canonical)
# The library canonicalizes these to lowercase and rewrites on submit, but
# GMICloud's /models catalog only accepts the PascalCase form → lowercase 404s.
_PASCAL_REQUIRED_VIDEO_IDS: tuple[tuple[str, str], ...] = (
    ("Kling-Image2Video-V2.1-Master", "kling-image2video-v2.1-master"),
)


# Per-model payload contracts discovered via empty-payload probes. The
# library's shared _COMMON_ALLOWLIST uses `image` uniformly, but each model
# actually wants a different key, and some have extra required fields.
#
# Kling V2.1-Master    -> image             (library default is correct)
# Wan 2.6 / 2.7 i2v    -> img_url            (library defaults to image_url)
# PixVerse v5.6 i2v    -> image_url          (library has it allowlisted, but
#                         doesn't translate user `image=` kwargs)
#                       + quality default "720p" (library allowlists in 0.2.5
#                         but doesn't pick a default value)
#                       + duration as string enum "5"/"8"/"10" (library
#                         coerces to int by default → 400)
_PIXVERSE_EXTRAS = {
    "defaults": {"quality": "720p"},
    "coercers": {"duration": str},
}
_VIDEO_OVERRIDES: dict[str, dict] = {
    "wan2.6-i2v": {"image_key": "img_url"},
    "wan2.6-r2v": {"image_key": "img_url"},
    "wan2.7-i2v": {"image_key": "img_url"},
    "pixverse-v5.6-i2v": {"image_key": "image_url", **_PIXVERSE_EXTRAS},
    "pixverse-v5.6-t2v": _PIXVERSE_EXTRAS,
}


def _with_image_key(
    base: ModelSpec,
    *,
    image_key: str | None = None,
    extra_allowlist: frozenset[str] = frozenset(),
    defaults: dict | None = None,
    coercers: dict | None = None,
) -> ModelSpec:
    """Copy a ModelSpec, renaming the reference-image param and merging
    extra allowlist entries, defaults, and per-key coercers."""
    allowlist = frozenset(base.param_allowlist or frozenset())
    aliases = dict(base.param_aliases)
    if image_key:
        allowlist = frozenset((allowlist - {"image"}) | {image_key})
        aliases["image"] = image_key
    allowlist = frozenset(allowlist | extra_allowlist)
    merged_defaults = {**(base.param_defaults or {}), **(defaults or {})}
    merged_coercers = {**(base.param_coercers or {}), **(coercers or {})}
    return ModelSpec(
        model_id=base.model_id,
        aliases=base.aliases,
        modality=base.modality,
        pricing=base.pricing,
        param_aliases=aliases,
        param_coercers=merged_coercers,
        param_allowlist=allowlist,
        param_defaults=merged_defaults,
        input_mapping=base.input_mapping,
        extras=base.extras,
    )


@lru_cache(maxsize=1)
def video_registry():
    """Forked registry with per-model slug-case + payload-shape overrides."""
    registry = GMICloudVideoProvider.models_default().fork()

    # (1) Restore PascalCase canonical ids for GMICloud-case-sensitive models.
    for pascal, lower in _PASCAL_REQUIRED_VIDEO_IDS:
        base = registry.get(lower)
        fixed = ModelSpec(
            model_id=pascal,
            aliases=frozenset({lower}),
            modality=base.modality,
            pricing=base.pricing,
            param_aliases=base.param_aliases,
            param_coercers=base.param_coercers,
            param_allowlist=base.param_allowlist,
            input_mapping=base.input_mapping,
            extras=base.extras,
        )
        # Drop the library's stale lowercase default so our alias can win the
        # lookup (register() only writes to _user; _defaults wins first-match).
        registry._defaults.pop(lower, None)
        registry.register(fixed)

    # (2) Apply per-model payload overrides.
    for model_id, patch in _VIDEO_OVERRIDES.items():
        base = registry.get(model_id)
        registry.register(_with_image_key(base, **patch))

    return registry
