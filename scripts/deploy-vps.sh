#!/usr/bin/env bash
set -Ee
set -o pipefail
if [ -z "$VPS_HOST" ] || [ -z "$VPS_USER" ] || [ -z "$VPS_SSH_KEY" ]; then
  echo "VPS_HOST, VPS_USER and VPS_SSH_KEY are required."
  exit 1
fi
if [ "$VPS_USER" != "root" ]; then
  echo "VPS_USER must be root for the configured my-ai-unified service deployment."
  exit 1
fi
python3 scripts/prepare-vps-key.py
chmod 600 /tmp/vps_key
trap 'rm -f /tmp/vps_key /tmp/vps_key.pub' EXIT
ssh-keygen -y -P "" -f /tmp/vps_key > /tmp/vps_key.pub
chmod 600 /tmp/vps_key.pub
ssh_vps() { ssh -i /tmp/vps_key -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o StrictHostKeyChecking=no -o ConnectTimeout=15 -o ServerAliveInterval=10 -o ServerAliveCountMax=3 "$@"; }
scp_vps() { scp -i /tmp/vps_key -o IdentitiesOnly=yes -o PreferredAuthentications=publickey -o PasswordAuthentication=no -o StrictHostKeyChecking=no -o ConnectTimeout=15 "$@"; }
WORKDIR=$(ssh_vps "root@$VPS_HOST" "systemctl show -p WorkingDirectory --value my-ai-unified")
[ -n "$WORKDIR" ] || WORKDIR=/root/my-ai-unified
case "$WORKDIR" in /*) ;; *) echo "Unexpected service working directory; deployment stopped."; exit 1 ;; esac
case "$WORKDIR" in *"'"*) echo "Unsafe quote character in service working directory; deployment stopped."; exit 1 ;; esac
STAMP="$GITHUB_SHA-$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_ARCHIVE="$WORKDIR/.deploy-backups/pre-$STAMP.tar.gz"
STAGING="$WORKDIR/.deploy-staging-$STAMP"
ssh_vps "root@$VPS_HOST" "set -e; cd '$WORKDIR'; test -s local-gateway.js; test -s smart-index.html; test -d src; test -d autonomy-lab; mkdir -p .deploy-backups; if [ -f package-lock.json ]; then tar -czf '$BACKUP_ARCHIVE' local-gateway.js smart-index.html memory-map.js image-generation-fallback.js vision-runtime-hotfix.js supervisor-daemon.js package.json package-lock.json src autonomy-lab; else tar -czf '$BACKUP_ARCHIVE' local-gateway.js smart-index.html memory-map.js image-generation-fallback.js vision-runtime-hotfix.js supervisor-daemon.js package.json src autonomy-lab; fi"
if [ -n "$GITHUB_OUTPUT" ]; then echo "backup_archive=$BACKUP_ARCHIVE" >> "$GITHUB_OUTPUT"; fi
DEPLOY_MUTATED=0
rollback_deploy() {
  local code=$?
  trap - ERR
  if [ "$DEPLOY_MUTATED" = "1" ]; then
    echo "DEPLOY_FAILED_ATTEMPTING_ROLLBACK"
    if ssh_vps "root@$VPS_HOST" "set -e; cd '$WORKDIR'; rm -rf local-gateway.js smart-index.html memory-map.js image-generation-fallback.js vision-runtime-hotfix.js supervisor-daemon.js package.json package-lock.json src autonomy-lab; tar -xzf '$BACKUP_ARCHIVE' -C '$WORKDIR'; if [ -s package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi; systemctl restart my-ai-unified; for i in \$(seq 1 30); do if curl -fsS --max-time 3 http://127.0.0.1:3020/health >/dev/null; then exit 0; fi; sleep 1; done; exit 1"; then
      echo "DEPLOY_ROLLBACK_OK"
      if [ -n "$GITHUB_OUTPUT" ]; then echo "rolled_back=true" >> "$GITHUB_OUTPUT"; fi
    else
      echo "DEPLOY_ROLLBACK_FAILED; VPS requires manual recovery from $BACKUP_ARCHIVE"
    fi
  else
    ssh_vps "root@$VPS_HOST" "rm -rf '$STAGING'" || true
    if [ -n "$GITHUB_OUTPUT" ]; then echo "rolled_back=true" >> "$GITHUB_OUTPUT"; fi
  fi
  exit "$code"
}
trap rollback_deploy ERR
ssh_vps "root@$VPS_HOST" "mkdir -p '$STAGING/src' '$STAGING/autonomy-lab'"
scp_vps local-gateway.js smart-index.html memory-map.js image-generation-fallback.js vision-runtime-hotfix.js supervisor-daemon.js package.json package-lock.json "root@$VPS_HOST:$STAGING/"
scp_vps -r src/. "root@$VPS_HOST:$STAGING/src/"
scp_vps -r autonomy-lab/. "root@$VPS_HOST:$STAGING/autonomy-lab/"
DEPLOY_MUTATED=1
ssh_vps "root@$VPS_HOST" "set -e; cd '$WORKDIR'; cp -a '$STAGING'/local-gateway.js '$STAGING'/smart-index.html '$STAGING'/memory-map.js '$STAGING'/image-generation-fallback.js '$STAGING'/vision-runtime-hotfix.js '$STAGING'/supervisor-daemon.js '$STAGING'/package.json '$STAGING'/package-lock.json .; cp -a '$STAGING'/src/. src/; cp -a '$STAGING'/autonomy-lab/. autonomy-lab/; npm ci --omit=dev --no-audit --no-fund; node --check local-gateway.js; node --check memory-map.js; node --check image-generation-fallback.js; node --check vision-runtime-hotfix.js; node --check supervisor-daemon.js; node image-generation-fallback.js local-gateway.js; node vision-runtime-hotfix.js local-gateway.js; node --check local-gateway.js; systemctl restart my-ai-unified"
healthy=0
for attempt in $(seq 1 30); do
  if ssh_vps "root@$VPS_HOST" "curl -fsS --max-time 3 http://127.0.0.1:3020/health >/tmp/my-ai-health.json"; then healthy=1; break; fi
  sleep 1
done
test "$healthy" = 1
ssh_vps "root@$VPS_HOST" "cat /tmp/my-ai-health.json"
DEPLOY_MUTATED=0
trap - ERR
ssh_vps "root@$VPS_HOST" "rm -rf '$STAGING'"
echo "VPS_DEPLOY_SOURCE_AND_HEALTH_OK"
