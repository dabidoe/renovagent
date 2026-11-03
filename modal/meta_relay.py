"""Meta Model API relay: same key, clean egress.

Railway gets model_not_found from api.meta.ai while other networks succeed
with the same key. This forwards our three Meta calls from Modal's network so
Railway only ever talks to Modal.

Endpoints (all need the X-Renovagent-Token header, value RELAY_TOKEN):
    POST /relay/responses      -> POST https://api.meta.ai/v1/responses
    POST /relay/images/edits   -> POST https://api.meta.ai/v1/images/edits
    GET  /relay/models/{id}    -> GET  https://api.meta.ai/v1/models/{id}

Upstream status and body pass through verbatim (plus x-request-id), so the
API's existing error parsing works unchanged. Logs carry method, path,
upstream status, latency and request id only — never bodies or tokens.

Secrets (create once):
    modal secret create renovagent-meta MUSE_API_KEY='<meta key>'
    modal secret create renovagent-meta-relay RELAY_TOKEN='<random 64 hex>'

Deploy:
    .local/modal-venv/bin/modal deploy modal/meta_relay.py

Railway then needs only:
    RENOVAGENT_META_BASE_URL=https://<deploy-output-host>
    RENOVAGENT_META_TOKEN=<the RELAY_TOKEN value>
"""

import os
import time
import urllib.error
import urllib.request
from typing import Optional

import modal

META_API = "https://api.meta.ai/v1"
UPSTREAM_TIMEOUT = 270

image = modal.Image.debian_slim(python_version="3.11").pip_install("fastapi[standard]")
app = modal.App("renovagent-meta-relay", image=image)
meta_secret = modal.Secret.from_name("renovagent-meta")
relay_secret = modal.Secret.from_name("renovagent-meta-relay")


@app.function(secrets=[meta_secret, relay_secret], timeout=330, region="us-east")
@modal.asgi_app()
def api():
    import hmac
    import json

    from fastapi import FastAPI, Header, Request, Response

    web = FastAPI()
    key = os.environ["MUSE_API_KEY"]
    token = os.environ["RELAY_TOKEN"]

    def check(presented: str):
        if not presented or not hmac.compare_digest(presented.encode(), token.encode()):
            return Response(
                content=json.dumps({"error": {"code": "unauthorized", "message": "unauthorized"}}),
                status_code=401,
                media_type="application/json",
            )
        return None

    def forward(method: str, path: str, body: Optional[bytes]):
        started = time.monotonic()
        req = urllib.request.Request(
            META_API + path,
            data=body,
            method=method,
            headers={"Authorization": "Bearer %s" % key, "Content-Type": "application/json"},
        )
        try:
            with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT) as res:
                payload = res.read()
                status = res.status
                request_id = res.headers.get("x-request-id")
        except urllib.error.HTTPError as e:
            payload = e.read()
            status = e.code
            request_id = e.headers.get("x-request-id")
        except Exception as e:  # noqa: BLE001 - network errors become 502s
            print("relay upstream failed: %s %s %s" % (method, path, type(e).__name__), flush=True)
            return Response(
                content=json.dumps(
                    {"error": {"code": "relay_upstream_unreachable", "message": "Meta Model API unreachable via relay"}}
                ),
                status_code=502,
                media_type="application/json",
            )
        ms = int((time.monotonic() - started) * 1000)
        print(
            "relay %s %s -> upstream %d in %dms request_id=%s" % (method, path, status, ms, request_id),
            flush=True,
        )
        headers = {"x-request-id": request_id} if request_id else {}
        return Response(content=payload, status_code=status, media_type="application/json", headers=headers)

    @web.post("/relay/responses")
    async def relay_responses(request: Request, x_renovagent_token: str = Header("")):
        denied = check(x_renovagent_token)
        if denied is not None:
            return denied
        return forward("POST", "/responses", await request.body())

    @web.post("/relay/images/edits")
    async def relay_edits(request: Request, x_renovagent_token: str = Header("")):
        denied = check(x_renovagent_token)
        if denied is not None:
            return denied
        return forward("POST", "/images/edits", await request.body())

    @web.get("/relay/models/{model_id}")
    async def relay_model(model_id: str, x_renovagent_token: str = Header("")):
        denied = check(x_renovagent_token)
        if denied is not None:
            return denied
        if not model_id or len(model_id) > 200 or "/" in model_id:
            return Response(
                content=json.dumps({"error": {"code": "bad_model_id", "message": "bad model id"}}),
                status_code=400,
                media_type="application/json",
            )
        return forward("GET", "/models/" + model_id, None)

    return web
