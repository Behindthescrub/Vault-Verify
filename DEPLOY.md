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
2. Grab the connection strings from **Project Settings → Database**:
   - **Transaction pooler** (port `6543`) → this becomes `DATABASE_URL`
   - **Session pooler / Direct** (port `5432`) → for migrations
3. Copy them somewhere; you'll paste them into Vercel in step 3.

**Switch Prisma from SQLite to Postgres** — one line in `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"   // was "sqlite"
  url      = env("DATABASE_URL")
}
```

Commit that change and push.

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

Visit your Vercel URL, log in as the superadmin, and change the password in
**Superadmin → Platform → Credentials**.

> Local dev keeps working with SQLite: just keep a local `.env` with
> `DATABASE_URL="file:./db/custom.db"` (git-ignored) and leave the schema
> provider switched only when you deploy — or keep a second clone for deploys.

## 4. Brevo (transactional email)

The Brevo API key is **not** an env var — you set it inside the app:

1. Sign up at [brevo.com](https://www.brevo.com) (free tier: 300 emails/day).
2. **SMTP & API → API keys → Generate new key (v3)** → copy the `xkeysib-…` key.
3. In Brevo, **Senders → add and verify** the sender email you'll send from
   (e.g. `no-reply@yourdomain.com`). For better deliverability also add the
   SPF/DKIM records Brevo shows you to your domain's DNS.
4. In the app: log in as superadmin → **Superadmin → Platform**:
   - paste the **Brevo API key**
   - set the **sender email** (must match the verified sender) and name
   - use **Send test email** to verify
   - turn **Test mode OFF** once the test arrives

   While Test mode is ON (default), every send is only logged — nothing is
   delivered, and the checklist invite dialog shows a copyable link instead,
   so nothing breaks before your key is ready.

### GSA Per Diem key (optional, for the calculator's live fetch)

1. Get a free key at [api.data.gov/sign-up](https://api.data.gov/sign-up/).
2. Superadmin → Platform → **GSA Per Diem API key (shared)** → paste → Save.

Users can also add a personal GSA key in their own Settings; it overrides the
shared one for their account only.

---

## Daily flow (what the app does)

1. **Recruiter** signs up → creates a checklist from a template (RN/LPN/CNA/PT/OT/RT),
   customizes skills → **Invite** sends the link by email (or **Copy link** /
   **Manual** entry).
2. **Candidate** opens the link on any device, rates every skill 1–5, submits —
   no account needed.
3. **Recruiter** sees per-category averages, overall score, and skill-by-skill
   ratings in the checklist detail view.
4. **Calculator**: enter bill/pay rates → margin, overtime blend, traveler
   stipend split with min-W2 floor → **Save calculation** → reload any past run.

## Maintenance

- `bun run lint` — code quality
- `npx prisma studio` — inspect the database
- Superadmin → Platform → Send log — audit every email attempt
