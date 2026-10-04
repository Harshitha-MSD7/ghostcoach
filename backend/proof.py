"""Run: python -m backend.proof path/to/image.jpg --output artifacts/proof"""
import argparse
import json
from pathlib import Path
from PIL import Image, ImageDraw, ImageOps
from .pose_model import engine
from .comparison import EDGES, visible


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("image")
    parser.add_argument("--output", default="artifacts/proof")
    args = parser.parse_args()
    image = ImageOps.exif_transpose(Image.open(args.image)).convert("RGB")
    result = engine.infer(image)
    draw = ImageDraw.Draw(image)
    for a, b in EDGES:
        if visible(result["landmarks"], [a, b]):
            pa, pb = result["landmarks"][a], result["landmarks"][b]
            draw.line((pa["x"], pa["y"], pb["x"], pb["y"]), fill="#65caff", width=4)
    for p in result["landmarks"].values():
        if p["confidence"] >= .35:
            x, y = p["x"], p["y"]
            draw.ellipse((x-4, y-4, x+4, y+4), fill="#ffa66b")
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    image.save(target.with_suffix(".jpg"))
    result.update(device=engine.device, model_load_seconds=engine.load_seconds)
    target.with_suffix(".json").write_text(json.dumps(result, indent=2), encoding="utf-8")
    print(json.dumps({k: v for k, v in result.items() if k != "landmarks"}, indent=2))


if __name__ == "__main__":
    main()
