# RIVET GPU Worker Blueprint v1

Reproducible, disposable NVIDIA GPU worker for **RIVET — WrongGoods Production Engine**.

The container is the immutable software layer; reusable heavyweight data lives under `/workspace`. A rented GPU host can therefore be destroyed and replaced without manually rebuilding the production stack.

## Pinned baseline

- `pytorch/pytorch:2.9.1-cuda12.8-cudnn9-runtime`, pinned to manifest digest `sha256:7b324d212a4450795b49edba9949b7cdc72429148a64e974334bfe5774d51385`
- ComfyUI commit `ee71d5c4993f29086b27fde1629a945ae48425bf` (`v0.36.0`)
- worker packages pinned in `requirements-worker.txt`
- custom nodes pinned by exact commit in `manifests/custom-nodes.lock.json`
- models pinned by SHA-256 in `manifests/models.manifest.json`
- the built Python environment is frozen inside the image and verified at startup

The Dockerfile is a build recipe. The canonical production identity is the published container **image digest**. Once an image passes acceptance, deploy that exact digest rather than rebuilding the same version.

## Runtime layout

```text
/opt/ComfyUI              pinned ComfyUI + pinned custom nodes
/opt/rivet                worker API + manifests + tools

/workspace                persistent data
  models/
  input/
  output/
  temp/
  user/
  logs/
  manifests/
```

ComfyUI listens on `127.0.0.1:8188` by default. The authenticated RIVET API listens on port `8000`.

## Required environment

Set `RIVET_WORKER_TOKEN` to a long random bearer token. The worker has no unauthenticated production mode.

Recommended:
- `RIVET_MIN_VRAM_GB` rejects an incorrectly allocated GPU before model downloads or production work begin; use `20` for a 24 GB-class worker.
- `RIVET_IMAGE_REF` records the exact deployed registry digest.

Optional:
- `RIVET_SYNC_MODELS_ON_START=1` downloads missing/mismatched manifest models; otherwise startup verifies the persistent model store and refuses to run with missing/corrupt required models.
- model-provider credentials may be referenced through `auth_env`, but dedicated variable names must begin `RIVET_MODEL_TOKEN_`; never reuse the worker bearer token.
- `RIVET_EXPOSE_COMFYUI=1` exposes native ComfyUI on 8188; use only behind provider auth or an SSH tunnel.
- `RIVET_COMFY_EXTRA_ARGS` adds ComfyUI CLI flags.
- `RIVET_STARTUP_TIMEOUT_SECONDS` defaults to 180.
- `RIVET_MAX_INPUT_BYTES` defaults to 512 MiB.

At startup the worker refuses to continue when CUDA is unavailable, VRAM is below the configured threshold, ComfyUI has drifted from the pinned commit, or the Python environment differs from the built image.

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
- `PUT /v1/inputs/{relative_path}` streams an input/reference file into persistent workspace; optional `X-RIVET-SHA256` verifies it.
- `GET /v1/outputs/{relative_path}` downloads an output with SHA-256 and byte-count headers.
- `POST /v1/jobs` submits a ComfyUI API-format workflow; an optional client-supplied `prompt_id` must be a canonical UUID.
- `GET /v1/jobs/{prompt_id}` retrieves history.
- `GET /v1/queue` inspects the queue.
- `POST /v1/interrupt` performs a global interrupt or accepts a `prompt_id` for a targeted interrupt.

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

## Security and production limits

- No credentials belong in Git, Docker build arguments, workflow JSON or model URLs.
- Native ComfyUI is not an internet-facing production API.
- Worker and model-provider tokens must be separate secrets.
- Custom nodes are executable code and require explicit review before their exact commit enters the manifest.
- The initial manifests are intentionally empty. This blueprint is infrastructure, not a sellable-asset production recipe until a real WrongGoods workflow, models and QA criteria are pinned and tested.
