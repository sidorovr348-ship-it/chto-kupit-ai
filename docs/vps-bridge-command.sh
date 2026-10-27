#!/bin/sh
set -eu

command_name="${SSH_ORIGINAL_COMMAND:-}"
case "$command_name" in
  health|diagnostics) ;;
  *)
    echo "DENIED: only health or diagnostics is allowed" >&2
    exit 126
    ;;
esac

service_state() {
  systemctl is-active "$1" 2>/dev/null || true
}

if [ "$command_name" = "health" ]; then
  main_state="$(service_state my-ai-unified.service)"
  tunnel_state="$(service_state my-ai-unified-quick-tunnel.service)"
  local_http="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 http://127.0.0.1:3020/ 2>/dev/null || printf '000')"
  public_http="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 https://ai.aliceq.ru/ 2>/dev/null || printf '000')"
  printf '{"host":"%s","main_service":"%s","tunnel_service":"%s","local_http":"%s","public_http":"%s"}\n' \
    "$(hostname)" "$main_state" "$tunnel_state" "$local_http" "$public_http"
  exit 0
fi

main_state="$(service_state my-ai-unified.service)"
tunnel_state="$(service_state my-ai-unified-quick-tunnel.service)"
alice_state="$(service_state alice-ai.service)"
disk_line="$(df -P / | awk 'NR==2 {print $5 "|" $4}')"
disk_used="${disk_line%%|*}"
disk_available_kb="${disk_line#*|}"
mem_line="$(awk '/MemTotal:/ {total=$2} /MemAvailable:/ {available=$2} END {if (total>0) printf "%d", (100*(total-available)/total); else print "unknown"}' /proc/meminfo)"
warning_count="$(journalctl -u my-ai-unified.service -u my-ai-unified-quick-tunnel.service --since '-1 hour' -p warning..alert --no-pager 2>/dev/null | wc -l | tr -d ' ')"
kernel="$(uname -r)"
printf '{"host":"%s","main_service":"%s","tunnel_service":"%s","alice_ai_service":"%s","root_disk_used":"%s","root_disk_available_kb":"%s","memory_used_percent":"%s","warnings_last_hour":"%s","kernel":"%s"}\n' \
  "$(hostname)" "$main_state" "$tunnel_state" "$alice_state" "$disk_used" "$disk_available_kb" "$mem_line" "$warning_count" "$kernel"
