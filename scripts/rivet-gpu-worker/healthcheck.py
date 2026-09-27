from __future__ import annotations

import json
import sys
import urllib.request

try:
    with urllib.request.urlopen("http://127.0.0.1:8000/healthz", timeout=3) as response:
        payload = json.load(response)
    if response.status != 200 or payload.get("status") != "ready":
        raise RuntimeError(f"worker not ready: {payload}")
except Exception as exc:
    print(exc, file=sys.stderr)
    raise SystemExit(1)
