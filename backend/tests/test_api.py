import io
from PIL import Image
from fastapi.testclient import TestClient
from backend.main import app, engine

client = TestClient(app)


def test_health_does_not_require_model():
    response = client.get("/health")
    assert response.status_code == 200
    assert "models" in response.json()


def test_invalid_image():
    response = client.post("/compare-poses", files={"reference": ("bad.jpg", b"broken"), "attempt": ("bad.jpg", b"broken")})
    assert response.status_code == 400


def test_oversized_image_upload():
    response = client.post("/compare-poses", files={"reference": ("big.jpg", b"a" * (8 * 1024 * 1024 + 1)), "attempt": ("bad.jpg", b"broken")})
    assert response.status_code == 413


def test_api_contract_with_explicit_stub(monkeypatch):
    # Only an API contract test. This is not evidence of real model inference.
    monkeypatch.setattr(engine, "load", lambda: None)
    monkeypatch.setattr(engine, "infer", lambda im: {"width": im.width, "height": im.height, "landmarks": {}, "inference_seconds": 0})
    image = io.BytesIO()
    Image.new("RGB", (32, 32)).save(image, format="PNG")
    data = image.getvalue()
    response = client.post("/compare-poses", files={"reference": ("a.png", data), "attempt": ("b.png", data)}, data={"mirror": "true"})
    result = response.json()
    assert response.status_code == 200
    assert result["mirror"] is True
    assert result["measurements"] == []
    assert result["warnings"]


def test_busy_is_reported():
    image = io.BytesIO()
    Image.new("RGB", (32, 32)).save(image, format="PNG")
    engine.lock.acquire()
    try:
        response = client.post("/compare-poses", files={"reference": ("a.png", image.getvalue()), "attempt": ("b.png", image.getvalue())})
        assert response.status_code == 409
    finally:
        engine.lock.release()
