import base64
import binascii
import os
raw = os.environ.get("VPS_SSH_KEY", "").strip()
if raw.startswith(("'", '"')) and raw[-1:] == raw[:1]:
    raw = raw[1:-1]
raw = raw.replace("\\r", "\r").replace("\\n", "\n").replace("\r", "")
key = raw.strip()
if key.startswith("VPS_SSH_KEY="):
    key = key.split("=", 1)[1].strip().strip("'\"")
if not key.startswith("-----BEGIN ") or "PRIVATE KEY-----" not in key:
    compact = "".join(key.split())
    try:
        decoded = base64.b64decode(compact, validate=True).decode("utf-8")
        decoded = decoded.replace("\\r", "\r").replace("\\n", "\n").replace("\r", "").strip()
        if decoded.startswith("-----BEGIN ") and "PRIVATE KEY-----" in decoded:
            key = decoded
    except (binascii.Error, UnicodeDecodeError, ValueError):
        pass
if not key.startswith("-----BEGIN ") or "PRIVATE KEY-----" not in key:
    raise SystemExit("Unsupported VPS_SSH_KEY format; secret value was not printed.")
with open("/tmp/vps_key", "w", encoding="utf-8") as stream:
    stream.write(key + "\n")
