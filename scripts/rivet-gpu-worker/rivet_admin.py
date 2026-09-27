from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import shutil
import subprocess
import sys
import tempfile
from typing import Any

import requests


def load_json(path: pathlib.Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def safe_relative(value: str) -> pathlib.Path:
    path = pathlib.PurePosixPath(value)
    if path.is_absolute() or ".." in path.parts or not path.parts:
        raise ValueError(f"unsafe relative path: {value!r}")
    return pathlib.Path(*path.parts)


def sha256_file(path: pathlib.Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(8 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def install_nodes(manifest_path: pathlib.Path, target: pathlib.Path) -> None:
    manifest = load_json(manifest_path)
    if manifest.get("schema") != 1 or not isinstance(manifest.get("nodes"), list):
        raise ValueError("invalid custom-node manifest")
    target.mkdir(parents=True, exist_ok=True)
    for node in manifest["nodes"]:
        name = node["name"]
        repo = node["repo"]
        commit = node["commit"]
        dest = target / name
        if dest.exists():
            shutil.rmtree(dest)
        subprocess.run(["git", "clone", "--filter=blob:none", repo, str(dest)], check=True)
        subprocess.run(["git", "-C", str(dest), "checkout", "--detach", commit], check=True)
        requirements = dest / "requirements.txt"
        if requirements.exists():
            subprocess.run([sys.executable, "-m", "pip", "install", "--no-cache-dir", "-r", str(requirements)], check=True)
        if node.get("run_install_py"):
            install_py = dest / "install.py"
            if not install_py.exists():
                raise FileNotFoundError(f"{name}: run_install_py requested but install.py is missing")
            subprocess.run([sys.executable, str(install_py)], cwd=dest, check=True)


def sync_models(manifest_path: pathlib.Path, root: pathlib.Path, verify_only: bool) -> None:
    manifest = load_json(manifest_path)
    if manifest.get("schema") != 1 or not isinstance(manifest.get("models"), list):
        raise ValueError("invalid model manifest")
    root.mkdir(parents=True, exist_ok=True)
    for model in manifest["models"]:
        if model.get("enabled", True) is False:
            continue
        model_id = model["id"]
        rel = safe_relative(model["path"])
        expected = model["sha256"].lower()
        if len(expected) != 64:
            raise ValueError(f"{model_id}: sha256 must be 64 hex characters")
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
        with tempfile.NamedTemporaryFile(dir=dest.parent, delete=False) as tmp:
            tmp_path = pathlib.Path(tmp.name)
            with requests.get(url, headers=headers, stream=True, timeout=(20, 300)) as response:
                response.raise_for_status()
                for chunk in response.iter_content(chunk_size=8 * 1024 * 1024):
                    if chunk:
                        tmp.write(chunk)
        actual = sha256_file(tmp_path)
        if actual != expected:
            tmp_path.unlink(missing_ok=True)
            raise RuntimeError(f"{model_id}: checksum mismatch: expected {expected}, got {actual}")
        tmp_path.replace(dest)
        print(f"DOWNLOADED {model_id}: {dest}")


def capture_environment(output: pathlib.Path) -> None:
    def run(command: list[str]) -> str | None:
        try:
            result = subprocess.run(command, check=True, capture_output=True, text=True, timeout=20)
            return result.stdout.strip()
        except Exception:
            return None

    comfy_home = pathlib.Path(os.getenv("COMFYUI_HOME", "/opt/ComfyUI"))
    payload = {
        "blueprint_version": os.getenv("RIVET_BLUEPRINT_VERSION", "unknown"),
        "comfyui_commit": run(["git", "-C", str(comfy_home), "rev-parse", "HEAD"]),
        "python": sys.version,
        "torch": None,
        "cuda": None,
        "gpu": run(["nvidia-smi", "--query-gpu=name,driver_version,memory.total", "--format=csv,noheader"]),
        "pip_freeze": run([sys.executable, "-m", "pip", "freeze"]),
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


def validate(manifests_dir: pathlib.Path) -> None:
    nodes = load_json(manifests_dir / "custom-nodes.lock.json")
    models = load_json(manifests_dir / "models.manifest.json")
    if nodes.get("schema") != 1 or not isinstance(nodes.get("nodes"), list):
        raise ValueError("invalid custom-nodes.lock.json")
    for node in nodes["nodes"]:
        for field in ("name", "repo", "commit"):
            if not isinstance(node.get(field), str) or not node[field].strip():
                raise ValueError(f"custom node missing {field}")
    if models.get("schema") != 1 or not isinstance(models.get("models"), list):
        raise ValueError("invalid models.manifest.json")
    for model in models["models"]:
        for field in ("id", "path", "sha256"):
            if not isinstance(model.get(field), str) or not model[field].strip():
                raise ValueError(f"model missing {field}")
        safe_relative(model["path"])
        int(model["sha256"], 16)
        if len(model["sha256"]) != 64:
            raise ValueError(f"{model['id']}: invalid sha256")
    print("RIVET GPU worker blueprint manifests: VALID")


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

    p = sub.add_parser("validate")
    p.add_argument("--manifests-dir", type=pathlib.Path, default=pathlib.Path("manifests"))

    args = parser.parse_args()
    if args.command == "install-nodes":
        install_nodes(args.manifest, args.target)
    elif args.command == "sync-models":
        sync_models(args.manifest, args.root, args.verify_only)
    elif args.command == "capture":
        capture_environment(args.output)
    elif args.command == "validate":
        validate(args.manifests_dir)


if __name__ == "__main__":
    main()
