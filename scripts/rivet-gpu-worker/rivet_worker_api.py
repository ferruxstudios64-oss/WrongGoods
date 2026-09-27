from __future__ import annotations

import os
import secrets
import subprocess
import urllib.error
import urllib.request
from typing import Any

from fastapi import Depends, FastAPI, Header, HTTPException, Response, status
from pydantic import BaseModel, Field

COMFY_URL = os.getenv("COMFY_URL", "http://127.0.0.1:8188").rstrip("/")
TOKEN = os.getenv("RIVET_WORKER_TOKEN", "")
ALLOW_INSECURE = os.getenv("RIVET_ALLOW_INSECURE", "0") == "1"
BLUEPRINT_VERSION = os.getenv("RIVET_BLUEPRINT_VERSION", "unknown")

app = FastAPI(title="RIVET GPU Worker", version=BLUEPRINT_VERSION, docs_url=None, redoc_url=None)


class SubmitJob(BaseModel):
    workflow: dict[str, Any] = Field(description="ComfyUI API-format workflow")
    client_id: str | None = None
    prompt_id: str | None = None


def _json_request(path: str, *, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
    import json

    data = None if payload is None else json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        f"{COMFY_URL}{path}",
        data=data,
        method=method,
        headers={"Content-Type": "application/json"} if data is not None else {},
    )
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            body = response.read()
            return json.loads(body) if body else {}
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:2000]
        raise HTTPException(status_code=502, detail=f"ComfyUI HTTP {exc.code}: {detail}") from exc
    except OSError as exc:
        raise HTTPException(status_code=503, detail="ComfyUI is unavailable") from exc


def require_token(authorization: str | None = Header(default=None)) -> None:
    if ALLOW_INSECURE:
        return
    if not TOKEN:
        raise HTTPException(status_code=503, detail="worker token is not configured")
    expected = f"Bearer {TOKEN}"
    if not authorization or not secrets.compare_digest(authorization, expected):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="unauthorized")


def _gpu_summary() -> str | None:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total", "--format=csv,noheader"],
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


@app.post("/v1/jobs", dependencies=[Depends(require_token)])
def submit_job(job: SubmitJob) -> Any:
    payload: dict[str, Any] = {"prompt": job.workflow}
    if job.client_id:
        payload["client_id"] = job.client_id
    if job.prompt_id:
        payload["prompt_id"] = job.prompt_id
    return _json_request("/prompt", method="POST", payload=payload)


@app.get("/v1/jobs/{prompt_id}", dependencies=[Depends(require_token)])
def job_history(prompt_id: str) -> Any:
    if not prompt_id or len(prompt_id) > 200:
        raise HTTPException(status_code=400, detail="invalid prompt id")
    return _json_request(f"/history/{prompt_id}")


@app.get("/v1/queue", dependencies=[Depends(require_token)])
def queue() -> Any:
    return _json_request("/queue")


@app.post("/v1/interrupt", dependencies=[Depends(require_token)])
def interrupt() -> Any:
    return _json_request("/interrupt", method="POST", payload={})
