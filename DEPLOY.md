# Deploying Recruiter tool — GitHub → Vercel → Supabase → Brevo

Four services, in this order. Total time: ~30 minutes.

---

## 1. GitHub (new repository)

The project folder is already a git repo with an initial commit. Push it to a
**new** repository (do NOT reuse the MyZipVault repo):

```bash
# inside the project folder
git remote add origin https://github.com/<your-username>/recruiter-tool.git
git push -u origin main
```

(Create the empty repo on github.com first — no README, no license, so the
push isn't rejected. If you prefer the web UI, upload the folder contents
instead.)

## 2. Supabase (Postgres database)

1. Create a project at [supabase.com](https://supabase.com) (free tier is fine).
2. In **Project Settings → Database**, use the **Connection pooler**
   (IPv4-friendly) string — **session mode, port 5432** — as `DATABASE_URL`:

   ```
   postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres?sslmode=require
   ```

   > Do NOT use the direct string (`db.<ref>.supabase.co:5432`) — it is
   > IPv6-only and fails on IPv4-only hosts (Vercel functions, this sandbox).
   > Percent-encode special characters in the password (`@` → `%40`).

**Prisma is already on Postgres** (`provider = "postgresql"` in
`prisma/schema.prisma`) — nothing to switch anymore.

**This project is already migrated and seeded** (superadmin + 315 templates /
32,837 skills live in Supabase). To redo it on a fresh project:

```bash
DATABASE_URL="postgresql://…pooler…5432/postgres?sslmode=require" npx prisma db push
DATABASE_URL="postgresql://…pooler…5432/postgres?sslmode=require" bun scripts/seed.ts
```

## 3. Vercel (hosting + auto-deploy)

1. [vercel.com](https://vercel.com) → **Add New → Project** → import your
   `recruiter-tool` repo. Vercel auto-detects Next.js.
2. Before the first build, add the Environment Variable:

   | Name | Value (example) |
   |---|---|
   | `DATABASE_URL` | `postgresql://postgres.abc123:PASS@aws-0-us-east-1.pooler.supabase.com:6543/postgres?connection_limit=1&pgbouncer=true` |

   Mark it for **Production + Preview**.
3. Deploy. Every future `git push` to `main` auto-deploys (that's the
   "Repo + auto-deploy" setup — `vercel.json` in the repo pins the build
   command `prisma generate && next build`).

**Create the tables + superadmin** (one-time, from your laptop):

```bash
# in the project folder, with the Supabase connection string
DATABASE_URL="postgresql://…6543/postgres?connection_limit=1&pgbouncer=true" \
  npx prisma db push

SUPERADMIN_EMAIL="you@yourdomain.com" \
SUPERADMIN_PASSWORD="ChooseAStrongPassword" \
  DATABASE_URL="postgresql://…6543/postgres?connection_limit=1&pgbouncer=true" \
  bun scripts/seed.ts
```

Visit **`https://<your-app>.vercel.app/superadmin`** — the superadmin console has
its own URL with a username + password login (enter `you@yourdomain.com`, or just
`you` — the local part of the email — as the username). Log in there and change
the password in **Keys & access → Superadmin credentials**. The recruiter app at
`/` stays completely separate for your staffing accounts.

> The dev sandbox runs on the same Supabase Postgres via the pooler string in
> `.env` (git-ignored — copy `.env.example` and fill in your password). The old
> SQLite file (`db/custom.db`) is kept only as an emergency fallback.
>
> If the database is ever wiped empty, the app self-heals: the superadmin
> console login (`admin` / `Superadmin@123` unless changed) recreates the
> default admin, and saved platform settings — including the Brevo/GSA keys —
> are restored automatically from `db/platform-backup.json`. Only the skills
> library needs a re-run of `bun scripts/seed.ts`.

## 4. Brevo (transactional email)

The Brevo API key is **not** an env var — you set it inside the app:

1. Sign up at [brevo.com](https://www.brevo.com) (free tier: 300 emails/day).
2. **SMTP & API → API keys → Generate new key (v3)** → copy the `xkeysib-…` key.
3. In Brevo, **Senders → add and verify** the sender email you'll send from
   (e.g. `no-reply@yourdomain.com`). For better deliverability also add the
   SPF/DKIM records Brevo shows you to your domain's DNS.
4. In the app: log in as superadmin → **Superadmin → Email**:
   - paste the **Brevo API key**
   - set the **sender email** (must match the verified sender) and name
   - use **Send test email** to verify
   - turn **Test mode OFF** once the test arrives

   While Test mode is ON (default), every send is only logged — nothing is
   delivered, and the checklist invite dialog shows a copyable link instead,
   so nothing breaks before your key is ready.

**"No credits deducted" / "nothing received" — read this first.** The Email
tab's **Connected Brevo account** strip shows the live account behind your
key (e.g. `sam.p@medstalent.com — free · 300 emails/day`), so there's no
guessing which dashboard to watch:

1. **Check Brevo → Transactional → Events first.** If you see the error
   *"Email not sent: Your sending platform is currently disabled"* — that
   is the whole story. Brevo's API still **accepts** every send (HTTP 201 +
   a `messageId` in the app's send log) but **silently drops** each email,
   so nothing is delivered and no quota is used. Per Brevo's docs the
   transactional platform needs a **separate activation**: create a
   support ticket *from that exact account*
   ([help.brevo.com → submit a request](https://help.brevo.com/hc/en-us/requests/new))
   asking them to activate transactional sending. Once enabled, sends
   start delivering and consuming the quota.
2. **Free plan = a 300/day quota that resets every 24h — there is no prepaid
   credit balance.** To see usage, log into Brevo with *that exact account*
   and open Transactional → Real-time. (An SMTP key from a different Brevo
   login will be rejected — keys only work on the account that created them.)
3. **A `messageId` in the send log = Brevo accepted the email — not a
   delivery guarantee.** Delivery truth lives only in Brevo's Events view.
4. Once sending works: a sender on a free-mail domain (gmail.com, …)
   cannot have Brevo SPF/DKIM records and often lands in **spam**. Verify
   a sender on a domain you own (e.g. `no-reply@medstalent.com`) with
   Brevo's DNS records, then switch the sender in the Email tab — the
   strip flags this automatically with a deliverability warning.

### GSA Per Diem key (optional, for the calculator's live fetch)

1. Get a free key at [api.data.gov/sign-up](https://api.data.gov/sign-up/).
2. Superadmin → Keys & access → **GSA Per Diem API key (shared)** → paste → Save.

Users can also add a personal GSA key in their own Settings; it overrides the
shared one for their account only.

---

## Daily flow (what the app does)

1. **Recruiter** signs up → creates a checklist from the skills library
   (Profession → Job Title → Specialty — 315 templates), trims the skills →
   **Invite** sends the link by email (or **Copy link** / **Manual** entry).
2. **Candidate** opens the link on any device, rates every skill on the 1–4
   proficiency scale (No Experience / Limited / Experienced / Proficient),
   optionally N/A, signs their name, submits — no account needed.
3. **Recruiter** sees per-category averages (N/A excluded), overall score out
   of 4, the digital signature, and skill-by-skill ratings in the detail view.
4. **Superadmin** maintains the skills library itself: Excel import
   (MyZipVault `Skills Data` format), add/edit/delete skills, rename/delete
   professions & job titles — in **Superadmin → Skills data**.
5. **Calculator**: enter bill/pay rates → margin, overtime blend, traveler
   stipend split with min-W2 floor → **Save calculation** → reload any past run.

## Maintenance

- `bun run lint` — code quality
- `npx prisma studio` — inspect the database
- Superadmin → Email → Send log — audit every email attempt
- Superadmin → Checklist data — every checklist & response, exportable as CSV
- Superadmin → Skills data — import/export the skills library (MyZipVault
  `Skills Data` xlsx format)
