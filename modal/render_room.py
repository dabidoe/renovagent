"""High-quality room renders: Blender Cycles on a Modal GPU.

The same Blender script as `npm run render:room` (scripts/blender/room_to_blender.py)
renders the measured room model the API sends: an eye-level interior, a
dollhouse perspective, a top-down plan and the room as GLB.

Deploy (needs `modal token new` once):
    .local/modal-venv/bin/modal deploy modal/render_room.py

The API (apps/api/src/hq-render.ts) calls POST /submit with the room model and
polls GET /result/{id}. Both need the X-Renovagent-Token header, whose value is
the RENDER_TOKEN in the Modal secret `renovagent-render` and
RENOVAGENT_RENDER_TOKEN on the API.
"""

import base64
import json
import os
import pathlib
import subprocess
import tempfile

import modal

BLENDER = "3.6.19"
# Published checksum for blender-3.6.19-linux-x64.tar.xz (blender.org .sha256,
# identical on the OCF and NLUUG mirrors). The build fails on a mismatch.
BLENDER_SHA256 = "409503678b874fa04b5c6c883b5b5e9cc846a37a8f3e75ab2309729a644cf812"
MIRROR = "https://mirrors.ocf.berkeley.edu/blender/release/Blender3.6"
SCRIPT = pathlib.Path(__file__).resolve().parent.parent / "scripts" / "blender" / "room_to_blender.py"
OUTPUTS = ("interior.png", "perspective.png", "plan-top.png", "room.glb")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install(
        "wget",
        "xz-utils",
        "libxi6",
        "libxxf86vm1",
        "libxfixes3",
        "libxrender1",
        "libgl1",
        "libegl1",
        "libxkbcommon0",
        "libsm6",
        "libice6",
        "libgomp1",
    )
    .run_commands(
        f"wget -q {MIRROR}/blender-{BLENDER}-linux-x64.tar.xz -O /tmp/blender.tar.xz",
        f"echo '{BLENDER_SHA256}  /tmp/blender.tar.xz' | sha256sum -c -",
        "mkdir -p /opt/blender"
        " && tar -xJf /tmp/blender.tar.xz -C /opt/blender --strip-components=1"
        " && rm /tmp/blender.tar.xz",
    )
    .pip_install("fastapi[standard]")
    .add_local_file(SCRIPT, "/app/room_to_blender.py")
)
app = modal.App("renovagent-render", image=image)
secret = modal.Secret.from_name("renovagent-render")


@app.function(gpu="T4", timeout=600)
def render(model: dict) -> dict:
    with tempfile.TemporaryDirectory() as out:
        path = os.path.join(out, "room-model.json")
        with open(path, "w") as f:
            json.dump(model, f)
        run = subprocess.run(
            [
                "/opt/blender/blender",
                "--background",
                "--factory-startup",
                "--python",
                "/app/room_to_blender.py",
                "--",
                path,
                out,
            ],
            capture_output=True,
            text=True,
            timeout=540,
        )
        lines = run.stdout.splitlines()
        if run.returncode != 0 or not any(l.startswith("RENOVAGENT") for l in lines):
            raise RuntimeError("Blender did not finish: " + (run.stderr or run.stdout)[-600:])
        device = next((l for l in lines if l.startswith("Cycles device:")), "Cycles device: unknown")
        files = {}
        for name in OUTPUTS:
            with open(os.path.join(out, name), "rb") as f:
                files[name] = base64.b64encode(f.read()).decode()
        return {"files": files, "device": device.split(":", 1)[1].strip(), "blender": BLENDER}


@app.function(secrets=[secret])
@modal.asgi_app()
def api():
    import hmac

    from fastapi import FastAPI, Header, HTTPException

    web = FastAPI()

    def check(token: str):
        if not hmac.compare_digest(token.encode(), os.environ["RENDER_TOKEN"].encode()):
            raise HTTPException(status_code=401, detail="unauthorized")

    @web.post("/submit")
    def submit(body: dict, x_renovagent_token: str = Header("")):
        check(x_renovagent_token)
        model = body.get("model")
        if not isinstance(model, dict) or not isinstance(model.get("walls"), list):
            raise HTTPException(status_code=400, detail="model with walls required")
        if len(json.dumps(model)) > 2_000_000:
            raise HTTPException(status_code=400, detail="model too large")
        call = render.spawn(model)
        return {"id": call.object_id}

    @web.get("/result/{call_id}")
    def result(call_id: str, x_renovagent_token: str = Header("")):
        check(x_renovagent_token)
        try:
            out = modal.FunctionCall.from_id(call_id).get(timeout=0)
        except TimeoutError:
            return {"status": "running"}
        except Exception as e:  # noqa: BLE001 - reported to the caller
            return {"status": "failed", "error": str(e)[:300]}
        return {"status": "done", **out}

    return web
