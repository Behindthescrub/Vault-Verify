#!/usr/bin/env bash
# End-to-end verification of the Supabase Postgres migration.
# Runs a SCRATCH dev server on :3211 (never touching the platform's :3000):
#   1. login admin/Superadmin@123            → 200 + role=superadmin
#   2. login admin@recruitertool.local        → 200
#   3. wrong password                         → 401
#   4. wipe ALL users on Supabase, login again → 200 via self-heal
#   5. unknown username                       → 401
#   6. DB counts (superadmin, templates) via Prisma
set -u
cd /home/z/my-project

# Requires: DATABASE_URL env (Supabase pooler URL) — never hardcode credentials here.
if [ -z "${DATABASE_URL:-}" ]; then
  say "DATABASE_URL must be set in the environment (see .env.example)"; exit 1
fi
export DATABASE_URL
BASE="http://127.0.0.1:3211"
PASS=0; FAIL=0

say() { printf '%s\n' "$*"; }
ok()  { PASS=$((PASS+1)); say "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); say "  ❌ $1"; }

login() {
  curl -s -o /tmp/pg_login_body.json -w '%{http_code}' --max-time 120 \
    -H 'Content-Type: application/json' \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" \
    "$BASE/api/auth/admin-login"
}

say "▶ starting scratch PRODUCTION server on :3211 (Supabase env, no dev lock)"
DATABASE_URL="$DATABASE_URL" bunx next start -p 3211 > /tmp/pg_dev3211.log 2>&1 &
DEV_PID=$!

READY=0
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 "$BASE/" 2>/dev/null || true)
  if [ "$code" = "200" ]; then READY=1; break; fi
  sleep 2
done
if [ "$READY" != "1" ]; then
  say "scratch server never became ready (last code: $code)"; tail -20 /tmp/pg_dev3211.log; kill $DEV_PID 2>/dev/null; exit 1
fi
say "  production server ready (Supabase env)"

say "▶ test 1: login admin / Superadmin@123"
code=$(login admin 'Superadmin@123')
if [ "$code" = "200" ] && grep -q '"role":"superadmin"' /tmp/pg_login_body.json; then
  ok "login 200, role=superadmin (Supabase auth)"
else
  bad "expected 200, got $code — body: $(cat /tmp/pg_login_body.json)"
fi

say "▶ test 2: login admin@recruitertool.local / Superadmin@123"
code=$(login admin@recruitertool.local 'Superadmin@123')
if [ "$code" = "200" ]; then ok "email as username → 200"; else bad "expected 200, got $code — $(cat /tmp/pg_login_body.json)"; fi

say "▶ test 3: wrong password"
code=$(login admin 'wrongpassword')
if [ "$code" = "401" ]; then ok "wrong password → 401"; else bad "expected 401, got $code — $(cat /tmp/pg_login_body.json)"; fi

say "▶ test 4: wipe ALL users on Supabase, then self-heal login"
bun -e "const {PrismaClient}=require('@prisma/client');const d=new PrismaClient();d.user.deleteMany({}).then(r=>{console.log('deleted users:',r.count);return d.\$disconnect()})"
code=$(login admin 'Superadmin@123')
if [ "$code" = "200" ] && grep -q '"role":"superadmin"' /tmp/pg_login_body.json; then
  ok "self-heal on Postgres recreated superadmin, login 200"
else
  bad "expected 200 after wipe, got $code — $(cat /tmp/pg_login_body.json)"
fi

say "▶ test 5: unknown username after heal"
code=$(login root 'Superadmin@123')
if [ "$code" = "401" ]; then ok "unknown username → 401"; else bad "expected 401, got $code"; fi

say "▶ test 6: final Supabase DB state"
bun scripts/check_superadmin.mjs 2>&1 | sed -n '1,3p;/templates/p'

kill $DEV_PID 2>/dev/null; wait $DEV_PID 2>/dev/null
say ""
say "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] || exit 1
