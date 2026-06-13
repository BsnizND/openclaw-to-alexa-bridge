#!/usr/bin/env bash
set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:8787}"

curl -fsS "$BASE_URL/healthz"

if [[ -n "${BRIDGE_INTERNAL_TOKEN:-}" && -n "${HA_DEFAULT_TARGET:-}" ]]; then
  curl -fsS -X POST "$BASE_URL/internal/announce" \
    -H "Authorization: Bearer $BRIDGE_INTERNAL_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"message\":\"OpenClaw Alexa bridge smoke test.\",\"target\":\"$HA_DEFAULT_TARGET\"}"
fi

