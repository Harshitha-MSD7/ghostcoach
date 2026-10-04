"""Synthetic geometry fixtures test mathematics, not real model accuracy."""
from copy import deepcopy
import pytest
from backend.comparison import angle, compare, mirror_pose, normalize


def point(x, y, confidence=1):
    return {"x": x, "y": y, "confidence": confidence}


@pytest.fixture
def pose():
    return {"width": 200, "height": 300, "inference_seconds": 0,
            "landmarks": {"left_shoulder": point(70, 70), "right_shoulder": point(130, 70),
                          "left_elbow": point(40, 70), "right_elbow": point(160, 70),
                          "left_wrist": point(40, 30), "right_wrist": point(180, 70),
                          "left_hip": point(80, 170), "right_hip": point(120, 170)}}


def test_known_angles():
    assert angle(point(0, 1), point(0, 0), point(1, 0)) == pytest.approx(90)
    assert angle(point(-1, 0), point(0, 0), point(1, 0)) == pytest.approx(180)
    assert angle(point(0, 0), point(0, 0), point(1, 1)) is None


def test_normalization_translation_scale(pose):
    shifted = {k: {**p, "x": p["x"] * 3 + 27, "y": p["y"] * 3 - 60} for k, p in pose["landmarks"].items()}
    a, b = normalize(pose["landmarks"]), normalize(shifted)
    for name in a:
        assert a[name]["x"] == pytest.approx(b[name]["x"])
        assert a[name]["y"] == pytest.approx(b[name]["y"])


def test_mirror_involution_and_labels(pose):
    flipped = mirror_pose(pose)
    assert flipped["landmarks"]["right_wrist"]["x"] == 159
    assert flipped["landmarks"]["right_wrist"]["y"] == 30
    assert mirror_pose(flipped) == pose


def test_mirror_comparison_matches(pose):
    result = compare(pose, mirror_pose(pose), mirror=True)
    assert all(m["difference_degrees"] == 0 for m in result["measurements"])


def test_low_confidence_omits_measurement(pose):
    other = deepcopy(pose)
    other["landmarks"]["left_wrist"]["confidence"] = .1
    result = compare(pose, other)
    assert "left_elbow" not in [m["id"] for m in result["measurements"]]
    assert result["warnings"]


def test_missing_hip_disables_overlay(pose):
    del pose["landmarks"]["left_hip"]
    assert normalize(pose["landmarks"]) is None
    assert compare(pose, pose)["normalized"]["reference"] is None


def test_feedback_direction(pose):
    other = deepcopy(pose)
    other["landmarks"]["right_wrist"] = point(160, 20)
    measurement = next(m for m in compare(pose, other)["measurements"] if m["id"] == "right_elbow")
    assert measurement["difference_degrees"] == -90
    assert "more bent" in measurement["message"]
