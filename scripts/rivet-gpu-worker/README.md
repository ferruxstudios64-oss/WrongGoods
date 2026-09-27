# RIVET GPU Worker Blueprint v1

Reproducible, disposable NVIDIA GPU worker for **RIVET — WrongGoods Production Engine**.

The software environment is immutable in the container; reusable heavyweight data lives under `/workspace`. A GPU host can therefore be destroyed and replaced without rebuilding the production stack manually.

## Pinned baseline

- `pytorch/pytorch:2.9.1-cuda12.8-cudnn9-runtime`
- ComfyUI `v0.36.0`
- worker packages pinned in `requirements-worker.txt`
- custom nodes pinned by exact commit in `manifests/custom-nodes.lock.json`
- models pinned by SHA-256 in `manifests/models.manifest.json`

## Runtime layout

```text
/opt/ComfyUI              pinned ComfyUI + pinned custom nodes
/opt/rivet                worker API + manifests + tools

/workspace                persistent data
  models/
  input/
  output/
  user/
  logs/
  manifests/
```

ComfyUI listens on `127.0.0.1:8188` by default. The authenticated RIVET API listens on port `8000`.

## Required environment

Set `RIVET_WORKER_TOKEN` to a long random bearer token. `RIVET_ALLOW_INSECURE=1` is for isolated local testing only.

Optional:
- `RIVET_SYNC_MODELS_ON_START=1` verifies/downloads the model manifest.
- token variables such as `HF_TOKEN` may be referenced by model entries through `auth_env`.
- `RIVET_EXPOSE_COMFYUI=1` exposes native ComfyUI on 8188; use only behind provider auth or an SSH tunnel.
- `RIVET_COMFY_EXTRA_ARGS` adds ComfyUI CLI flags.

## Models

Do not bake weights into the image. Each manifest entry records `id`, relative `path`, `url`, exact `sha256`, and optional `auth_env`.

Run:

```bash
python /opt/rivet/rivet_admin.py sync-models \
  --manifest /opt/rivet/manifests/models.manifest.json \
  --root /workspace/models
```

Add `--verify-only` to verify the persistent model store without downloading.

## Custom nodes

Every custom node must use an exact Git commit. The build installs its `requirements.txt` automatically; `install.py` runs only when `run_install_py` is explicitly true.

## API

Use `Authorization: Bearer <RIVET_WORKER_TOKEN>`.

- `GET /healthz` readiness only.
- `GET /v1/system` GPU + ComfyUI information.
- `POST /v1/jobs` submit a ComfyUI API-format workflow.
- `GET /v1/jobs/{prompt_id}` retrieve history.
- `GET /v1/queue` inspect queue.
- `POST /v1/interrupt` interrupt the current job.

## RunPod

Publish the image, create a Pod template, create a network volume mounted at `/workspace`, keep the Pod in the same data centre as the volume, expose `8000/http`, and set `RIVET_WORKER_TOKEN` in environment settings. Network volumes are preferred for the first reproducibility test because they survive Pod termination.

## Vast

Publish the same image and create a Vast template. Expose 8000 through Vast's authenticated/TLS portal or SSH tunnelling, store `RIVET_WORKER_TOKEN` outside Git, and account for GPU, storage and bandwidth pricing. Destroying an instance deletes instance data, so keep durable model/output copies outside disposable instance storage or use suitable Vast storage/cloud-sync facilities.

## First acceptance test

1. Populate only the minimum models and custom nodes for one known workflow.
2. Publish the image.
3. Start worker A; run the fixed workflow and retain output plus `environment-current.json`.
4. Destroy worker A.
5. Start worker B from the same image and persistent model store.
6. Repeat the exact workflow/settings.
7. Compare environment evidence, model hashes, metadata and deterministic output where supported.
8. Promote the worker to RIVET production only after this passes.

## Security

No credentials belong in Git, Docker build args or model URLs. Prefer provider secrets/environment settings. Do not expose native ComfyUI directly to the public internet.
