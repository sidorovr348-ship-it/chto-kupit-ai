#!/usr/bin/env bash
set -Ee
set -o pipefail
if [ -z "$VPS_HOST" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_SSH_KEY" ] || [ -z "$BACKUP_ARCHIVE" ]; then
  echo "Rollback credentials or backup archive are missing."
  exit 1
fi
if [ "$VPS_USER" != "root" ]; then
  echo "VPS_USER must be root for the configured my-ai-unified service rollback."
  exit 1
fi
python3 scripts/prepare-vps-key.py
chmod 600 /tmp/vps_key
trap 'rm -f /tmp/vps_key /tmp/vps_key.pub' EXIT
ssh-keygen -y -P "" -f /tmp/vps_key > /tmp/vps_key.pub
chmod 600 /tmp/vps_key.pub
ssh_vps() { ssh -i /tmp/vps_key -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=3 "$@"; }
WORKDIR=$(ssh_vps "root@$VPS_HOST" "systemctl show -p WorkingDirectory --value my-ai-unified")
[ -n "$WORKDIR" ] || WORKDIR=/root/my-ai-unified
case "$WORKDIR" in /*) ;; *) echo "Unexpected service working directory; rollback stopped."; exit 1 ;; esac
case "$WORKDIR" in *"'"*) echo "Unsafe quote character in service working directory; rollback stopped."; exit 1 ;; esac
ssh_vps "root@$VPS_HOST" "set -e; cd '$WORKDIR'; test -s '$BACKUP_ARCHIVE'; rm -rf local-gateway.js smart-index.html memory-map.js image-generation-fallback.js vision-runtime-hotfix.js supervisor-daemon.js package.json package-lock.json src autonomy-lab; tar -xzf '$BACKUP_ARCHIVE' -C '$WORKDIR'; if [ -s package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi; systemctl restart my-ai-unified; for i in \$(seq 1 30); do if curl -fsS --max-time 3 http://127.0.0.1:3020/health >/dev/null; then exit 0; fi; sleep 1; done; exit 1"
echo "VPS_ROLLBACK_OK"
