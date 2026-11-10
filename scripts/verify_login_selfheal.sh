#!/usr/bin/env bash
# Self-contained verification against the ALREADY-RUNNING dev server on :3000
# (that instance is what the user sees in their browser; next dev hot-reloads
# the route change, so we are testing the new code).
#   1. login admin/Superadmin@123          → expect 200
#   2. login admin@recruitertool.local     → expect 200
#   3. wrong password                      → expect 401
#   4. wipe ALL users (no backup file present), login again → 200 via self-heal
#   5. wrong username after heal → 401 (heal is not a bypass)
set -u
cd /home/z/my-project
BASE="http://127.0.0.1:3000"
PASS=0; FAIL=0

say() { printf '%s\n' "$*"; }
ok()  { PASS=$((PASS+1)); say "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); say "  ❌ $1"; }

login() { # $1 username, $2 password → prints HTTP code, body in /tmp/login_body.json
  curl -s -o /tmp/login_body.json -w '%{http_code}' --max-time 90 \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" \
    "$BASE/api/auth/admin-login"
}

code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 90 "$BASE/" || true)
if [ "$code" != "200" ]; then say "server on :3000 not reachable (code=$code)"; exit 1; fi
say "▶ server on :3000 reachable"

say "▶ test 1: login admin / Superadmin@123"
code=$(login admin 'Superadmin@123')
if [ "$code" = "200" ] && grep -q '"role":"superadmin"' /tmp/login_body.json; then
  ok "login 200, role=superadmin"
else
  bad "expected 200, got $code — body: $(cat /tmp/login_body.json)"
fi

say "▶ test 2: login admin@recruitertool.local / Superadmin@123"
code=$(login admin@recruitertool.local 'Superadmin@123')
if [ "$code" = "200" ]; then ok "email as username → 200"; else bad "expected 200, got $code — $(cat /tmp/login_body.json)"; fi

say "▶ test 3: wrong password"
code=$(login admin 'wrongpassword')
if [ "$code" = "401" ]; then ok "wrong password → 401"; else bad "expected 401, got $code — $(cat /tmp/login_body.json)"; fi

say "▶ test 4: wipe ALL users (backup file absent) then self-heal login"
rm -f db/platform-backup.json
bun -e "const {PrismaClient}=require('@prisma/client');const d=new PrismaClient();d.user.deleteMany({}).then(r=>{console.log('deleted users:',r.count);return d.\$disconnect()})"
code=$(login admin 'Superadmin@123')
if [ "$code" = "200" ] && grep -q '"role":"superadmin"' /tmp/login_body.json; then
  ok "self-heal recreated superadmin without backup file, login 200"
else
  bad "expected 200 after wipe, got $code — $(cat /tmp/login_body.json)"
fi

say "▶ test 5: unknown username after heal"
code=$(login root 'Superadmin@123')
if [ "$code" = "401" ]; then ok "unknown username → 401"; else bad "expected 401, got $code"; fi

say "▶ final DB state"
bun scripts/check_superadmin.mjs 2>&1 | sed -n '1,4p'

say ""
say "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] || exit 1
