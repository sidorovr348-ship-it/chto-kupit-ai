#!/usr/bin/env bash
set -Eeuo pipefail

APP_SRC="/root/my-ai-unified"
APP_DIR="/opt/my-ai-unified"
SERVICE="my-ai-unified"
ENV_FILE="/etc/my-ai-unified.env"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Запусти сценарий от root: sudo bash $0"
  exit 1
fi
if [[ -e "$APP_DIR" || -f "/etc/systemd/system/${SERVICE}.service" ]]; then
  echo "ОШИБКА: $APP_DIR или systemd-служба уже существуют; отказываюсь перезаписывать существующую установку."
  exit 1
fi
if [[ ! -f "$APP_SRC/package.json" || ! -f "$APP_SRC/local-gateway.js" ]]; then
  echo "ОШИБКА: проект не найден в $APP_SRC. Сначала клонируй репозиторий."
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "ОШИБКА: Node.js не установлен."
  exit 1
fi
node -e 'const major=Number(process.versions.node.split(".")[0]); if(major<20){console.error("Требуется Node.js >=20");process.exit(1)}'
command -v npm >/dev/null 2>&1 || { echo "ОШИБКА: npm не найден."; exit 1; }

echo "== 1/6: создаю отдельного системного пользователя =="
if ! id my-ai-unified >/dev/null 2>&1; then
  useradd --system --home-dir "$APP_DIR" --shell /usr/sbin/nologin my-ai-unified
fi

echo "== 2/6: копирую код без Git-метаданных и файлов с секретами =="
install -d -o my-ai-unified -g my-ai-unified "$APP_DIR"
tar -C "$APP_SRC" --exclude='./.git' --exclude='./node_modules' --exclude='./.env' --exclude='./.env.*' --exclude='./.local-ai.env' -cf - . | tar -C "$APP_DIR" -xf -
chown -R my-ai-unified:my-ai-unified "$APP_DIR"

echo "== 3/6: устанавливаю production-зависимости =="
cd "$APP_DIR"
if [[ -f package-lock.json ]]; then
  npm ci --omit=dev
else
  npm install --omit=dev
fi
chown -R my-ai-unified:my-ai-unified "$APP_DIR"

echo "== 4/6: запускаю автоматические тесты =="
cd "$APP_SRC"
npm test

echo "== 5/6: готовлю локальную конфигурацию и systemd =="
if [[ ! -f "$ENV_FILE" ]]; then
  umask 077
  cat > "$ENV_FILE" <<'ENVVARS'
PORT=3020
AUTONOMY_ENABLED=0
ENVVARS
fi
chmod 600 "$ENV_FILE"

cat > "/etc/systemd/system/${SERVICE}.service" <<'UNIT'
[Unit]
Description=My AI Unified (test VPS)
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=my-ai-unified
Group=my-ai-unified
WorkingDirectory=/opt/my-ai-unified
EnvironmentFile=-/etc/my-ai-unified.env
Environment=NODE_ENV=production
Environment=PORT=3020
Environment=AUTONOMY_ENABLED=0
ExecStart=/usr/bin/node /opt/my-ai-unified/local-gateway.js
Restart=on-failure
RestartSec=3
TimeoutStartSec=30
TimeoutStopSec=20
KillSignal=SIGTERM
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=full
UMask=0077

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE"
systemctl restart "$SERVICE"

echo "== 6/6: проверяю локальный health endpoint =="
ok=0
for attempt in $(seq 1 15); do
  if curl --fail --silent --show-error --max-time 2 http://127.0.0.1:3020/health; then
    echo
    ok=1
    break
  fi
  sleep 2
done
if [[ "$ok" -ne 1 ]]; then
  echo "ОШИБКА: health endpoint не ответил. Последние логи службы:"
  journalctl -u "$SERVICE" -n 80 --no-pager || true
  exit 1
fi

echo
echo "ГОТОВО: служба работает локально на 127.0.0.1:3020."
echo "Внешний доступ и DNS не изменялись."
echo "Секреты добавляются отдельно в $ENV_FILE; не публикуй его содержимое."
echo "Статус: systemctl status $SERVICE --no-pager"
