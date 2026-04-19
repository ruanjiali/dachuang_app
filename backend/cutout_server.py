import base64
import io
import os
import time
import uuid
from concurrent.futures import ThreadPoolExecutor
from threading import Lock

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from PIL import Image
from rembg import remove


app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "static")
RESULT_DIR = os.path.join(STATIC_DIR, "results")
os.makedirs(RESULT_DIR, exist_ok=True)

executor = ThreadPoolExecutor(max_workers=2)
tasks = {}
tasks_lock = Lock()


def now_ts():
    return int(time.time())


def parse_bool(value):
    return str(value).lower() in {"1", "true", "yes", "on"}


def get_public_url(filename):
    base = request.host_url.rstrip("/")
    return f"{base}/static/results/{filename}"


def decode_base64_image(raw):
    value = str(raw or "").strip()
    if "," in value and value.startswith("data:image"):
        value = value.split(",", 1)[1]
    return base64.b64decode(value)


def normalize_to_png(image_bytes):
    img = Image.open(io.BytesIO(image_bytes)).convert("RGBA")
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def run_remove_bg(image_bytes):
    png_bytes = normalize_to_png(image_bytes)
    return remove(png_bytes)


def save_result_bytes(content):
    name = f"{uuid.uuid4().hex}.png"
    path = os.path.join(RESULT_DIR, name)
    with open(path, "wb") as f:
        f.write(content)
    return name


def update_task(task_id, **kwargs):
    with tasks_lock:
        if task_id not in tasks:
            tasks[task_id] = {}
        tasks[task_id].update(kwargs)


def process_task(task_id, image_bytes):
    try:
        result = run_remove_bg(image_bytes)
        filename = save_result_bytes(result)
        update_task(
            task_id,
            status="done",
            url=f"/static/results/{filename}",
            updatedAt=now_ts(),
        )
    except Exception as e:
        update_task(
            task_id,
            status="failed",
            message=str(e),
            updatedAt=now_ts(),
        )


def async_or_sync_response(image_bytes, use_async):
    if use_async:
        task_id = uuid.uuid4().hex
        update_task(task_id, status="processing", createdAt=now_ts(), updatedAt=now_ts())
        executor.submit(process_task, task_id, image_bytes)
        return jsonify({"taskId": task_id, "status": "processing"})

    result = run_remove_bg(image_bytes)
    filename = save_result_bytes(result)
    url = f"/static/results/{filename}"
    return jsonify({"url": url, "imageUrl": url, "resultUrl": url})


@app.get("/health")
def health():
    return jsonify({"ok": True, "time": now_ts()})


@app.post("/api/mini/remove-bg")
def remove_bg_file():
    file_obj = request.files.get("image")
    if not file_obj:
        return jsonify({"code": 400, "message": "image file is required"}), 400

    use_async = parse_bool(request.args.get("async")) or parse_bool(request.form.get("async"))
    image_bytes = file_obj.read()
    if not image_bytes:
        return jsonify({"code": 400, "message": "empty image"}), 400

    try:
        return async_or_sync_response(image_bytes, use_async)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)}), 500


@app.post("/api/mini/remove-bg-json")
def remove_bg_json():
    payload = request.get_json(silent=True) or {}
    raw = payload.get("image") or payload.get("imageBase64")
    if not raw:
        return jsonify({"code": 400, "message": "image or imageBase64 is required"}), 400

    use_async = parse_bool(request.args.get("async")) or parse_bool(payload.get("async"))
    try:
        image_bytes = decode_base64_image(raw)
    except Exception:
        return jsonify({"code": 400, "message": "invalid base64 image"}), 400

    try:
        return async_or_sync_response(image_bytes, use_async)
    except Exception as e:
        return jsonify({"code": 500, "message": str(e)}), 500


@app.get("/api/mini/remove-bg/result")
def remove_bg_result():
    task_id = request.args.get("taskId") or request.args.get("task_id")
    if not task_id:
        return jsonify({"code": 400, "message": "taskId is required"}), 400

    with tasks_lock:
        task = tasks.get(task_id)

    if not task:
        return jsonify({"code": 404, "message": "task not found"}), 404

    status = task.get("status", "processing")
    if status == "done":
        url = task.get("url")
        return jsonify({"status": "done", "url": url, "resultUrl": url, "imageUrl": url})

    if status == "failed":
        return jsonify({"status": "failed", "message": task.get("message", "failed")}), 500

    return jsonify({"status": "processing", "taskId": task_id})


@app.get("/static/results/<path:filename>")
def static_results(filename):
    return send_from_directory(RESULT_DIR, filename)


if __name__ == "__main__":
    host = os.environ.get("CUTOUT_HOST", "0.0.0.0")
    port = int(os.environ.get("CUTOUT_PORT", "5000"))
    app.run(host=host, port=port, debug=True)

