#!/usr/bin/env bash
set -euo pipefail

APP_URL="${1:?Usage: smoke-test.sh <app-url>}"
APP_URL="${APP_URL%/}"
CURL_ARGS=(--fail --silent --show-error --retry 5 --retry-delay 5 --retry-all-errors)

curl "${CURL_ARGS[@]}" "$APP_URL/health" >/dev/null
curl "${CURL_ARGS[@]}" "$APP_URL/api/health" >/dev/null
curl "${CURL_ARGS[@]}" "$APP_URL/api/health/db" >/dev/null

echo "Smoke tests passed for $APP_URL"
