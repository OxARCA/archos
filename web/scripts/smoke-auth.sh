#!/usr/bin/env bash
# End-to-end smoke test for login and route protection against a running server.
#
# Usage:  BASE=http://localhost:3000 bash scripts/smoke-auth.sh
# Needs:  a running server whose .env.local lists admin@example.com in ADMIN_EMAILS and
#         researcher@example.com in ALLOWED_EMAILS (as .env.example does).
#         Re-runnable: the two example accounts are created on the first run and
#         signed into on later runs (password: correct-horse-battery).
set -u
PW=correct-horse-battery
BASE=${BASE:-http://localhost:3000}
J=$(mktemp -d)
pass=0; fail=0
check() { # name expected actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 ($3)"; pass=$((pass+1)); else echo "FAIL  $1: expected $2, got $3"; fail=$((fail+1)); fi
}
code() { curl -s -o /dev/null -w '%{http_code}' "$@"; }
redir() { curl -s -o /dev/null -w '%{redirect_url}' "$@"; }
# Sign up, or sign in when the account already exists; prints the user's email.
account() { # cookie-jar name email
  local r
  r=$(curl -s -c "$1" -H 'content-type: application/json' -H "origin: $BASE" \
    -d "{\"name\":\"$2\",\"email\":\"$3\",\"password\":\"$PW\"}" "$BASE/api/auth/sign-up/email")
  if ! echo "$r" | grep -q '"user"'; then
    r=$(curl -s -c "$1" -H 'content-type: application/json' -H "origin: $BASE" \
      -d "{\"email\":\"$3\",\"password\":\"$PW\"}" "$BASE/api/auth/sign-in/email")
  fi
  echo "$r" | python3 -c 'import sys,json;print(json.load(sys.stdin).get("user",{}).get("email",""))' 2>/dev/null
}

echo "== waiting for $BASE"
curl -s -o /dev/null --retry 40 --retry-connrefused --retry-delay 2 --retry-all-errors "$BASE/" || { echo "server not reachable"; exit 1; }

echo "== public pages"
check "GET /"        200 "$(code $BASE/)"
check "GET /login"   200 "$(code $BASE/login)"
check "GET /signup"  200 "$(code $BASE/signup)"

echo "== protection without session"
check "GET /dashboard redirects" 307 "$(code $BASE/dashboard)"
check "  → /login?next=/dashboard" "$BASE/login?next=%2Fdashboard" "$(redir $BASE/dashboard)"
check "GET /admin redirects" 307 "$(code $BASE/admin)"

echo "== accounts (created on first run, signed into afterwards)"
check "admin account (listed in ADMIN_EMAILS)" "admin@example.com" "$(account $J/admin.txt 'Test Admin' admin@example.com)"
check "researcher account" "researcher@example.com" "$(account $J/res.txt 'Test Researcher' researcher@example.com)"

echo "== password too short is rejected"
check "short password → 400" 400 "$(code -H 'content-type: application/json' -H "origin: $BASE" -d '{"name":"x","email":"short@example.com","password":"short"}' $BASE/api/auth/sign-up/email)"

echo "== duplicate email is rejected"
check "duplicate → 422" 422 "$(code -H 'content-type: application/json' -H "origin: $BASE" -d '{"name":"x","email":"admin@example.com","password":"correct-horse-battery"}' $BASE/api/auth/sign-up/email)"

echo "== sign-up is by invitation"
check "uninvited sign-up → 403" 403 "$(code -H 'content-type: application/json' -H "origin: $BASE" -d '{"name":"x","email":"stranger@example.com","password":"correct-horse-battery"}' $BASE/api/auth/sign-up/email)"

echo "== session + roles"
S=$(curl -s -b $J/admin.txt "$BASE/api/auth/get-session")
check "admin session role" "admin" "$(echo "$S" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["role"])' 2>/dev/null)"
S=$(curl -s -b $J/res.txt "$BASE/api/auth/get-session")
check "researcher session role" "researcher" "$(echo "$S" | python3 -c 'import sys,json;print(json.load(sys.stdin)["user"]["role"])' 2>/dev/null)"

echo "== protected pages with session"
check "admin GET /dashboard" 200 "$(code -b $J/admin.txt $BASE/dashboard)"
check "admin GET /admin" 200 "$(code -b $J/admin.txt $BASE/admin)"
check "researcher GET /dashboard" 200 "$(code -b $J/res.txt $BASE/dashboard)"
check "researcher GET /admin → redirect" 307 "$(code -b $J/res.txt $BASE/admin)"
check "  → /dashboard?denied=admin" "$BASE/dashboard?denied=admin" "$(redir -b $J/res.txt $BASE/admin)"
check "logged-in GET /login → /dashboard" 307 "$(code -b $J/admin.txt $BASE/login)"
check "admin page lists the researcher" yes "$(curl -s -b $J/admin.txt $BASE/admin | grep -q researcher@example.com && echo yes || echo no)"

echo "== sign out, then sign in again"
check "sign-out" 200 "$(code -b $J/res.txt -c $J/res.txt -X POST -H 'content-type: application/json' -H "origin: $BASE" -d '{}' $BASE/api/auth/sign-out)"
check "after sign-out /dashboard redirects" 307 "$(code -b $J/res.txt $BASE/dashboard)"
check "sign-in from another site → 403" 403 "$(code -H 'content-type: application/json' -H 'origin: https://evil.example.com' -d '{"email":"researcher@example.com","password":"correct-horse-battery"}' $BASE/api/auth/sign-in/email)"
check "wrong password → 401" 401 "$(code -H 'content-type: application/json' -H "origin: $BASE" -d '{"email":"researcher@example.com","password":"wrong-password-here"}' $BASE/api/auth/sign-in/email)"
check "sign-in" 200 "$(code -c $J/res.txt -H 'content-type: application/json' -H "origin: $BASE" -d '{"email":"researcher@example.com","password":"correct-horse-battery"}' $BASE/api/auth/sign-in/email)"
check "after sign-in /dashboard" 200 "$(code -b $J/res.txt $BASE/dashboard)"

echo
echo "RESULT: $pass passed, $fail failed"
rm -rf "$J"
[ $fail -eq 0 ]
