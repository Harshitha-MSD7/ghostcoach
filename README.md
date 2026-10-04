# GhostCoach

A local movement-comparison prototype built with React, FastAPI, and pretrained Hugging Face pose models. Select corresponding frames from a reference video and a practice video, then inspect skeleton overlays and approximate 2D joint-angle differences.

## Features

- Video or image inputs with independent frame selection.
- Real person detection and ViTPose landmark inference.
- Side-by-side and normalized skeleton overlays.
- Elbow and upper-arm angle comparisons with confidence filtering.
- Mirror comparison, visibility notes, and JSON measurement export.
- Local processing: videos remain in the browser; only selected frames go to the backend.

## Requirements

- Python 3.12 recommended.
- Node.js 22.12+ or a compatible newer release.
- npm or pnpm.
- Internet access for initial dependency and model downloads.

CPU inference is supported. CUDA is used if available in the installed PyTorch build. No API key or model training is required for the public checkpoints used here. First inference downloads and loads the models, which may take several minutes. Model files are cached under `.cache/huggingface` and are not included in Git.

## Setup

Run from the repository directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r backend/requirements.txt
npm install
```

Alternatively, use `pnpm install` with the included pnpm lockfile. On macOS/Linux, replace `.\.venv\Scripts\python.exe` with `.venv/bin/python`.

Start the backend in one terminal:

```powershell
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

Start the frontend in a second terminal:

```powershell
npm run dev
```

Open http://127.0.0.1:5173. Keep both terminals running. If npm's launcher is broken but dependencies are installed, start Vite directly with `node node_modules/vite/bin/vite.js --host 127.0.0.1`.

## Demo walkthrough

1. Add a reference clip or photo and a practice clip or photo.
2. Choose moments showing the same stage of the movement.
3. Keep exactly one person visible with similar camera angles.
4. Select **Compare selected frames**.
5. Click an observation to highlight its joints, or switch to the skeleton overlay.
6. Change a frame and compare again; prior results are marked as outdated.

## Architecture

```text
Browser selects frames
  -> POST /compare-poses (two images)
  -> RT-DETR detects a person
  -> ViTPose extracts body landmarks
  -> Python compares angles and normalizes coordinates
  -> React renders overlays and observations
```

| File | Responsibility |
| --- | --- |
| `src/VideoSelector.tsx` | Media loading and frame capture |
| `src/App.tsx` | Requests, state, and results interface |
| `src/PoseOverlay.tsx` | Landmark visualization |
| `backend/main.py` | API, validation, concurrency, and errors |
| `backend/pose_model.py` | Pretrained model loading and inference |
| `backend/comparison.py` | Deterministic geometry and feedback |
| `backend/proof.py` | Command-line real-inference check |

## Models and attribution

- Person detector: [PekingU/rtdetr_r50vd_coco_o365](https://huggingface.co/PekingU/rtdetr_r50vd_coco_o365)
- Pose estimator: [usyd-community/vitpose-base-simple](https://huggingface.co/usyd-community/vitpose-base-simple)
- Integration reference: [Hugging Face ViTPose documentation](https://huggingface.co/docs/transformers/model_doc/vitpose)

Pretrained models are third-party work, downloaded separately. Consult their model cards and licenses for use conditions. The application was developed with AI coding assistance; it does not train these models.

## Verification

```powershell
.\.venv\Scripts\python.exe -m pytest backend/tests -q
npm run build
.\.venv\Scripts\python.exe -m backend.proof path/to/person.jpg --output artifacts/proof
```

The proof command writes an annotated image and landmark JSON and reports device, loading time, and inference time. Use your own suitable image; no user recordings are committed.

The initial 12 backend tests passed, and browser startup was checked in Edge. Geometry tests use synthetic points; API contract tests explicitly stub inference. These tests do not establish model accuracy. Real-inference benchmarks and an evaluated movement dataset have not been recorded in this repository. A production build previously encountered a local sandbox filesystem restriction; it should be rerun in the target environment.

## Limits

- Compares manually selected frames, not full routines or live movement.
- Measurements are approximate 2D image angles, not 3D biomechanics.
- Camera perspective, occlusion, clothing, and body proportions affect results.
- Low-confidence joints are omitted; normalization requires visible torso anchors.
- The confidence threshold and 10-degree display tolerance are prototype heuristics.
- Differences are not assessments of skill, medical safety, or correct exercise technique.
- This is a local development app, not a hardened public deployment.

## Troubleshooting

- **Port 8000 already in use:** the backend may already be running; do not launch a second copy.
- **Page unavailable on 5173:** start Vite separately from the backend.
- **Blank or stalled page:** keep Vite running and refresh with Ctrl+Shift+R. Startup failures now display a message.
- **Backend offline:** check http://127.0.0.1:8000/health and the backend terminal.
- **First comparison slow:** model downloads occur on first use; inspect backend logs.
- **Inference error:** read backend logs. The app does not substitute fake pose results.
