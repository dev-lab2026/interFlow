#!/usr/bin/env sh
set -eu
BASE_URL="${BASE_URL:-https://localhost}"
CURL_FLAGS="${CURL_FLAGS:--k}"

echo "[1/3] health"
curl $CURL_FLAGS -fsS "$BASE_URL/api/health" >/dev/null

echo "[2/3] unauthenticated API is blocked"
status=$(curl $CURL_FLAGS -s -o /dev/null -w '%{http_code}' "$BASE_URL/api/db/users")
test "$status" = "401"

echo "[3/3] login endpoint responds"
status=$(curl $CURL_FLAGS -s -o /dev/null -w '%{http_code}' -X POST "$BASE_URL/api/auth/login" -H 'Content-Type: application/json' -d '{}')
test "$status" = "400"

echo "Smoke tests passed."
