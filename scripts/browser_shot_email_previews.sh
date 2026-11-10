#!/bin/bash
# Screenshot the generated email previews (real pipeline output) served by the
# dev server: platform_test, candidate_invite, recruiter_results.
cd /home/z/my-project || exit 1
AB="agent-browser"

$AB set viewport 840 1200 || true
for t in platform_test candidate_invite recruiter_results; do
  $AB open "http://localhost:3000/email-preview/$t.html" || true
  $AB wait 1500
  $AB screenshot "/tmp/vv-frame-$t.png" || true
  echo "shot $t"
done
$AB close || true
echo done
