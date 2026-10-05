import io
import logging
from time import perf_counter
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, ImageOps, UnidentifiedImageError
from starlette.concurrency import run_in_threadpool
from .comparison import compare
from .pose_model import engine, DETECTOR, POSE_MODEL

app = FastAPI(title="GhostCoach", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
                   allow_methods=["GET", "POST"], allow_headers=["*"])
MAX_BYTES = 8 * 1024 * 1024
MAX_PIXELS = 16_000_000


@app.get("/health")
def health():
    return {"status": "ok", "model_status": engine.status, "device": engine.device,
            "load_seconds": engine.load_seconds, "last_error": engine.last_error,
            "models": [DETECTOR, POSE_MODEL]}


async def decode(upload):
    content = await upload.read(MAX_BYTES + 1)
    await upload.close()
    if len(content) > MAX_BYTES:
        raise HTTPException(413, "Each selected image must be smaller than 8 MB.")
    try:
        with Image.open(io.BytesIO(content)) as image:
            if image.width * image.height > MAX_PIXELS:
                raise HTTPException(413, "Image exceeds the 16 megapixel limit.")
            return ImageOps.exif_transpose(image).convert("RGB")
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as exc:
        raise HTTPException(400, "Could not decode image. Use a valid JPEG or PNG.") from exc


def process(reference, attempt, mirror):
    if not engine.lock.acquire(blocking=False):
        raise HTTPException(409, "Another comparison is processing. Please try again shortly.")
    try:
        engine.load()
        started = perf_counter()
        result = compare(engine.infer(reference), engine.infer(attempt), mirror)
        engine.last_error = None
        return {**result, "processing_seconds": round(perf_counter() - started, 3),
                "model_load_seconds": engine.load_seconds, "device": engine.device}
    except ValueError as exc:
        raise HTTPException(422, str(exc)) from exc
    except HTTPException:
        raise
    except Exception as exc:
        engine.last_error = str(exc)
        logging.exception("Real pose inference failed")
        raise HTTPException(503, "Pose inference unavailable. Check the backend console and /health for model setup details. No simulated results were generated.") from exc
    finally:
        engine.lock.release()


@app.post("/compare-poses")
async def compare_poses(reference: UploadFile = File(...), attempt: UploadFile = File(...), mirror: bool = Form(False)):
    ref, att = await decode(reference), await decode(attempt)
    return await run_in_threadpool(process, ref, att, mirror)
