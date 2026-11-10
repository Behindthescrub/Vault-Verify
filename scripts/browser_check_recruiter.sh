#!/bin/bash
# Single-shot: recruiter login → Settings tab → verify the GSA API key field
# is gone from the recruiter-side settings UI.
cd /home/z/my-project || exit 1

TS="vv1794327270@test.local"
TP="Testpass123"

bun run dev > /tmp/rt-dev.log 2>&1 &
SERVER_PID=$!
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "== server ready (code=$code) =="

AB="agent-browser"
$AB set viewport 1440 900 || true
$AB open http://localhost:3000/ || true
$AB wait 2500

echo "--- auth page interactive snapshot ---"
$AB snapshot -i 2>&1 | head -25

# login as test recruiter
$AB find label "Email" fill "$TS" 2>/dev/null || $AB find first "input[type='email']" fill "$TS" || true
$AB find label "Password" fill "$TP" 2>/dev/null || $AB find first "input[type='password']" fill "$TP" || true
$AB find role button click --name "Log in" 2>/dev/null || true
$AB wait --text "Skills Checklists" || true
$AB wait 2000
echo "--- after login url: $($AB get url) ---"

echo; echo "======== Settings tab ========"
$AB find role button click --name "Settings" 2>/dev/null || $AB find text "Settings" click || true
$AB wait 2000
$AB screenshot /tmp/rt-settings.png || true
echo "--- settings snapshot (ALL) ---"
$AB snapshot | head -60
echo "--- GSA mentions (expect none) ---"
GSA_HITS=$($AB snapshot | grep -ci 'gsa' || true)
echo "GSA mentions on Settings page: $GSA_HITS"

$AB close || true
kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
