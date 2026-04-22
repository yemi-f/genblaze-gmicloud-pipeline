"""Request body models for the runs API.

Response bodies return Genblaze's own Run / Step / Asset Pydantic models
directly — no custom DTOs needed (they are already BaseModel subclasses).
"""

from typing import Literal

from pydantic import BaseModel

# Default video models for the fan-out step
DEFAULT_VIDEO_MODELS = [
    "Kling-Image2Video-V2.1-Master",
    "Wan-2.6-I2V",
    "PixVerse-v5.6",
]


class RunRequest(BaseModel):
    """Start a first-generation image run."""

    prompt: str
    seed: int | None = 42
    aspect_ratio: Literal["16:9", "9:16", "1:1"] = "16:9"
    image_model: str = "Seedream-5.0-Lite"


class IterateRequest(BaseModel):
    """Fork from a prior run with an optional new prompt or image reference."""

    parent_run_id: str
    prompt: str | None = None
    seed: int | None = None
    # B2 key of the image asset to use as visual reference (FLUX-Kontext-Pro flow)
    reference_asset_key: str | None = None
    image_model: str = "Seedream-5.0-Lite"


class ApproveRequest(BaseModel):
    """Approve an image and fan out to video models concurrently."""

    run_id: str
    approved_step_id: str  # the image step whose asset becomes the video input
    duration_sec: int = 5
    video_models: list[str] = DEFAULT_VIDEO_MODELS
