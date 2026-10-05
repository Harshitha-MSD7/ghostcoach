"""Exercise real ViTPose preprocessing without downloading model weights."""
import numpy as np
from PIL import Image
from transformers import VitPoseImageProcessor


def test_vitpose_affine_preprocessing_dependencies():
    processor = VitPoseImageProcessor()
    image = Image.new("RGB", (128, 160), color=(120, 150, 180))
    batch = processor(image, boxes=[[[16, 16, 80, 128]]], return_tensors="np")
    pixels = batch["pixel_values"]
    assert pixels.shape == (1, 3, processor.size["height"], processor.size["width"])
    assert np.isfinite(pixels).all()
