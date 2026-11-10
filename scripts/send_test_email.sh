#!/bin/bash
# Send the VaultVerify platform test email to a real address via the
# superadmin test-email API (same path the Email tab button uses).
cd /home/z/my-project || exit 1

TO="${1:-shaswatpandey0047@gmail.com}"

bun run dev > /tmp/ste-dev.log 2>&1 &
SERVER_PID=$!
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "== server ready (code=$code) =="

J='content-type: application/json'

echo; echo "== 1. superadmin login =="
rm -f /tmp/ste-admin.txt
curl -s --max-time 120 -c /tmp/ste-admin.txt -X POST http://localhost:3000/api/auth/admin-login -H "$J" \
  -d '{"username":"admin","password":"Superadmin@123"}' | head -c 120; echo

echo; echo "== 2. send platform_test email to $TO =="
curl -s --max-time 90 -b /tmp/ste-admin.txt -X POST http://localhost:3000/api/admin/test-email -H "$J" \
  -d "{\"to\":\"$TO\",\"templateKey\":\"platform_test\"}"; echo

echo; echo "== 3. email log entry (latest for this address) =="
curl -s --max-time 60 -b /tmp/ste-admin.txt http://localhost:3000/api/admin/email-logs \
  | python3 -c "
import json,sys
logs=json.load(sys.stdin)['logs']
hit=[l for l in logs if '$TO' in l.get('toEmail','')]
if hit:
    l=hit[0]
    print(f\"  purpose={l['purpose']} status={l['status']} to={l['toEmail']}\")
    print(f\"  subject={l['subject']}\")
else:
    print('  no log row found for', '$TO')
"

kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
echo "SCRIPT_DONE"
