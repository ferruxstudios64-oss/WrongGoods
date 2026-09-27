FROM pytorch/pytorch:2.9.1-cuda12.8-cudnn9-runtime@sha256:7b324d212a4450795b49edba9949b7cdc72429148a64e974334bfe5774d51385

ARG DEBIAN_FRONTEND=noninteractive
ARG COMFYUI_COMMIT=ee71d5c4993f29086b27fde1629a945ae48425bf

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    COMFYUI_HOME=/opt/ComfyUI \
    RIVET_HOME=/opt/rivet \
    WORKSPACE=/workspace \
    RIVET_BLUEPRINT_VERSION=1.0.1 \
    RIVET_COMFYUI_COMMIT=${COMFYUI_COMMIT}

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl ffmpeg git libgl1 libglib2.0-0 tini \
    && rm -rf /var/lib/apt/lists/*

RUN git init "${COMFYUI_HOME}" \
    && git -C "${COMFYUI_HOME}" remote add origin https://github.com/Comfy-Org/ComfyUI.git \
    && git -C "${COMFYUI_HOME}" fetch --depth 1 origin "${COMFYUI_COMMIT}" \
    && git -C "${COMFYUI_HOME}" checkout --detach FETCH_HEAD \
    && test "$(git -C "${COMFYUI_HOME}" rev-parse HEAD)" = "${COMFYUI_COMMIT}" \
    && python -m pip install --no-cache-dir -r "${COMFYUI_HOME}/requirements.txt"

WORKDIR ${RIVET_HOME}
COPY requirements-worker.txt ./requirements-worker.txt
RUN python -m pip install --no-cache-dir -r requirements-worker.txt

COPY rivet_worker_api.py healthcheck.py rivet_admin.py entrypoint.sh extra_model_paths.yaml ./
COPY manifests ./manifests

RUN python rivet_admin.py install-nodes \
      --manifest manifests/custom-nodes.lock.json \
      --target "${COMFYUI_HOME}/custom_nodes" \
    && chmod +x entrypoint.sh \
    && python -m pip freeze | LC_ALL=C sort > /opt/rivet/python-freeze-build.txt \
    && sha256sum /opt/rivet/python-freeze-build.txt > /opt/rivet/python-freeze-build.sha256

LABEL org.opencontainers.image.title="RIVET GPU Worker" \
      org.opencontainers.image.description="Reproducible GPU worker for WrongGoods RIVET" \
      org.opencontainers.image.version="1.0.1"

VOLUME ["/workspace"]
EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=5s --start-period=120s --retries=3 \
  CMD python /opt/rivet/healthcheck.py

ENTRYPOINT ["/usr/bin/tini","--","/opt/rivet/entrypoint.sh"]
