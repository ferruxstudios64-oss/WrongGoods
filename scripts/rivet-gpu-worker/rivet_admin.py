from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
from typing import Any
from urllib.parse import urlparse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

NODE_NAME = re.compile(r"^[A-Za-z0-9._-]+$")
GIT_COMMIT = re.compile(r"^[0-9a-f]{40}$")
SHA256 = re.compile(r"^[0-9a-f]{64}$")
MODEL_TOKEN_PREFIX = "RIVET_MODEL_TOKEN_"


def load_json(path: pathlib.Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def safe_relative(value: str) -> pathlib.Path:
    path = pathlib.PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts or any(part in ("", ".") for part in path.parts):
        raise ValueError(f"unsafe relative path: {value!r}")
    return pathlib.Path(*path.parts)


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def sha256_text(value: str) -> str:
    return hashlib.sha256(value.encode("utf-8")).hexdigest()


def pip_freeze() -> str:
    result = subprocess.run(
        [sys.executable, "-m", "pip", "freeze"],
        check=True,
        capture_output=True,
        text=True,
        timeout=60,
    )
    lines = sorted(line.strip() for line in result.stdout.splitlines() if line.strip())
    return "\n".join(lines) + "\n"


def validate_node(node: dict[str, Any]) -> None:
    for field in ("name", "repo", "commit"):
        if not isinstance(node.get(field), str) or not node[field].strip():
            raise ValueError(f"custom node missing {field}")
    if not NODE_NAME.fullmatch(node["name"]):
        raise ValueError(f"unsafe custom-node name: {node['name']!r}")
    if not GIT_COMMIT.fullmatch(node["commit"]):
        raise ValueError(f"{node['name']}: commit must be an exact 40-character lowercase Git SHA")
    parsed = urlparse(node["repo"])
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError(f"{node['name']}: repo must be an https URL")


def validate_model(model: dict[str, Any]) -> None:
    for field in ("id", "path", "sha256"):
        if not isinstance(model.get(field), str) or not model[field].strip():
            raise ValueError(f"model missing {field}")
    safe_relative(model["path"])
    if not SHA256.fullmatch(model["sha256"].lower()):
        raise ValueError(f"{model['id']}: invalid sha256")
    url = model.get("url")
    if url:
        parsed = urlparse(url)
        if parsed.scheme != "https" or not parsed.netloc:
            raise ValueError(f"{model['id']}: model URL must use https")
    auth_env = model.get("auth_env")
    if auth_env and (not isinstance(auth_env, str) or not auth_env.startswith(MODEL_TOKEN_PREFIX)):
        raise ValueError(f"{model['id']}: auth_env must start with {MODEL_TOKEN_PREFIX}")


def install_nodes(manifest_path: pathlib.Path, target: pathlib.Path) -> None:
    manifest = load_json(manifest_path)
    if manifest.get("schema") != 1 or not isinstance(manifest.get("nodes"), list):
        raise ValueError("invalid custom-node manifest")
    target.mkdir(parents=True, exist_ok=True)
    for node in manifest["nodes"]:
        validate_node(node)
        name = node["name"]
        repo = node["repo"]
        commit = node["commit"]
        dest = target / name
        if dest.exists():
            shutil.rmtree(dest)
        subprocess.run(["git", "clone", "--filter=blob:none", repo, str(dest)], check=True)
        subprocess.run(["git", "-C", str(dest), "checkout", "--detach", commit], check=True)
        actual = subprocess.run(
            ["git", "-C", str(dest), "rev-parse", "HEAD"],
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()
        if actual != commit:
            raise RuntimeError(f"{name}: expected commit {commit}, got {actual}")
        requirements = dest / "requirements.txt"
        if requirements.exists():
            subprocess.run([sys.executable, "-m", "pip", "install", "--no-cache-dir", "-r", str(requirements)], check=True)
        if node.get("run_install_py"):
            install_py = dest / "install.py"
            if not install_py.exists():
                raise FileNotFoundError(f"{name}: run_install_py requested but install.py is missing")
            subprocess.run([sys.executable, str(install_py)], cwd=dest, check=True)


def download_session() -> requests.Session:
    retry = Retry(
        total=5,
        connect=5,
        read=5,
        status=5,
        backoff_factor=1.5,
        status_forcelist=(429, 500, 502, 503, 504),
        allowed_methods=frozenset({"GET"}),
        respect_retry_after_header=True,
    )
    session = requests.Session()
    session.mount("https://", HTTPAdapter(max_retries=retry))
    return session


def sync_models(manifest_path: pathlib.Path, root: pathlib.Path, verify_only: bool) -> None:
    manifest = load_json(manifest_path)
    if manifest.get("schema") != 1 or not isinstance(manifest.get("models"), list):
        raise ValueError("invalid model manifest")
    root.mkdir(parents=True, exist_ok=True)
    session = download_session()
    for model in manifest["models"]:
        if model.get("enabled", True) is False:
            continue
        validate_model(model)
        model_id = model["id"]
        rel = safe_relative(model["path"])
        expected = model["sha256"].lower()
        dest = root / rel
        if dest.exists() and sha256_file(dest) == expected:
            print(f"OK {model_id}: {dest}")
            continue
        if verify_only:
            raise RuntimeError(f"{model_id}: missing or checksum mismatch: {dest}")
        url = model.get("url")
        if not url:
            raise RuntimeError(f"{model_id}: no URL configured")
        headers: dict[str, str] = {}
        auth_env = model.get("auth_env")
        if auth_env:
            token = os.getenv(auth_env)
            if not token:
                raise RuntimeError(f"{model_id}: required environment variable {auth_env} is not set")
            headers["Authorization"] = f"Bearer {token}"
        dest.parent.mkdir(parents=True, exist_ok=True)
        temp_path: pathlib.Path | None = None
        try:
            with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False) as tmp:
                temp_path = pathlib.Path(tmp.name)
                with session.get(url, headers=headers, stream=True, timeout=(20, 300)) as response:
                    response.raise_for_status()
                    for chunk in response.iter_content(chunk_size=8 * 1024 * 1024):
                        if chunk:
                            tmp.write(chunk)
            actual = sha256_file(temp_path)
            if actual != expected:
                raise RuntimeError(f"{model_id}: checksum mismatch: expected {expected}, got {actual}")
            temp_path.replace(dest)
            temp_path = None
            print(f"DOWNLOADED {model_id}: {dest}")
        finally:
            if temp_path is not None:
                temp_path.unlink(missing_ok=True)


def validate(manifests_dir: pathlib.Path) -> None:
    nodes = load_json(manifests_dir / "custom-nodes.lock.json")
    models = load_json(manifests_dir / "models.manifest.json")
    if nodes.get("schema") != 1 or not isinstance(nodes.get("nodes"), list):
        raise ValueError("invalid custom-nodes.lock.json")
    for node in nodes["nodes"]:
        validate_node(node)
    if models.get("schema") != 1 or not isinstance(models.get("models"), list):
        raise ValueError("invalid models.manifest.json")
    for model in models["models"]:
        validate_model(model)
    print("RIVET GPU worker blueprint manifests: VALID")


def verify_runtime(
    manifests_dir: pathlib.Path,
    comfyui_home: pathlib.Path,
    build_freeze: pathlib.Path,
) -> None:
    validate(manifests_dir)
    expected_commit = os.getenv("RIVET_COMFYUI_COMMIT", "")
    actual_commit = subprocess.run(
        ["git", "-C", str(comfyui_home), "rev-parse", "HEAD"],
        check=True,
        capture_output=True,
        text=True,
        timeout=20,
    ).stdout.strip()
    if not expected_commit or actual_commit != expected_commit:
        raise RuntimeError(f"ComfyUI commit drift: expected {expected_commit or '<unset>'}, got {actual_commit}")
    expected_freeze = build_freeze.read_text(encoding="utf-8")
    current_freeze = pip_freeze()
    if current_freeze != expected_freeze:
        raise RuntimeError(
            "Python environment drift detected: "
            f"build={sha256_text(expected_freeze)} current={sha256_text(current_freeze)}"
        )
    print("RIVET runtime environment: VERIFIED")


def capture_environment(
    output: pathlib.Path,
    manifests_dir: pathlib.Path,
    comfyui_home: pathlib.Path,
    build_freeze: pathlib.Path,
) -> None:
    def run(command: list[str]) -> str | None:
        try:
            result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=20)
            return result.stdout.strip()
        except Exception:
            return None

    current_freeze = pip_freeze()
    built_freeze = build_freeze.read_text(encoding="utf-8") if build_freeze.exists() else ""
    payload = {
        "blueprint_version": os.getenv("RIVET_BLUEPRINT_VERSION", "unknown"),
        "image_ref": os.getenv("RIVET_IMAGE_REF"),
        "comfyui_commit": run(["git", "-C", str(comfyui_home), "rev-parse", "HEAD"]),
        "expected_comfyui_commit": os.getenv("RIVET_COMFYUI_COMMIT"),
        "python": sys.version,
        "torch": None,
        "cuda": None,
        "gpu": run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"]),
        "pip_freeze_sha256": sha256_text(current_freeze),
        "build_pip_freeze_sha256": sha256_text(built_freeze) if built_freeze else None,
        "python_environment_matches_build": bool(built_freeze and current_freeze == built_freeze),
        "models_manifest_sha256": sha256_file(manifests_dir / "models.manifest.json"),
        "custom_nodes_manifest_sha256": sha256_file(manifests_dir / "custom-nodes.lock.json"),
    }
    try:
        import torch

        payload["torch"] = torch.__version__
        payload["cuda"] = torch.version.cuda
    except Exception:
        pass
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")
    print(output)


