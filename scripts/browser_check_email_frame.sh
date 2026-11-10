#!/bin/bash
# Single-shot: superadmin console → Email tab → open the "Platform test email"
# template → screenshot the live preview with the new CRM frame
# (logo top, content box, company banner). Also grabs the invite template.
cd /home/z/my-project || exit 1

AB="agent-browser"
USER="shaswatpandey0047"
PASS="Superadmin@123"

$AB set viewport 1440 900 || true
$AB open http://localhost:3000/console || true
$AB wait 2500

echo "--- login page ---"
$AB snapshot -i 2>&1 | head -8

$AB find first "#sa-username" fill "$USER" || true
$AB find first "#sa-password" fill "$PASS" || true
$AB find role button click --name "Sign in to console" || true
$AB wait 3000
echo "--- after login: $($AB get url) ---"

# Email tab
$AB find role button click --name "Email" || $AB find text "Email" click || true
$AB wait 2500
$AB screenshot /tmp/vv-email-tab.png || true

# Open the Platform test email template
$AB find text "Platform test email" click || true
$AB wait 2000
$AB screenshot /tmp/vv-test-template.png || true

# Switch to the candidate invitation template (has CTA + note box)
$AB find text "Candidate invitation" click || true
$AB wait 2000
$AB screenshot /tmp/vv-invite-template.png || true

# Mobile device preview of the invite
$AB find role button click --name "Mobile" || true
$AB wait 1200
$AB screenshot /tmp/vv-invite-mobile.png || true

echo "--- template dialog snapshot (labels present?) ---"
$AB snapshot 2>&1 | rg -i "content only|branded frame|live preview|company banner" | head -5

$AB close || true
echo "done"
