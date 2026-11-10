#!/bin/bash
# Single-shot UI check: redesigned template picker + smooth calculator inputs.
set -u
cd /home/z/my-project || exit 1

DB_URL="postgresql://postgres.tjjquvynogdqrehsspwg:Shaswat%400047@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require"
TS="ui-polish-$(date +%s)@test.local"
TP="Testpass123"
PORT=3213
BASE="http://127.0.0.1:$PORT"
OUT=/tmp/uishots
rm -rf $OUT && mkdir -p $OUT

node node_modules/next/dist/bin/next start -p $PORT > /tmp/ui-server.log 2>&1 &
SERVER_PID=$!
code=000
for i in $(seq 1 60); do
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 $BASE/ 2>/dev/null)
  [ "$code" = "200" ] && break
  sleep 1
done
echo "== server ready ($code) =="

AB="agent-browser"
$AB set viewport 1440 900 >/dev/null 2>&1 || true
$AB open $BASE/ >/dev/null 2>&1
$AB wait 2500

# helper: find first ref whose snapshot line matches $1
ref() { $AB snapshot -i 2>/dev/null | rg "$1" | rg -o 'e[0-9]+' | head -1; }
clickref() { local R; R=$(ref "$1"); if [ -n "$R" ]; then $AB click "@$R" && echo "clicked $1 (@$R)"; else echo "MISS $1"; fi }

# ── 1) sign up throwaway user ──
clickref "Don't have an account" ; $AB wait 800
NAME_T=$(ref 'textbox' | head -1)
BOXES=$($AB snapshot -i 2>/dev/null | rg 'textbox' | rg -o 'e[0-9]+')
echo "textboxes: $BOXES" | tr '\n' ' ' ; echo
B1=$(echo "$BOXES" | sed -n 1p); B2=$(echo "$BOXES" | sed -n 2p); B3=$(echo "$BOXES" | sed -n 3p)
[ -n "$B1" ] && $AB fill "@$B1" "UI Check" >/dev/null
[ -n "$B2" ] && $AB fill "@$B2" "$TS" >/dev/null
[ -n "$B3" ] && $AB fill "@$B3" "$TP" >/dev/null
clickref "Create account"
$AB wait 3500

# ── 2) New checklist dialog ──
$AB screenshot $OUT/00-home.png
clickref "New checklist"
$AB wait 1800
$AB screenshot $OUT/01-picker-cascade.png
$AB snapshot -i > $OUT/picker-snap.txt 2>&1

clickref '"Nursing"'
$AB wait 700
$AB screenshot $OUT/02-picker-nursing.png

# first job title in pane 2 (buttons after the Nursing profession button)
JT=$($AB snapshot -i 2>/dev/null | rg 'button "' | rg -o 'e[0-9]+' | sed -n 3p)
echo "job title: @${JT:-none}"
[ -n "$JT" ] && $AB click "@$JT"
$AB wait 800
$AB screenshot $OUT/03-picker-specialties.png

# search
SRCH=$($AB snapshot -i 2>/dev/null | rg 'searchbox' | rg -o 'e[0-9]+' | head -1)
echo "search box: @${SRCH:-none}"
[ -n "$SRCH" ] && { $AB click "@$SRCH"; $AB keyboard type "ICU"; }
$AB wait 700
$AB screenshot $OUT/04-picker-search.png

# close dialog
clickref "Close"; $AB wait 700

# ── 3) calculator input UX ──
clickref "Calculator"
$AB wait 1500
$AB screenshot $OUT/05-calc-initial.png
BILL=$($AB snapshot -i 2>/dev/null | rg 'Bill Rate' | rg -o 'e[0-9]+' | head -1)
echo "bill rate: @${BILL:-none}"
if [ -n "$BILL" ]; then
  $AB click "@$BILL"; $AB wait 200
  $AB press Control+a; $AB press Backspace; $AB wait 300
  $AB screenshot $OUT/06-calc-cleared.png
  $AB press Backspace; $AB wait 200
  $AB screenshot $OUT/07-calc-second-bs.png
  $AB keyboard type "85"; $AB wait 300
  $AB screenshot $OUT/08-calc-typed-85.png
  $AB press Tab; $AB wait 300
  $AB screenshot $OUT/09-calc-committed.png
fi

echo "== screenshots =="
ls -la $OUT/*.png

kill $SERVER_PID 2>/dev/null; sleep 1
DATABASE_URL="$DB_URL" node -e "
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient({ datasources: { db: { url: process.env.DATABASE_URL } } });
(async () => { await db.user.deleteMany({ where: { email: '$TS' } }); await db.\$disconnect(); console.log('test user deleted'); })();
"
echo "== done =="
