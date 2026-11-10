#!/bin/bash
# Single-shot browser verification: superadmin Email/Keys tabs + recruiter
# Settings page (GSA field must be gone). Everything in one call because
# background processes (dev server + browser daemon) die between tool calls.
cd /home/z/my-project || exit 1

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

echo; echo "======== SUPERADMIN: /superadmin ========"
$AB open http://localhost:3000/superadmin || true
$AB wait --load networkidle 2>/dev/null || true
$AB wait 1500
$AB find label "Username" fill "admin" || $AB fill "#sa-username" "admin" || true
$AB find label "Password" fill "Superadmin@123" || $AB fill "#sa-password" "Superadmin@123" || true
$AB click "button[type=submit]" || true
$AB wait --text "Overview" || true
$AB wait 2000
echo "--- login result url: $($AB get url) ---"

echo; echo "======== Email tab ========"
$AB find text "Email" click || true
$AB wait 1500
$AB screenshot /tmp/rt-email-tab.png || true
echo "--- email tab snapshot (relevant lines) ---"
$AB snapshot | grep -Ei 'brevo|sender|vaultverify|myzipvault|test mode|xkeysib|xsmtp|current key' || echo "(no match in snapshot)"

echo; echo "======== Keys & access tab ========"
$AB find text "Keys & access" click || true
$AB wait 1500
$AB screenshot /tmp/rt-keys-tab.png || true
echo "--- keys tab snapshot (relevant lines) ---"
$AB snapshot | grep -Ei 'gsa|per diem|platform-wide|override|superadmin credentials' || echo "(no match in snapshot)"

echo; echo "======== RECRUITER: main app login ========"
$AB open http://localhost:3000/ || true
$AB wait --load networkidle 2>/dev/null || true
$AB wait 2000
$AB snapshot -i > /tmp/rt-auth-snap.txt 2>&1 || true
cat /tmp/rt-auth-snap.txt | head -30

$AB close || true
echo; echo "== killing server =="
kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
