"""Real Hugging Face person detection and ViTPose inference, lazy loaded once."""
import os
from pathlib import Path
from threading import Lock
from time import perf_counter

ROOT = Path(__file__).resolve().parents[1]
os.environ.setdefault("HF_HOME", str(ROOT / ".cache" / "huggingface"))
os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")
DETECTOR = "PekingU/rtdetr_r50vd_coco_o365"
POSE_MODEL = "usyd-community/vitpose-base-simple"


def canonical_label(name):
    name = name.lower().replace(" ", "_")
    if name.startswith("l_"):
        return "left_" + name[2:]
    if name.startswith("r_"):
        return "right_" + name[2:]
    return name


class PoseEngine:
    def __init__(self):
        self.lock = Lock()
        self.loaded = False
        self.device = "not initialized"
        self.load_seconds = None
        self.status = "not_loaded"
        self.last_error = None

    def load(self):
        if self.loaded:
            return
        self.status = "loading"
        started = perf_counter()
        try:
            import torch
            from transformers import AutoProcessor, RTDetrForObjectDetection, VitPoseForPoseEstimation
            self.torch = torch
            self.device = "cuda" if torch.cuda.is_available() else "cpu"
            if self.device == "cpu":
                torch.set_num_threads(min(4, os.cpu_count() or 1))
            self.detector_processor = AutoProcessor.from_pretrained(DETECTOR)
            self.detector = RTDetrForObjectDetection.from_pretrained(DETECTOR).to(self.device).eval()
            self.pose_processor = AutoProcessor.from_pretrained(POSE_MODEL)
            self.model = VitPoseForPoseEstimation.from_pretrained(POSE_MODEL).to(self.device).eval()
            self.load_seconds = round(perf_counter() - started, 3)
            self.loaded, self.status, self.last_error = True, "ready", None
        except Exception as exc:
            self.status, self.last_error = "error", str(exc)
            raise

    def infer(self, image):
        self.load()
        torch = self.torch
        started = perf_counter()
        with torch.inference_mode():
            inputs = self.detector_processor(images=image, return_tensors="pt").to(self.device)
            outputs = self.detector(**inputs)
            result = self.detector_processor.post_process_object_detection(
                outputs, target_sizes=torch.tensor([(image.height, image.width)]), threshold=0.5)[0]
            people = [int(k) for k, v in self.detector.config.id2label.items() if v.lower() == "person"]
            if not people:
                raise RuntimeError("Detector configuration has no person label.")
            boxes = result["boxes"][result["labels"] == people[0]].cpu().numpy()
            if len(boxes) != 1:
                raise ValueError("No person detected. Use a clear, well-lit frame." if len(boxes) == 0 else
                                 "Multiple people detected. Crop the image or choose a frame with one person.")
            boxes[:, 2:] -= boxes[:, :2]
            inputs = self.pose_processor(image, boxes=[boxes], return_tensors="pt").to(self.device)
            outputs = self.model(**inputs)
            result = self.pose_processor.post_process_pose_estimation(outputs, boxes=[boxes])[0][0]
            landmarks = {}
            for point, label, score in zip(result["keypoints"], result["labels"], result["scores"]):
                name = canonical_label(self.model.config.id2label[int(label)])
                landmarks[name] = {"x": float(point[0]), "y": float(point[1]), "confidence": float(score)}
        return {"width": image.width, "height": image.height, "landmarks": landmarks,
                "inference_seconds": round(perf_counter() - started, 3)}


engine = PoseEngine()
