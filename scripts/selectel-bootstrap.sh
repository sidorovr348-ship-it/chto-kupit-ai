#!/usr/bin/env bash
set -Eeuo pipefail

# Safe first-run bootstrap for the isolated Selectel test VPS.
# Does not change DNS, install a public reverse proxy, or expose port 3020.
# Source checkout must already exist at /root/my-ai-unified.

SRC="/root/my-ai-unified"
DEST="/opt/my-ai-unified"
UNIT="/etc/systemd/system/my-ai-unified-test.service"
EXPECTED_COMMIT="d40c4af9635be428697468f61477e96783fd498e"
ENV_FILE="/etc/my-ai-unified.env"
PORT="3020"

log() { printf '\n[%s] %s\n' "$(date -Is)" "$*"; }
fail() { printf '\nERROR: %s\n' "$*" >&2; exit 1; }
on_error() {
  code=$?
  printf '\nBOOTSTRAP_FAILED exit=%s line=%s\n' "$code" "${BASH_LINENO[0]:-unknown}" >&2
  if command -v systemctl >/dev/null 2>&1 && systemctl list-unit-files "$UNIT" --no-legend 2>/dev/null | grep -q 'my-ai-unified-test.service'; then
    systemctl --no-pager --full status my-ai-unified-test.service || true
    journalctl -u my-ai-unified-test.service -n 60 --no-pager || true
  fi
  exit "$code"
}
trap on_error ERR

[[ "$(id -u)" -eq 0 ]] || fail "Run this script as root in the Selectel VPS."
[[ -d "$SRC/.git" ]] || fail "Repository missing at $SRC. Clone the repository first."
command -v node >/dev/null 2>&1 || fail "Node.js is not installed."
command -v npm >/dev/null 2>&1 || fail "npm is not installed."
command -v git >/dev/null 2>&1 || fail "git is not installed."
command -v systemctl >/dev/null 2>&1 || fail "systemd is not available."

actual_commit="$(git -C "$SRC" rev-parse HEAD)"
[[ "$actual_commit" == "$EXPECTED_COMMIT" ]] || fail "Unexpected source commit: $actual_commit (expected $EXPECTED_COMMIT). No changes made."

log "Preflight: source commit $actual_commit"
log "Disk space before setup"
df -h /

if id my-ai-unified >/dev/null 2>&1; then
  log "Service account already exists"
else
  useradd --system --home-dir /nonexistent --shell /usr/sbin/nologin my-ai-unified
fi

if [[ -e "$DEST" && ! -f "$UNIT" ]]; then
  fail "$DEST already exists but this script's service unit does not. Refusing to overwrite an unknown directory."
fi

if systemctl is-active --quiet my-ai-unified-test.service 2>/dev/null; then
  log "Stopping existing test service before updating its files"
  systemctl stop my-ai-unified-test.service
fi

install -d -o my-ai-unified -g my-ai-unified "$DEST"
log "Copying tracked source files only (no .git, node_modules, or local secret files)"
git -C "$SRC" archive HEAD | tar -x -C "$DEST"
chown -R my-ai-unified:my-ai-unified "$DEST"

log "Installing production dependencies"
runuser -u my-ai-unified -- bash -lc "cd '$DEST' && npm install --omit=dev --no-audit --no-fund"

log "Running repository test suite"
runuser -u my-ai-unified -- bash -lc "cd '$DEST' && npm test"

log "Checking production dependency audit (report only; no automatic dependency upgrades)"
if runuser -u my-ai-unified -- bash -lc "cd '$DEST' && npm audit --omit=dev --audit-level=high"; then
  echo "DEPENDENCY_AUDIT_OK"
else
  echo "DEPENDENCY_AUDIT_WARNING: review the report above; dependencies were not auto-upgraded."
fi

log "Writing isolated systemd service"
cat > "$UNIT" <<'SERVICE'
[Unit]
Description=My AI Unified isolated Selectel test instance
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=my-ai-unified
Group=my-ai-unified
WorkingDirectory=/opt/my-ai-unified
EnvironmentFile=-/etc/my-ai-unified.env
Environment=PORT=3020
Environment=ENV_FILE=/etc/my-ai-unified.env
Environment=AUTONOMY_ENABLED=0
ExecStart=/usr/bin/node /opt/my-ai-unified/local-gateway.js
Restart=on-failure
RestartSec=3
TimeoutStartSec=30
TimeoutStopSec=15
KillSignal=SIGTERM
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
ReadWritePaths=/opt/my-ai-unified

[Install]
WantedBy=multi-user.target
SERVICE

chmod 0644 "$UNIT"
systemctl daemon-reload
systemctl enable --now my-ai-unified-test.service

log "Waiting for local health endpoint (loopback only)"
healthy=0
for attempt in $(seq 1 20); do
  if curl --fail --silent --show-error --max-time 3 "http://127.0.0.1:$PORT/health" >/tmp/my-ai-unified-health.json 2>/dev/null; then
    healthy=1
    break
  fi
  sleep 1
done

if [[ "$healthy" -ne 1 ]]; then
  systemctl --no-pager --full status my-ai-unified-test.service || true
  journalctl -u my-ai-unified-test.service -n 80 --no-pager || true
  fail "Health endpoint did not return HTTP 200. Port 3020 remains bound to localhost by the app."
fi

log "HEALTH RESPONSE"
cat /tmp/my-ai-unified-health.json
printf '\n'
log "SERVICE STATUS"
systemctl --no-pager --full status my-ai-unified-test.service
log "LISTEN SOCKET"
ss -ltnp | grep ':3020' || true
log "DISK SPACE AFTER SETUP"
df -h /

printf '\nBOOTSTRAP_OK\n'
printf 'Service: my-ai-unified-test.service\n'
printf 'Health: http://127.0.0.1:%s/health (accessible from the VPS itself only)\n' "$PORT"
printf 'Secrets file, if later needed: %s (not created or modified by this script)\n' "$ENV_FILE"
printf 'No DNS or production domain changes were made.\n'
