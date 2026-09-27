#!/usr/bin/env bash
set -euo pipefail

WORKSPACE="${WORKSPACE:-/workspace}"
COMFYUI_HOME="${COMFYUI_HOME:-/opt/ComfyUI}"
RIVET_HOME="${RIVET_HOME:-/opt/rivet}"

mkdir -p \
  "$WORKSPACE/models" \
  "$WORKSPACE/input" \
  "$WORKSPACE/output" \
  "$WORKSPACE/user" \
  "$WORKSPACE/logs" \
  "$WORKSPACE/manifests"

if [[ "${RIVET_ALLOW_INSECURE:-0}" != "1" && -z "${RIVET_WORKER_TOKEN:-}" ]]; then
  echo "RIVET_WORKER_TOKEN is required. Set RIVET_ALLOW_INSECURE=1 only for isolated local testing." >&2
  exit 64
fi

if [[ "${RIVET_SYNC_MODELS_ON_START:-0}" == "1" ]]; then
  python "$RIVET_HOME/rivet_admin.py" sync-models \
    --manifest "$RIVET_HOME/manifests/models.manifest.json" \
    --root "$WORKSPACE/models"
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
  --user-directory "$WORKSPACE/user")

if [[ -n "${RIVET_COMFY_EXTRA_ARGS:-}" ]]; then
  read -r -a EXTRA_ARGS <<< "${RIVET_COMFY_EXTRA_ARGS}"
  COMFY_CMD+=("${EXTRA_ARGS[@]}")
fi

"${COMFY_CMD[@]}" >>"$WORKSPACE/logs/comfyui.log" 2>&1 &
COMFY_PID=$!

cleanup() {
  kill "$COMFY_PID" "${API_PID:-}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for _ in $(seq 1 120); do
  if python - <<'PY'
import urllib.request
try:
    urllib.request.urlopen("http://127.0.0.1:8188/system_stats", timeout=2).read()
except Exception:
    raise SystemExit(1)
PY
  then
    break
  fi
  if ! kill -0 "$COMFY_PID" 2>/dev/null; then
    echo "ComfyUI exited during startup; see $WORKSPACE/logs/comfyui.log" >&2
    exit 1
  fi
  sleep 1
done

python "$RIVET_HOME/rivet_admin.py" capture \
  --output "$WORKSPACE/manifests/environment-current.json" || true

cd "$RIVET_HOME"
uvicorn rivet_worker_api:app --host 0.0.0.0 --port 8000 --no-access-log &
API_PID=$!
wait -n "$COMFY_PID" "$API_PID"
