from __future__ import annotations

import hashlib
import json
import os
import pathlib
import secrets
import subprocess
import urllib.error
import urllib.request
import uuid
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Request, Response, status
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

COMFY_URL = os.getenv("COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
TOKEN = os.getenv("RIVET_WORKER_TOKEN", "")
BLUEPRINT_VERSION = os.getenv("RIVET_BLUEPRINT_VERSION", "unknown")
WORKSPACE = pathlib.Path(os.getenv("WORKSPACE", "/workspace"))
INPUT_ROOT = WORKSPACE / "input"
OUTPUT_ROOT = WORKSPACE / "output"
MAX_INPUT_BYTES = int(os.getenv("RIVET_MAX_INPUT_BYTES", str(512 * 1024 * 1024)))

app = FastAPI(title="RIVET GPU Worker", version=BLUEPRINT_VERSION, docs_url=None, redoc_url=None)


class SubmitJob(BaseModel):
    workflow: dict[str, Any] = Field(description="ComfyUI API-format workflow")
    client_id: str | None = Field(default=None, max_length=200)
    prompt_id: str | None = Field(default=None, max_length=36)


class InterruptJob(BaseModel):
    prompt_id: str | None = Field(default=None, max_length=36)


def _json_request(path: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{COMFY_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data is not None else {},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:4000]
        code = exc.code if 400 <= exc.code < 500 else 502
        raise HTTPException(status_code=code, detail=f"ComfyUI HTTP {exc.code}: {detail}") from exc
    except (urllib.error.URLError, OSError, TimeoutError) as exc:
        raise HTTPException(status_code=503, detail="ComfyUI is unavailable") from exc


def require_token(authorization: str | None = Header(default=None)) -> None:
    if not TOKEN:
        raise HTTPException(status_code=503, detail="worker token is not configured")
    expected = f"Bearer {TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")


def _canonical_prompt_id(value: str) -> str:
    try:
        parsed = uuid.UUID(value)
    except (ValueError, AttributeError) as exc:
        raise HTTPException(status_code=400, detail="prompt_id must be a canonical UUID") from exc
    canonical = str(parsed)
    if value != canonical:
        raise HTTPException(status_code=400, detail="prompt_id must be a canonical lowercase UUID")
    return canonical


def _safe_path(root: pathlib.Path, relative_path: str) -> pathlib.Path:
    pure = pathlib.PurePosixPath(relative_path)
    if pure.is_absolute() or not pure.parts or ".." in pure.parts or any(part in ("", ".") for part in pure.parts):
        raise HTTPException(status_code=400, detail="invalid relative path")
    root_resolved = root.resolve()
    candidate = (root / pathlib.Path(*pure.parts)).resolve()
    try:
        candidate.relative_to(root_resolved)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail="path escapes workspace") from exc
    return candidate


def _sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _gpu_summary() -> str | None:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"],
            check=True,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return result.stdout.strip() or None
    except Exception:
        return None


@app.get("/healthz")
def healthz(response: Response) -> dict[str, Any]:
    try:
        _json_request("/system_stats")
    except HTTPException:
        response.status_code = 503
        return {"status": "starting", "blueprint": BLUEPRINT_VERSION}
    return {"status": "ready", "blueprint": BLUEPRINT_VERSION}


@app.get("/v1/system", dependencies=[Depends(require_token)])
def system_info() -> dict[str, Any]:
    return {
        "blueprint": BLUEPRINT_VERSION,
        "gpu": _gpu_summary(),
        "comfy": _json_request("/system_stats"),
    }


@app.put("/v1/inputs/{relative_path:path}", dependencies=[Depends(require_token)])
async def upload_input(
    relative_path: str,
    request: Request,
    x_rivet_sha256: str | None = Header(default=None),
) -> dict[str, Any]:
    destination = _safe_path(INPUT_ROOT, relative_path)
    destination.parent.mkdir(parents=True, exist_ok=True)

    content_length = request.headers.get("content-length")
    if content_length:
        try:
            declared = int(content_length)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail="invalid Content-Length") from exc
        if declared < 0 or declared > MAX_INPUT_BYTES:
            raise HTTPException(status_code=413, detail="input exceeds RIVET_MAX_INPUT_BYTES")

    expected = x_rivet_sha256.lower() if x_rivet_sha256 else None
    if expected and (len(expected) != 64 or any(ch not in "0123456789abcdef" for ch in expected)):
        raise HTTPException(status_code=400, detail="X-RIVET-SHA256 must be a lowercase SHA-256 hex digest")

    temp_path = destination.with_name(f".{destination.name}.{uuid.uuid4().hex}.part")
    digest = hashlib.sha256()
    written = 0
    try:
        with temp_path.open("wb") as handle:
            async for chunk in request.stream():
                written += len(chunk)
                if written > MAX_INPUT_BYTES:
                    raise HTTPException(status_code=413, detail="input exceeds RIVET_MAX_INPUT_BYTES")
                digest.update(chunk)
                handle.write(chunk)
        actual = digest.hexdigest()
        if expected and actual != expected:
            raise HTTPException(status_code=422, detail=f"input checksum mismatch: expected {expected}, got {actual}")
        os.replace(temp_path, destination)
    finally:
        temp_path.unlink(missing_ok=True)

    return {"path": relative_path, "bytes": written, "sha256": digest.hexdigest()}


@app.get("/v1/outputs/{relative_path:path}", dependencies=[Depends(require_token)])
def download_output(relative_path: str) -> FileResponse:
    source = _safe_path(OUTPUT_ROOT, relative_path)
    if not source.is_file():
        raise HTTPException(status_code=404, detail="output not found")
    return FileResponse(
        source,
        filename=source.name,
        headers={
            "X-RIVET-SHA256": _sha256_file(source),
            "X-RIVET-BYTES": str(source.stat().st_size),
        },
    )


@app.post("/v1/jobs", dependencies=[Depends(require_token)])
def submit_job(job: SubmitJob) -> Any:
    payload: dict[str, Any] = {"prompt": job.workflow}
    if job.client_id:
        payload["client_id"] = job.client_id
    if job.prompt_id:
        payload["prompt_id"] = _canonical_prompt_id(job.prompt_id)
    return _json_request("/prompt", method="POST", payload=payload)


@app.get("/v1/jobs/{prompt_id}", dependencies=[Depends(require_token)])
def job_history(prompt_id: str) -> Any:
    prompt_id = _canonical_prompt_id(prompt_id)
    return _json_request(f"/history/{prompt_id}")


@app.get("/v1/queue", dependencies=[Depends(require_token)])
def queue() -> Any:
    return _json_request("/queue")


@app.post("/v1/interrupt", dependencies=[Depends(require_token)])
def interrupt(job: InterruptJob | None = None) -> Any:
    payload: dict[str, Any] = {}
    if job and job.prompt_id:
        payload["prompt_id"] = _canonical_prompt_id(job.prompt_id)
    return _json_request("/interrupt", method="POST", payload=payload)
