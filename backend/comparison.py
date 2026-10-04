"""Deterministic 2D measurements. No skill or safety scores."""
from copy import deepcopy
import numpy as np

CONFIDENCE = 0.35  # Heuristic visibility threshold, not a calibrated probability.
EDGES = [("left_shoulder", "right_shoulder"), ("left_shoulder", "left_elbow"),
         ("left_elbow", "left_wrist"), ("right_shoulder", "right_elbow"),
         ("right_elbow", "right_wrist"), ("left_shoulder", "left_hip"),
         ("right_shoulder", "right_hip"), ("left_hip", "right_hip"),
         ("left_hip", "left_knee"), ("left_knee", "left_ankle"),
         ("right_hip", "right_knee"), ("right_knee", "right_ankle")]


def visible(points, names):
    return all(n in points and points[n]["confidence"] >= CONFIDENCE and
               np.isfinite([points[n]["x"], points[n]["y"]]).all() for n in names)


def xy(point):
    return np.array([point["x"], point["y"]], dtype=float)


def angle(a, b, c):
    u, v = xy(a) - xy(b), xy(c) - xy(b)
    length = np.linalg.norm(u) * np.linalg.norm(v)
    if length < 1e-8:
        return None
    return float(np.degrees(np.arccos(np.clip(np.dot(u, v) / length, -1, 1))))


def mirror_pose(pose):
    """Reflect reference geometry AND swap anatomical labels for imitation mode."""
    result = deepcopy(pose)
    result["landmarks"] = {}
    for name, point in pose["landmarks"].items():
        swapped = name.replace("left_", "right_") if name.startswith("left_") else name.replace("right_", "left_")
        result["landmarks"][swapped] = {**point, "x": pose["width"] - 1 - point["x"]}
    return result


def normalize(points):
    anchors = ["left_shoulder", "right_shoulder", "left_hip", "right_hip"]
    if not visible(points, anchors):
        return None
    shoulders = (xy(points[anchors[0]]) + xy(points[anchors[1]])) / 2
    hips = (xy(points[anchors[2]]) + xy(points[anchors[3]])) / 2
    scale = np.linalg.norm(shoulders - hips)
    if scale < 1e-8:
        return None
    return {name: {"x": float((p["x"] - hips[0]) / scale),
                   "y": float((p["y"] - hips[1]) / scale),
                   "confidence": p["confidence"]} for name, p in points.items()}


def compare(reference, attempt, mirror=False):
    effective = mirror_pose(reference) if mirror else reference
    a, b = effective["landmarks"], attempt["landmarks"]
    measurements, warnings = [], []
    for side in ("left", "right"):
        for kind in ("elbow", "upper_arm"):
            names = ([f"{side}_shoulder", f"{side}_elbow", f"{side}_wrist"] if kind == "elbow"
                     else [f"{side}_hip", f"{side}_shoulder", f"{side}_elbow"])
            label = f"{side.title()} " + ("elbow bend" if kind == "elbow" else "upper-arm angle")
            if not visible(a, names) or not visible(b, names):
                warnings.append(f"{label}: required landmarks are not clearly visible in both frames.")
                continue
            av, bv = angle(*(a[n] for n in names)), angle(*(b[n] for n in names))
            if av is None or bv is None:
                warnings.append(f"{label}: overlapping landmarks prevent measurement.")
                continue
            delta = bv - av
            if abs(delta) < 10:
                message = f"Your {side} {kind.replace('_', ' ')} angle is within 10° of the reference."
            elif kind == "elbow":
                message = f"Your {side} elbow is {'more bent' if delta < 0 else 'more extended'} than the reference."
            else:
                message = f"Your {side} upper arm forms a {'larger' if delta > 0 else 'smaller'} angle with your torso."
            measurements.append({"id": f"{side}_{kind}", "label": label, "joints": names,
                                 "reference_angle": round(av, 1), "attempt_angle": round(bv, 1),
                                 "difference_degrees": round(delta, 1), "message": message})
    normalized = {"reference": normalize(a), "attempt": normalize(b)}
    if any(v is None for v in normalized.values()):
        warnings.append("Shared overlay unavailable: both shoulders and hips must be visible with a measurable torso length.")
    return {"reference": reference, "attempt": attempt, "normalized": normalized,
            "measurements": sorted(measurements, key=lambda m: -abs(m["difference_degrees"])),
            "warnings": warnings, "mirror": mirror, "confidence_threshold": CONFIDENCE,
            "edges": EDGES}
