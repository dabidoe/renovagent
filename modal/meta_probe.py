"""Phase A probe: does Meta's model catalog resolve from Modal's network?

Railway gets model_not_found / empty /v1/models for our keys while a laptop
succeeds. This runs the same catalog reads from a Modal container to isolate
whether the difference is the egress network.

Needs the Modal secret `renovagent-meta` with MUSE_API_KEY (create once):
    modal secret create renovagent-meta MUSE_API_KEY='<key>'

Run (prints statuses, model count, x-request-id, egress IP — never the key):
    .local/modal-venv/bin/modal run modal/meta_probe.py
"""

import json
import os
import urllib.error
import urllib.request
from typing import Dict, Optional

import modal

META_API = "https://api.meta.ai/v1"
MODEL = "muse-spark-1.3"

image = modal.Image.debian_slim(python_version="3.11")
app = modal.App("renovagent-meta-probe", image=image)
secret = modal.Secret.from_name("renovagent-meta")


def fetch(url: str, headers: Optional[Dict[str, str]] = None, timeout: int = 30) -> dict:
    req = urllib.request.Request(url, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            raw = res.read().decode("utf-8", "replace")
            return {"status": res.status, "request_id": res.headers.get("x-request-id"), "body": raw[:2000]}
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", "replace")
        return {"status": e.code, "request_id": e.headers.get("x-request-id"), "body": raw[:2000]}
    except Exception as e:  # noqa: BLE001 - network errors are the signal here
        return {"status": None, "request_id": None, "error": f"{type(e).__name__}"}


@app.function(secrets=[secret], timeout=180)
def probe() -> dict:
    key = os.environ.get("MUSE_API_KEY", "").strip()
    if not key:
        raise RuntimeError("renovagent-meta secret has no MUSE_API_KEY")
    auth = {"Authorization": f"Bearer {key}"}

    catalog = fetch(f"{META_API}/models", auth)
    model_count = None
    if catalog["status"] == 200:
        try:
            model_count = len(json.loads(catalog["body"]).get("data", []))
        except Exception:  # noqa: BLE001 - report unparseable, don't crash
            model_count = "unparseable"

    single = fetch(f"{META_API}/models/{MODEL}", auth)

    egress = fetch("https://ipinfo.io/json", timeout=15)
    egress_ip: dict = {}
    if egress["status"] == 200:
        try:
            info = json.loads(egress["body"])
            egress_ip = {
                "ip": info.get("ip"),
                "region": info.get("region"),
                "country": info.get("country"),
                "org": info.get("org"),
            }
        except Exception:  # noqa: BLE001 - report unparseable, don't crash
            egress_ip = {"raw": egress["body"][:200]}

    return {
        "catalog_status": catalog["status"],
        "catalog_request_id": catalog.get("request_id"),
        "catalog_model_count": model_count,
        "single_status": single["status"],
        "single_request_id": single.get("request_id"),
        "single_body": single.get("body", "")[:300],
        "egress": egress_ip or {"error": egress.get("error", "unknown")},
    }


@app.local_entrypoint()
def main() -> None:
    print(json.dumps(probe.remote(), indent=2))
