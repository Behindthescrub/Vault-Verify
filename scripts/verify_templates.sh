#!/bin/bash
# Single-shot verification of the SMTP email template system.
# 1) superadmin template CRUD API  2) template-key test send (REAL branded email)
# 3) full E2E: signup → welcome, create checklist → invite, submit → confirmation+results
# 4) cleanup. Browser UI checked separately (next script).
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

J='content-type: application/json'

echo; echo "== 1. superadmin login =="
rm -f /tmp/rt-admin.txt
curl -s --max-time 120 -c /tmp/rt-admin.txt -X POST http://localhost:3000/api/auth/admin-login -H "$J" \
  -d '{"username":"admin","password":"Superadmin@123"}' | head -c 120; echo

echo; echo "== 2. GET email-templates (expect 6) =="
curl -s --max-time 120 -b /tmp/rt-admin.txt http://localhost:3000/api/admin/email-templates \
  | python3 -c "import json,sys; d=json.load(sys.stdin); ts=d['templates']; print('count:', len(ts)); [print(f\"  {t['key']:24} | {t['name']:36} | subject: {t['subject'][:44]}\") for t in ts]"

echo; echo "== 3. PUT edit candidate_invite subject =="
curl -s --max-time 60 -b /tmp/rt-admin.txt -X PUT http://localhost:3000/api/admin/email-templates -H "$J" \
  -d '{"key":"candidate_invite","subject":"CUSTOM — {{checklist_title}}","bodyHtml":"<p>test {{candidate_name}}</p>","isActive":true}' \
  | python3 -c "import json,sys; t=json.load(sys.stdin)['template']; print('saved subject:', t['subject'])"

echo; echo "== 3b. reset candidate_invite =="
curl -s --max-time 60 -b /tmp/rt-admin.txt -X POST http://localhost:3000/api/admin/email-templates/reset -H "$J" \
  -d '{"key":"candidate_invite"}' | head -c 80; echo
curl -s --max-time 60 -b /tmp/rt-admin.txt http://localhost:3000/api/admin/email-templates \
  | python3 -c "import json,sys; t=[x for x in json.load(sys.stdin)['templates'] if x['key']=='candidate_invite'][0]; print('reverted subject:', t['subject'])"

echo; echo "== 4. test-email with templateKey=candidate_invite (REAL branded send) =="
curl -s --max-time 90 -b /tmp/rt-admin.txt -X POST http://localhost:3000/api/admin/test-email -H "$J" \
  -d '{"to":"test@example.com","templateKey":"candidate_invite"}'; echo

echo; echo "== 5. recruiter signup → welcome email =="
TS="tpl$(date +%s)@test.local"
rm -f /tmp/rt-user.txt
curl -s --max-time 120 -c /tmp/rt-user.txt -X POST http://localhost:3000/api/auth/signup -H "$J" \
  -d "{\"email\":\"$TS\",\"password\":\"Testpass123\",\"name\":\"Test Recruiter\",\"company\":\"VV QA\"}" | head -c 140; echo
echo "   test recruiter: $TS"

echo; echo "== 6. create checklist (1 rating skill) =="
TID=$(curl -s --max-time 60 http://localhost:3000/api/templates | python3 -c "
import json,sys
g=json.load(sys.stdin)['grouped']
p=next(iter(g.values())); j=next(iter(p.values()))
print(j[0]['id'])")
echo "   real template id: $TID"
CID=$(curl -s --max-time 120 -b /tmp/rt-user.txt -X POST http://localhost:3000/api/checklists -H "$J" \
  -d "{\"title\":\"RN — ICU (template QA)\",\"templateId\":\"$TID\",\"candidateName\":\"QA Candidate\",\"candidateEmail\":\"qa-candidate@test.local\",\"items\":[{\"category\":\"Core\",\"skills\":[{\"name\":\"S1\",\"questionType\":\"rating_1_4\"}]}]}" \
  | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('checklist',{}).get('id','') or d)")
echo "   checklist id: $CID"
CL=$(curl -s --max-time 60 -b /tmp/rt-user.txt http://localhost:3000/api/checklists | python3 -c "import json,sys; cl=[c for c in json.load(sys.stdin)['checklists'] if c['id']=='$CID'][0]; print(cl.get('token',''))")
echo "   token from list: '${CL}' (may be empty — invite link carries it)"

echo; echo "== 7. invite (expect candidate_invite) =="
INV=$(curl -s --max-time 90 -b /tmp/rt-user.txt -X POST "http://localhost:3000/api/checklists/$CID/invite" -H "$J" \
  -d '{"toEmail":"qa-candidate@test.local","message":"QA personal message line 1.\nline 2."}')
echo "$INV"
CL=$(echo "$INV" | python3 -c "import json,sys; print(json.load(sys.stdin).get('link','').split('c=')[-1])")
echo "   token from invite link: $CL"

echo; echo "== 7b. re-invite → reminder template =="
curl -s --max-time 90 -b /tmp/rt-user.txt -X POST "http://localhost:3000/api/checklists/$CID/invite" -H "$J" \
  -d '{"toEmail":"qa-candidate@test.local"}'; echo

echo; echo "== 8. submit (expect confirmation + results) =="
curl -s --max-time 120 -X POST "http://localhost:3000/api/public/checklist/$CL/submit" -H "$J" \
  -d '{"ratings":{"S1":3},"lastPerformed":{"S1":"3m"},"candidateName":"QA Candidate","candidateEmail":"qa-candidate@test.local","signedName":"QA Candidate","printedName":"QA Q. Candidate"}'; echo

echo; echo "== 9. email log (last 14) =="
curl -s --max-time 60 -b /tmp/rt-admin.txt http://localhost:3000/api/admin/email-logs \
  | python3 -c "import json,sys; [print(f\"  {l['purpose']:13} | {l['status']:9} | {l['toEmail'][:30]:30} | {l['subject'][:48]}\") for l in json.load(sys.stdin)['logs'][:14]]"

echo; echo "== 10. cleanup =="
bun -e "
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
const d = await db.user.deleteMany({ where: { email: { in: ['$TS'] } } }) // cascades sessions/settings/checklists
console.log('test users deleted:', d.count)
const logs = await db.emailLog.count()
console.log('email log rows kept:', logs, '(superadmin-visible history)')
await db.\$disconnect()
"

kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
echo "SCRIPT_DONE"
