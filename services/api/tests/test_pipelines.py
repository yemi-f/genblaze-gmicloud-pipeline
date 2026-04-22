"""Unit tests for repo/pipelines.py.

These tests inspect the _PipelineStep objects assembled by each builder
without executing any GMICloud or B2 calls. Providers are replaced with
genblaze_core.testing.MockProvider so tests exercise real Pipeline composition.

_FakeResult is still used to supply a prev_result for .from_result() because
the library has no MockResult factory — but MockProvider covers all provider slots.
"""

from genblaze_core.models.manifest import Manifest
from genblaze_core.models.run import Run
from genblaze_core.models.step import Step
from genblaze_core.pipeline.result import PipelineResult
from genblaze_core.testing import MockProvider, MockVideoProvider

from app.types.runs import ApproveRequest, IterateRequest, RunRequest


def _make_prev_result(prompt: str = "a sunset", seed: int = 42, aspect_ratio: str = "16:9") -> PipelineResult:
    """Minimal PipelineResult for .from_result() lineage tests."""
    step = Step(provider="mock", model="mock", prompt=prompt, seed=seed)
    run = Run(steps=[step], metadata={"aspect_ratio": aspect_ratio})
    return PipelineResult(run=run, manifest=Manifest.from_run(run))


def _reload_settings(monkeypatch):
    """Force settings module to pick up monkeypatched env vars."""
    import importlib

    import app.config
    importlib.reload(app.config)


def test_build_image_pipeline_has_one_step(monkeypatch):
    """build_image_pipeline returns a single-step IMAGE pipeline."""
    monkeypatch.setenv("GMI_API_KEY", "test-key")
    monkeypatch.setenv("B2_BUCKET_NAME", "test-bucket")
    _reload_settings(monkeypatch)

    from app.repo.pipelines import build_image_pipeline
    # MockProvider replaces GMICloudImageProvider for composition inspection
    monkeypatch.setattr("app.repo.pipelines.GMICloudImageProvider", lambda **_: MockProvider())

    req = RunRequest(prompt="a sunset over the ocean")
    pipeline = build_image_pipeline(req)
    assert len(pipeline._steps) == 1
    step = pipeline._steps[0]
    assert step.modality.name == "IMAGE"
    assert step.prompt == "a sunset over the ocean"


def test_build_video_fanout_has_three_steps_and_correct_concurrency(monkeypatch):
    """build_video_fanout produces exactly 3 sibling VIDEO steps with max_concurrency=3."""
    monkeypatch.setenv("GMI_API_KEY", "test-key")
    monkeypatch.setenv("B2_BUCKET_NAME", "test-bucket")
    _reload_settings(monkeypatch)

    from app.repo.pipelines import build_video_fanout
    # MockVideoProvider replaces GMICloudVideoProvider
    monkeypatch.setattr("app.repo.pipelines.GMICloudVideoProvider", lambda **_: MockVideoProvider())

    req = ApproveRequest(run_id="run-1", approved_step_id="step-0")
    pipeline = build_video_fanout(req, _make_prev_result())
    assert len(pipeline._steps) == 3
    assert pipeline._max_concurrency == 3
    models = [s.model for s in pipeline._steps]
    assert "Kling-Image2Video-V2.1-Master" in models
    assert "Wan-2.6-I2V" in models
    assert "PixVerse-v5.6" in models
    # All three steps fan out from step 0 (the approved image)
    for step in pipeline._steps:
        assert step.input_from == [0]


def test_build_iteration_pipeline_text_only(monkeypatch):
    """build_iteration_pipeline without reference_asset_key = text-only regen."""
    monkeypatch.setenv("GMI_API_KEY", "test-key")
    monkeypatch.setenv("B2_BUCKET_NAME", "test-bucket")
    _reload_settings(monkeypatch)

    from app.repo.pipelines import build_iteration_pipeline
    monkeypatch.setattr("app.repo.pipelines.GMICloudImageProvider", lambda **_: MockProvider())

    req = IterateRequest(parent_run_id="run-1", prompt="new prompt", seed=99)
    pipeline = build_iteration_pipeline(req, _make_prev_result())
    assert len(pipeline._steps) == 1
    step = pipeline._steps[0]
    # No input_from for text-only regen
    assert step.input_from is None
    assert step.prompt == "new prompt"


def test_build_iteration_pipeline_image_reference(monkeypatch):
    """build_iteration_pipeline with reference_asset_key uses input_from=[0]."""
    monkeypatch.setenv("GMI_API_KEY", "test-key")
    monkeypatch.setenv("B2_BUCKET_NAME", "test-bucket")
    _reload_settings(monkeypatch)

    from app.repo.pipelines import build_iteration_pipeline
    monkeypatch.setattr("app.repo.pipelines.GMICloudImageProvider", lambda **_: MockProvider())

    req = IterateRequest(
        parent_run_id="run-1",
        reference_asset_key="runs/run-1/step-0/image.jpg",
        image_model="FLUX-Kontext-Pro",
    )
    pipeline = build_iteration_pipeline(req, _make_prev_result())
    assert len(pipeline._steps) == 1
    step = pipeline._steps[0]
    # input_from is normalized to a list by Pipeline.step()
    assert step.input_from == [0]


def test_build_iteration_pipeline_falls_back_to_prior_prompt(monkeypatch):
    """Image-reference flow uses prior prompt when req.prompt is None."""
    monkeypatch.setenv("GMI_API_KEY", "test-key")
    monkeypatch.setenv("B2_BUCKET_NAME", "test-bucket")
    _reload_settings(monkeypatch)

    from app.repo.pipelines import build_iteration_pipeline
    monkeypatch.setattr("app.repo.pipelines.GMICloudImageProvider", lambda **_: MockProvider())

    prev = _make_prev_result(prompt="original prompt")
    req = IterateRequest(
        parent_run_id="run-1",
        reference_asset_key="runs/run-1/step-0/image.jpg",
        prompt=None,  # should fall back to prior step's prompt
    )
    pipeline = build_iteration_pipeline(req, prev)
    assert pipeline._steps[0].prompt == "original prompt"
