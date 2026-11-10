#!/bin/bash
# Single-shot browser verification of the superadmin Email tab:
# template list + preview dialog with live iframe + save/reset controls.
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

echo; echo "======== superadmin login ========"
$AB open http://localhost:3000/console || true
$AB wait 2500
$AB find label "Username" fill "admin" || true
$AB find label "Password" fill "Superadmin@123" || true
$AB click "button[type=submit]" || true
$AB wait --text "Overview" || true
$AB wait 2000

echo; echo "======== Email tab: template list ========"
$AB find text "Email" click || true
$AB wait 2500
mkdir -p /tmp/render
$AB screenshot /tmp/render/email-tab-templates.png || true
echo "--- snapshot: template list lines ---"
$AB snapshot | grep -Ei 'smtp email templates|candidate invitation|candidate reminder|submission confirmation|results notification|welcome|platform test|automated|on demand|reset all' | head -20

echo; echo "======== open Candidate invitation preview dialog ========"
$AB find role button click --name "Preview & edit" || true
$AB wait 2000
$AB screenshot /tmp/render/template-dialog.png || true
echo "--- snapshot: dialog lines ---"
$AB snapshot | grep -Ei 'candidate invitation|html body|live preview|desktop|mobile|send test$|reset to default|save template|template enabled|insert it at the cursor' | head -18

echo; echo "======== iframe preview present + rendered ========"
$AB eval "(() => { const f = document.querySelector('div[role=dialog] iframe'); if (!f) return 'NO-IFRAME-IN-DIALOG'; return 'iframe-ok width=' + f.style.width + ' srcdoc-len=' + (f.srcdoc||'').length + ' has-brand=' + (f.srcdoc||'').includes('Vault') + ' has-cta=' + (f.srcdoc||'').includes('Open the checklist'); })()" || true

echo; echo "======== switch preview to mobile ========"
$AB find role button click --name "Mobile" || true
$AB wait 800
$AB eval "(() => { const f = document.querySelector('div[role=dialog] iframe'); return f ? 'mobile-width=' + f.style.width : 'no-iframe'; })()" || true
$AB screenshot /tmp/render/template-dialog-mobile.png || true

echo; echo "======== edit subject → live preview updates ========"
$AB find role button click --name "Desktop" || true
$AB wait 400
$AB eval "(() => { const dlg = document.querySelector('div[role=dialog]'); const inputs = [...dlg.querySelectorAll('input')].filter(i => i.type === 'text'); const subj = inputs[0]; subj.focus(); subj.value='QA SUBJECT — RN ICU'; subj.dispatchEvent(new Event('input', { bubbles: true })); return 'subject-set'; })()" || true
$AB wait 600
$AB eval "(() => document.body.textContent.includes('QA SUBJECT') ? 'preview-subject-updated' : 'not-updated')()" || true

echo; echo "======== close dialog ========"
$AB press Escape || true
$AB wait 800

$AB close || true
kill $SERVER_PID 2>/dev/null
pkill -9 -u z -f 'next dev' 2>/dev/null
pkill -9 -u z -f 'next-server' 2>/dev/null
sleep 1
echo "remaining next procs: $(ps -u z -o command | grep -c '[n]ext')"
echo "BROWSER_DONE"
