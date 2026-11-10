#!/usr/bin/env bash
# Browser-level verification that provider/infra names are gone from the UI.
# Uses accessibility snapshots (case-insensitive) — reliable with Turbopack HMR.
# Requires the dev server on :3000 (or set BASE_URL).
set -u
cd /home/z/my-project
AB="bunx agent-browser"
BASE="${BASE_URL:-http://127.0.0.1:3000}"
PASS=0; FAIL=0
ok()  { PASS=$((PASS+1)); echo "  ✅ $1"; }
bad() { FAIL=$((FAIL+1)); echo "  ❌ $1"; }
snap() { sleep "${2:-6}"; $AB snapshot 2>/dev/null; }

echo "▶ 1. Recruiter login page (logged out)"
$AB open "$BASE/" >/dev/null 2>&1
T=$(snap)
echo "$T" | grep -qi 'brevo' && bad "recruiter login mentions Brevo" || ok "no 'Brevo' on recruiter login"
echo "$T" | grep -qi 'superadmin' && bad "recruiter login mentions superadmin" || ok "no 'superadmin' on recruiter login"
echo "$T" | grep -qi 'vercel\|supabase\|github' && bad "recruiter login mentions infra" || ok "no infra names on recruiter login"
echo "$T" | grep -q 'Email invitations' && ok "'Email invitations' feature present" || bad "feature chip missing"

echo "▶ 2. Admin console login page (/console)"
$AB open "$BASE/console" >/dev/null 2>&1
T=$(snap)
echo "$T" | grep -qi 'admin console' && ok "shows 'Admin console'" || bad "missing 'Admin console' title"
echo "$T" | grep -qi 'superadmin\|brevo\|supabase\|vercel\|xkeysib' && bad "console login shows banned word" || ok "no banned words on console login"
echo "$T" | grep -q 'SUPERADMIN_EMAIL\|SUPERADMIN_PASSWORD' && bad "env var names leaked" || ok "no env var names in UI"

echo "▶ 3. Log in to the console"
$AB fill '#sa-username' 'admin' >/dev/null 2>&1
$AB fill '#sa-password' 'Superadmin@123' >/dev/null 2>&1
$AB click text 'Sign in to console' >/dev/null 2>&1
T=$(snap x 12)
echo "$T" | grep -qi 'admin console' && ok "console shell visible" || bad "console shell not visible"
EMAIL_TAB_REF=$(echo "$T" | grep -o 'button "Email" \[ref=[^]]*\]' | grep -o 'e[0-9]*' | head -1)

echo "▶ 4. Email tab (provider-neutral wording)"
[ -n "$EMAIL_TAB_REF" ] && $AB click "$EMAIL_TAB_REF" >/dev/null 2>&1 || $AB click text 'Email' >/dev/null 2>&1
T=$(snap x 12)
echo "$T" | grep -qi 'brevo' && bad "Email tab mentions Brevo" || ok "no 'Brevo' on Email tab"
echo "$T" | grep -qi 'transactional email' && ok "'Transactional email' header present" || bad "header missing"
echo "$T" | grep -qi 'xkeysib\|xsmtpsib' && bad "key-format hints leaked" || ok "no key-format hints"
echo "$T" | grep -qi 'myzipvault\|medstalent' && bad "personal identifiers in static text" || ok "no personal identifiers (account strip may show admin's own live data)"

echo "▶ 5. Users tab role chip"
$AB click text 'Users & auth' >/dev/null 2>&1
T=$(snap x 10)
echo "$T" | grep -qi 'superadmin' && bad "Users tab shows 'superadmin'" || ok "no 'superadmin' on Users tab"
echo "$T" | grep -qi 'platform admin' && ok "'platform admin' chip present" || bad "platform admin chip missing"

echo "▶ 6. Keys tab"
$AB click text 'Keys & access' >/dev/null 2>&1
T=$(snap x 10)
echo "$T" | grep -qi 'administrator credentials' && ok "'Administrator credentials' section" || bad "section title wrong"
echo "$T" | grep -qi 'superadmin' && bad "Keys tab shows 'superadmin'" || ok "no 'superadmin' on Keys tab"

echo ""
echo "RESULT: $PASS passed, $FAIL failed"
[ "$FAIL" = "0" ] || exit 1
