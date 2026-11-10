#!/bin/bash
# Single-shot verification of the platform self-heal after a DB re-provision
# (which actually happened: the sandbox recreated custom.db empty at 16:54 UTC,
# wiping the superadmin, skills, and saved API keys).
#
# Flow verified:
#   1. login with the re-seeded superadmin
#   2. saving settings writes db/platform-backup.json (git-ignored)
#   3. simulating the wipe (PlatformSetting row + ALL users deleted)
#   4. admin-login self-heals: default superadmin recreated (needs backup file)
#   5. GET /api/admin/email-status restores PlatformSetting from the backup
#   6. test-email falls back to test-mode (no key saved)
#   7. browser: Email tab renders the no-key strip, send-log footnote,
#      and the 6-template library
cd /home/z/my-project || exit 1

J='content-type: application/json'
PASS=0; FAIL=0
ck() { if [ "$2" = "1" ]; then PASS=$((PASS+1)); echo "  [PASS] $1"; else FAIL=$((FAIL+1)); echo "  [FAIL] $1"; fi }

bun run dev > /tmp/sh-dev.log 2>&1 &
SERVER_PID=$!
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "== server ready (code=$code) =="

rm -f db/platform-backup.json

echo; echo "== 1. login (re-seeded superadmin) =="
rm -f /tmp/sh-admin.txt
code=$(curl -s -o /tmp/sh-login.json -w '%{http_code}' --max-time 120 -c /tmp/sh-admin.txt \
  -X POST http://localhost:3000/api/auth/admin-login -H "$J" \
  -d '{"username":"admin","password":"Superadmin@123"}')
ck "login returns 200" "$([ "$code" = "200" ] && echo 1 || echo 0)"

echo; echo "== 2. save settings → backup file written =="
curl -s --max-time 90 -b /tmp/sh-admin.txt -X PUT http://localhost:3000/api/admin/settings -H "$J" \
  -d '{"brevoSenderEmail":"noreply@example.com","brevoSenderName":"VaultVerify","emailTestMode":false}' > /dev/null
python3 -c "
import json,sys
try:
    b=json.load(open('db/platform-backup.json'))
    ok=(b.get('brevoSenderEmail')=='noreply@example.com' and b.get('brevoSenderName')=='VaultVerify' and b.get('emailTestMode') is False and b.get('brevoApiKey') is None)
except Exception as e:
    ok=False
print('  [%s] backup file: sender+testMode persisted, keys empty' % ('PASS' if ok else 'FAIL'))
open('/tmp/sh-r','w').write('1' if ok else '0')
"
ck "backup file written" "$(cat /tmp/sh-r)"

echo; echo "== 3. simulate the wipe: delete PlatformSetting + ALL users =="
node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient()
  await db.session.deleteMany()
  await db.userSettings.deleteMany()
  await db.user.deleteMany()
  await db.platformSetting.deleteMany()
  console.log('  wiped: users=%d platformSetting=%d' % 0 % 0 if false else '  wiped: users=' + String(await db.user.count()) + ' settings=' + String(await db.platformSetting.count()))
  await db.\$disconnect()
})" 2>/dev/null || node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient()
  await db.session.deleteMany().catch(()=>{})
  await db.userSettings.deleteMany().catch(()=>{})
  await db.user.deleteMany()
  await db.platformSetting.deleteMany()
  console.log('  wiped: users=' + String(await db.user.count()) + ' settings=' + String(await db.platformSetting.count()))
  await db.\$disconnect()
})"
ck "DB wiped clean" "$(node -e "
import('@prisma/client').then(async ({PrismaClient}) => {
  const db = new PrismaClient()
  const n = await db.user.count() + await db.platformSetting.count()
  await db.\$disconnect()
  process.stdout.write(n === 0 ? '1' : '0')
})")"

echo; echo "== 4. admin-login self-heals the superadmin =="
rm -f /tmp/sh-admin2.txt
code=$(curl -s -o /tmp/sh-login2.json -w '%{http_code}' --max-time 120 -c /tmp/sh-admin2.txt \
  -X POST http://localhost:3000/api/auth/admin-login -H "$J" \
  -d '{"username":"admin","password":"Superadmin@123"}')
ck "login works right after total user wipe (self-heal)" "$([ "$code" = "200" ] && echo 1 || echo 0)"

echo; echo "== 5. email-status restores PlatformSetting from backup =="
curl -s --max-time 90 -b /tmp/sh-admin2.txt http://localhost:3000/api/admin/email-status > /tmp/sh-status.json
python3 -c "
import json
s=json.load(open('/tmp/sh-status.json'))
ok=(s.get('reason')=='no-key' and s.get('senderEmail')=='noreply@example.com'
    and s.get('senderName')=='VaultVerify' and s.get('testMode') is False)
print('  [%s] restored: sender=%s testMode=%s reason=%s' % ('PASS' if ok else 'FAIL', s.get('senderEmail'), s.get('testMode'), s.get('reason')))
open('/tmp/sh-r','w').write('1' if ok else '0')
"
ck "settings restored from backup file" "$(cat /tmp/sh-r)"

echo; echo "== 6. test-email without key → test-mode (logged, never delivered) =="
curl -s --max-time 90 -b /tmp/sh-admin2.txt -X POST http://localhost:3000/api/admin/test-email -H "$J" \
  -d '{"to":"user@example.com","templateKey":"platform_test"}' > /tmp/sh-send.json
python3 -c "
import json
r=json.load(open('/tmp/sh-send.json'))
ok=(r.get('emailStatus')=='test-mode')
print('  [%s] emailStatus=%s' % ('PASS' if ok else 'FAIL', r.get('emailStatus')))
open('/tmp/sh-r','w').write('1' if ok else '0')
"
ck "test send is safely test-mode" "$(cat /tmp/sh-r)"

echo; echo "== 7. browser: Email tab (no-key strip, footnote, templates) =="
AB="agent-browser"
$AB set viewport 1440 900 || true
$AB open http://localhost:3000/console || true
$AB wait 2500
$AB find label "Username" fill "admin" || true
$AB find label "Password" fill "Superadmin@123" || true
$AB click "button[type=submit]" || true
$AB wait --text "Overview" || true
$AB wait 2000
$AB find text "Email" click || true
$AB wait 3500
mkdir -p /tmp/render
$AB screenshot /tmp/render/email-tab-selfheal.png || true
$AB eval "(() => { const t = document.body.textContent; const checks = [
  ['no-key strip explains test mode', t.includes('No email provider API key saved yet')],
  ['send log footnote (accepted vs delivered)', t.includes('not a delivery guarantee')],
  ['template library header', t.includes('SMTP email templates')],
  ['six templates listed', ['Candidate invitation','Candidate reminder','Submission confirmation','Results notification','Welcome','Platform test'].every(x => t.includes(x))],
  ['Email provider key input present', !!document.querySelector('input[type=password]')],
]; return checks.map(([n,v]) => (v ? 'PASS' : 'FAIL') + ' ' + n).join('\\n'); })()" || true
$AB close || true

kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
echo "RESULT: $PASS passed, $FAIL failed"
echo "SCRIPT_DONE"
