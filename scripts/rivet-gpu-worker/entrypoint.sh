#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${WORKSPACE:-/workspace}"
COMFYUI_HOME="${COMFYUI_HOME:-/opt/ComfyUI}"
RIVET_HOME="${RIVET_HOME:-/opt/rivet}"
STARTUP_TIMEOUT="${RIVET_STARTUP_TIMEOUT_SECONDS:-180}"

mkdir -p \
  "$WORKSPACE/models" \
  "$WORKSPACE/input" \
  "$WORKSPACE/output" \
  "$WORKSPACE/temp" \
  "$WORKSPACE/user" \
  "$WORKSPACE/logs" \
  "$WORKSPACE/manifests"

if [[ -z "${RIVET_WORKER_TOKEN:-}" ]]; then
  echo "RIVET_WORKER_TOKEN is required." >&2
  exit 64
fi

python "$RIVET_HOME/rivet_admin.py" verify-runtime \
  --manifests-dir "$RIVET_HOME/manifests" \
  --comfyui-home "$COMFYUI_HOME" \
  --build-freeze "$RIVET_HOME/python-freeze-build.txt"

python - <<'PY'
import os
import sys
import torch

if not torch.cuda.is_available():
    print("CUDA is not available; refusing to start a paid GPU worker.", file=sys.stderr)
    raise SystemExit(70)

minimum = float(os.getenv("RIVET_MIN_VRAM_GB", "0"))
gpus = []
for index in range(torch.cuda.device_count()):
    props = torch.cuda.get_device_properties(index)
    gib = props.total_memory / (1024 ** 3)
    gpus.append((index, props.name, gib))

if not gpus:
    print("No CUDA devices were detected.", file=sys.stderr)
    raise SystemExit(70)

best = max(gpus, key=lambda item: item[2])
if best[2] < minimum:
    print(f"Largest GPU has {best[2]:.2f} GiB VRAM; RIVET_MIN_VRAM_GB requires {minimum:.2f} GiB.", file=sys.stderr)
    raise SystemExit(70)

print("RIVET CUDA preflight:")
for index, name, gib in gpus:
    print(f"  GPU {index}: {name} ({gib:.2f} GiB)")
PY

if [[ "${RIVET_SYNC_MODELS_ON_START:-0}" == "1" ]]; then
  python "$RIVET_HOME/rivet_admin.py" sync-models \
    --manifest "$RIVET_HOME/manifests/models.manifest.json" \
    --root "$WORKSPACE/models"
else
  python "$RIVET_HOME/rivet_admin.py" sync-models \
    --manifest "$RIVET_HOME/manifests/models.manifest.json" \
    --root "$WORKSPACE/models" \
    --verify-only
fi

COMFY_LISTEN="127.0.0.1"
if [[ "${RIVET_EXPOSE_COMFYUI:-0}" == "1" ]]; then
  COMFY_LISTEN="0.0.0.0"
  echo "WARNING: ComfyUI is directly exposed on port 8188. Use only behind provider authentication or an SSH tunnel." >&2
fi

COMFY_CMD=(python "$COMFYUI_HOME/main.py"
  --listen "$COMFY_LISTEN"
  --port 8188
  --extra-model-paths-config "$RIVET_HOME/extra_model_paths.yaml"
  --input-directory "$WORKSPACE/input"
  --output-directory "$WORKSPACE/output"
  --temp-directory "$WORKSPACE/temp"
  --user-directory "$WORKSPACE/user")

if [[ -n "${RIVET_COMFY_EXTRA_ARGS:-}" ]]; then
  read -r -a EXTRA_ARGS <<< "${RIVET_COMFY_EXTRA_ARGS}"
  COMFY_CMD+=("${EXTRA_ARGS[@]}")
fi

"${COMFY_CMD[@]}" >>"$WORKSPACE/logs/comfyui.log" 2>&1 &
COMFY_PID=$!
API_PID=""

cleanup() {
  if [[ -n "${API_PID:-}" ]]; then kill "$API_PID" 2>/dev/null || true; fi
  kill "$COMFY_PID" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

READY=0
for _ in $(seq 1 "$STARTUP_TIMEOUT"); do
  if python - <<'PY'
import urllib.request
try:
    urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=2).read()
except Exception:
    raise SystemExit(1)
PY
  then
    READY=1
    break
  fi
  if ! kill -0 "$COMFY_PID" 2>/dev/null; then
    echo "ComfyUI exited during startup; see $WORKSPACE/logs/comfyui.log" >&2
    exit 1
  fi
  sleep 1
done

if [[ "$READY" != "1" ]]; then
  echo "ComfyUI did not become ready within ${STARTUP_TIMEOUT}s; see $WORKSPACE/logs/comfyui.log" >&2
  exit 1
fi

python "$RIVET_HOME/rivet_admin.py" capture \
  --output "$WORKSPACE/manifests/environment-current.json" \
  --manifests-dir "$RIVET_HOME/manifests" \
  --comfyui-home "$COMFYUI_HOME" \
  --build-freeze "$RIVET_HOME/python-freeze-build.txt"

cd "$RIVET_HOME"
uvicorn rivet_worker_api:app --host 0.0.0.0 --port 8000 --no-access-log &
API_PID=$!
wait -n "$COMFY_PID" "$API_PID"
