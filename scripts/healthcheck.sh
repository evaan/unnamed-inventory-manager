#!/usr/bin/env bash
# Checks that the deployed stack is answering.
#
# Usage: scripts/healthcheck.sh [base-url] [attempts]
#   base-url  defaults to https://inventory.evaan.dev
#   attempts  how many times to try before giving up, 5 seconds apart (default 1)
#
# Prints a short report in the same format as evidence/deployment/healthcheck.txt
# and exits non-zero if the frontend or the backend is unhealthy.
set -uo pipefail

base="${1:-https://inventory.evaan.dev}"
attempts="${2:-1}"
commit="${COMMIT:-$(git rev-parse --short HEAD 2>/dev/null || echo unknown)}"

# check <url> <text the body must contain> <print body: yes|no>
check() {
  local url="$1" want="$2" show="$3" out code body
  out="$(curl -sS --max-time 10 -w $'\n%{http_code}' "$url" 2>&1)" || { echo "GET $url"; echo "$out"; return 1; }
  code="${out##*$'\n'}"
  body="${out%$'\n'*}"
  echo "GET $url"
  if [ "$show" = yes ]; then echo "$body"; fi
  echo "HTTP $code"
  [ "$code" = 200 ] && [[ "$body" == *"$want"* ]]
}

for ((i = 1; i <= attempts; i++)); do
  report="$(
    echo "Captured: $(date -Iseconds)  commit: $commit"
    ok=0
    check "$base/" '<div id="root">' no || ok=1
    check "$base/api/whoami" '"loggedIn"' yes || ok=1
    exit "$ok"
  )"
  status=$?
  if [ "$status" -eq 0 ]; then
    echo "$report"
    echo "RESULT healthy"
    exit 0
  fi
  if [ "$i" -lt "$attempts" ]; then sleep 5; fi
done

echo "$report"
echo "RESULT unhealthy after $attempts attempt(s)"
exit 1