def add_common_runtime_args(parser: argparse.ArgumentParser) -> None:
    parser.add_argument("--manifests-dir", type=pathlib.Path, default=pathlib.Path("manifests"))
    parser.add_argument("--comfyui-home", type=pathlib.Path, default=pathlib.Path(os.getenv("COMFYUI_HOME", "/opt/ComfyUI")))
    parser.add_argument("--build-freeze", type=pathlib.Path, default=pathlib.Path("/opt/rivet/python-freeze-build.txt"))


def main() -> None:
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("install-nodes")
    p.add_argument("--manifest", type=pathlib.Path, required=True)
    p.add_argument("--target", type=pathlib.Path, required=True)

    p = sub.add_parser("sync-models")
    p.add_argument("--manifest", type=pathlib.Path, required=True)
    p.add_argument("--root", type=pathlib.Path, default=pathlib.Path("/workspace/models"))
    p.add_argument("--verify-only", action="store_true")

    p = sub.add_parser("capture")
    p.add_argument("--output", type=pathlib.Path, default=pathlib.Path("/workspace/manifests/environment-current.json"))
    add_common_runtime_args(p)

    p = sub.add_parser("validate")
    p.add_argument("--manifests-dir", type=pathlib.Path, default=pathlib.Path("manifests"))

    p = sub.add_parser("verify-runtime")
    add_common_runtime_args(p)

    args = parser.parse_args()
    if args.command == "install-nodes":
        install_nodes(args.manifest, args.target)
    elif args.command == "sync-models":
        sync_models(args.manifest, args.root, args.verify_only)
    elif args.command == "capture":
        capture_environment(args.output, args.manifests_dir, args.comfyui_home, args.build_freeze)
    elif args.command == "validate":
        validate(args.manifests_dir)
    elif args.command == "verify-runtime":
        verify_runtime(args.manifests_dir, args.comfyui_home, args.build_freeze)


if __name__ == "__main__":
    main()
