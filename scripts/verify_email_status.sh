#!/bin/bash
# Single-shot verification of the email delivery diagnosis features:
#   1. /api/admin/email-status returns the live Brevo account, plan,
#      sender verification + free-mail flag
#   2. a real test send returns a Brevo messageId
#   3. the send log stores that messageId
#   4. the superadmin Email tab renders the connected-account strip,
#      deliverability warning, and messageId chips in the log
cd /home/z/my-project || exit 1

TO="${1:-shaswatpandey0047@gmail.com}"

bun run dev > /tmp/ves-dev.log 2>&1 &
SERVER_PID=$!
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "== server ready (code=$code) =="

J='content-type: application/json'
PASS=0; FAIL=0

echo; echo "== 1. superadmin login =="
rm -f /tmp/ves-admin.txt
curl -s --max-time 120 -c /tmp/ves-admin.txt -X POST http://localhost:3000/api/auth/admin-login -H "$J" \
  -d '{"username":"admin","password":"Superadmin@123"}' | head -c 120; echo

echo; echo "== 2. GET /api/admin/email-status =="
curl -s --max-time 90 -b /tmp/ves-admin.txt http://localhost:3000/api/admin/email-status > /tmp/ves-status.json
python3 - <<'EOF'
import json
s = json.load(open('/tmp/ves-status.json'))
checks = [
    ('authenticated', s.get('authenticated') is True),
    ('account email', s.get('account', {}).get('email') == 'sam.p@medstalent.com'),
    ('plan free/300', s.get('account', {}).get('planType') == 'free' and s.get('account', {}).get('planCredits') == 300),
    ('sender verified', s.get('senderVerified') is True),
    ('sender free-mail flagged', s.get('senderFreeMail') is True),
    ('sender listed', any(x.get('email') == 'myzipvault@gmail.com' and x.get('active') for x in s.get('senders', []))),
]
ok = all(v for _, v in checks)
for name, v in checks:
    print(f"  [{'PASS' if v else 'FAIL'}] {name}")
print(f"  account: {s.get('account', {}).get('email')} ({s.get('account', {}).get('planType')}, {s.get('account', {}).get('planCredits')}/day)")
open('/tmp/ves-result', 'w').write('OK' if ok else 'BAD')
EOF
[ "$(cat /tmp/ves-result)" = "OK" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo; echo "== 3. POST /api/admin/test-email → real send with messageId =="
curl -s --max-time 90 -b /tmp/ves-admin.txt -X POST http://localhost:3000/api/admin/test-email -H "$J" \
  -d "{\"to\":\"$TO\",\"templateKey\":\"platform_test\"}" > /tmp/ves-send.json
cat /tmp/ves-send.json; echo
python3 - <<EOF
import json
r = json.load(open('/tmp/ves-send.json'))
v = r.get('emailStatus') == 'sent' and bool(r.get('messageId'))
print(f"  [{'PASS' if v else 'FAIL'}] status={r.get('emailStatus')} messageId={str(r.get('messageId'))[:40]}")
open('/tmp/ves-result', 'w').write('OK' if v else 'BAD')
EOF
[ "$(cat /tmp/ves-result)" = "OK" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo; echo "== 4. send log stores providerMessageId =="
curl -s --max-time 60 -b /tmp/ves-admin.txt http://localhost:3000/api/admin/email-logs > /tmp/ves-logs.json
python3 - <<EOF
import json
logs = json.load(open('/tmp/ves-logs.json'))['logs']
top = [l for l in logs if '$TO' in l.get('toEmail','')]
v = bool(top) and bool(top[0].get('providerMessageId'))
print(f"  [{'PASS' if v else 'FAIL'}] latest to $TO: status={top[0]['status'] if top else '-'} messageId={str(top[0].get('providerMessageId'))[:40] if top else '-'}")
open('/tmp/ves-result', 'w').write('OK' if v else 'BAD')
EOF
[ "$(cat /tmp/ves-result)" = "OK" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo; echo "== 5. unauthenticated access is rejected =="
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 60 http://localhost:3000/api/admin/email-status)
echo "  anonymous GET → HTTP $code"
[ "$code" = "403" ] && PASS=$((PASS+1)) || FAIL=$((FAIL+1))

echo; echo "== 6. browser: Email tab renders account strip + warnings + log chips =="
AB="agent-browser"
$AB set viewport 1440 900 || true
$AB open http://localhost:3000/superadmin || true
$AB wait 2500
$AB find label "Username" fill "admin" || true
$AB find label "Password" fill "Superadmin@123" || true
$AB click "button[type=submit]" || true
$AB wait --text "Overview" || true
$AB wait 2000
$AB find text "Email" click || true
$AB wait 3500
mkdir -p /tmp/render
$AB screenshot /tmp/render/email-tab-status.png || true
$AB eval "(() => { const t = document.body.textContent; const checks = [
  ['account strip', t.includes('Connected Brevo account') && t.includes('sam.p@medstalent.com')],
  ['free plan quota note', t.includes('300/day quota')],
  ['accepted-ne-delivered note', t.includes('Accepted') && t.includes('delivered') && t.includes('sending platform is currently disabled')],
  ['activation ticket link', !!document.querySelector('a[href*=\"help.brevo.com/hc/en-us/requests/new\"]')],
  ['sender verified note', t.includes('is verified') || t.includes('verified & active')],
  ['deliverability warning', t.includes('Deliverability warning') && t.includes('spam')],
  ['own-domain suggestion', t.includes('no-reply@medstalent.com')],
  ['messageId chip in log', !!document.querySelector('code[title*=\"smtp-relay\"]')],
  ['send log footnote', t.includes('not a delivery guarantee')],
]; return checks.map(([n,v]) => (v ? 'PASS' : 'FAIL') + ' ' + n).join('\\n'); })()" || true

$AB close || true
kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
echo "API checks: $PASS passed, $FAIL failed"
echo "SCRIPT_DONE"
