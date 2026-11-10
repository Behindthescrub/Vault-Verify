#!/bin/bash
# Single-shot API verification for the Brevo-superadmin + GSA-key-removal work.
# Starts the dev server, runs all checks, prints results, kills the server.
# Background processes don't survive between tool calls in this sandbox,
# so everything happens inside this one script.
cd /home/z/my-project || exit 1

bun run dev > /tmp/rt-dev.log 2>&1 &
SERVER_PID=$!

code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "== server ready after ~$((i*2))s (code=$code) =="

echo; echo "== 1. superadmin login =="
rm -f /tmp/rt-admin.txt
curl -s --max-time 120 -c /tmp/rt-admin.txt -X POST http://localhost:3000/api/auth/admin-login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"Superadmin@123"}' | head -c 200; echo

echo; echo "== 2. GET /api/admin/settings (expect VaultVerify / key set / test-mode FALSE) =="
curl -s --max-time 60 -b /tmp/rt-admin.txt http://localhost:3000/api/admin/settings | python3 -m json.tool

echo; echo "== 3. recruiter signup =="
TS="vv$(date +%s)@test.local"
rm -f /tmp/rt-user.txt
curl -s --max-time 120 -c /tmp/rt-user.txt -X POST http://localhost:3000/api/auth/signup \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$TS\",\"password\":\"Testpass123\",\"company\":\"VV Test\"}" | head -c 250; echo
echo "test user: $TS"

echo; echo "== 4. PUT /api/settings with a smuggled gsaApiKey (must be IGNORED) =="
curl -s --max-time 60 -b /tmp/rt-user.txt -X PUT http://localhost:3000/api/settings \
  -H 'content-type: application/json' \
  -d '{"companyName":"Test Co","gsaApiKey":"SMUGGLED-KEY-MUST-NOT-SAVE","minW2":18}' | python3 -m json.tool

echo; echo "== 5. GET /api/calculator/gsa via PLATFORM key only (expect 200 + perDiem) =="
curl -s --max-time 60 -b /tmp/rt-user.txt 'http://localhost:3000/api/calculator/gsa?zip=10001&year=2026&month=11' | head -c 300; echo

echo; echo "== 6. test-email endpoint (real send, logged) =="
curl -s --max-time 60 -b /tmp/rt-admin.txt -X POST http://localhost:3000/api/admin/test-email \
  -H 'content-type: application/json' -d '{"to":"myzipvault@gmail.com"}' | head -c 250; echo

echo; echo "== done — killing server =="
kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
echo "TEST_USER=$TS"
