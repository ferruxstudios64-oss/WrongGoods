FROM pytorch/pytorch:2.9.1-cuda12.8-cudnn9-runtime

ARG DEBIAN_FRONTEND=noninteractive
ARG COMFYUI_REF=v0.36.0

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    COMFYUI_HOME=/opt/ComfyUI \
    RIVET_HOME=/opt/rivet \
    WORKSPACE=/workspace \
    RIVET_BLUEPRINT_VERSION=1.0.0

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl ffmpeg git libgl1 libglib2.0-0 tini \
    && rm -rf /var/lib/apt/lists/*

RUN git clone --filter=blob:none --branch "${COMFYUI_REF}" --depth 1 \
      https://github.com/Comfy-Org/ComfyUI.git "${COMFYUI_HOME}" \
    && git -C "${COMFYUI_HOME}" rev-parse HEAD > /opt/comfyui.commit \
    && python -m pip install --no-cache-dir -r "${COMFYUI_HOME}/requirements.txt"

WORKDIR ${RIVET_HOME}
COPY requirements-worker.txt ./requirements-worker.txt
RUN python -m pip install --no-cache-dir -r requirements-worker.txt

COPY rivet_worker_api.py healthcheck.py rivet_admin.py entrypoint.sh extra_model_paths.yaml ./
COPY manifests ./manifests

RUN python rivet_admin.py install-nodes \
      --manifest manifests/custom-nodes.lock.json \
      --target "${COMFYUI_HOME}/custom_nodes" \
    && chmod +x entrypoint.sh

VOLUME ["/workspace"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD python /opt/rivet/healthcheck.py

ENTRYPOINT ["/usr/bin/tini","--","/opt/rivet/entrypoint.sh"]
