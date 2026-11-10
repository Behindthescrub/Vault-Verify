#!/bin/bash
# Focused check: typing in the Subject field updates the live preview
# (uses agent-browser fill = real keystrokes, unlike raw .value assignment).
cd /home/z/my-project || exit 1

bun run dev > /tmp/rt-dev.log 2>&1 &
SERVER_PID=$!
code=000
for i in $(seq 1 45); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 http://localhost:3000/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 2
done
echo "== server ready =="

AB="agent-browser"
$AB set viewport 1440 900 || true
$AB open http://localhost:3000/superadmin || true
$AB wait 2500
$AB find label "Username" fill "admin" || true
$AB find label "Password" fill "Superadmin@123" || true
$AB click "button[type=submit]" || true
$AB wait --text "Overview" || true
$AB wait 1500
$AB find text "Email" click || true
$AB wait 2000
$AB find role button click --name "Preview & edit" || true
$AB wait 1500

echo "--- subject textbox in dialog ---"
$AB snapshot -i | grep -A2 -i 'textbox' | head -12

echo; echo "--- fill subject with real keystrokes ---"
# The dialog's subject input: first text input inside the dialog
$AB eval "(() => { const i=[...document.querySelectorAll('div[role=dialog] input')].filter(x=>x.type==='text')[0]; return i ? 'found-subject-input value=' + JSON.stringify(i.value) : 'NOT-FOUND'; })()" || true

SUBJ_REF=$($AB snapshot -i | python3 -c "
import sys, re
for line in sys.stdin:
    m = re.search(r'textbox \[ref=(e\d+)\]', line)
    if m:
        print(m.group(1)); break
")
echo "subject ref: $SUBJ_REF"
if [ -n "$SUBJ_REF" ]; then
  $AB fill "@$SUBJ_REF" "QA LIVE SUBJECT TEST" || true
  $AB wait 800
  $AB eval "(() => document.body.textContent.includes('QA LIVE SUBJECT TEST') ? 'LIVE-PREVIEW-UPDATED' : 'not-updated')()" || true
fi

echo; echo "--- also verify textarea present with HTML ---"
$AB eval "(() => { const t = document.querySelector('div[role=dialog] textarea'); return t ? 'textarea-ok len=' + t.value.length : 'NO-TEXTAREA'; })()" || true

$AB close || true
kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "DONE"
