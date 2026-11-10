# Recruiter tool

A lightweight toolkit for healthcare staffing recruiters — two tools, nothing else:

1. **Skills Checklists** — the MyZipVault skills model: **315 specialty templates
   with 32,000+ skills** across Nursing / Allied / Provider
   (Profession → Job Title → Specialty → Category → Skill). Recruiters pick a
   template, trim the skills, and email a link — candidates self-rate on the
   **1–4 proficiency scale** (No Experience / Limited / Experienced / Proficient)
   with N/A where offered and a typed digital signature, no account needed.
2. **Bill-to-Pay Staffing Calculator** — staffing margin, overtime, traveler
   stipend split with GSA per-diem lookup and a minimum-W2 floor. Every run can
   be named, saved, and reloaded.

## Stack

- **Next.js 16** (App Router) + **React 19** + **TypeScript**
- **Tailwind CSS 4** + **shadcn/ui**
- **Prisma ORM** — SQLite for local dev, **Supabase Postgres** for production
- **Brevo** for transactional email (API key managed in-app, not in env vars)
- **GSA Per Diem API** (api.data.gov) proxied server-side
- bcrypt password hashing + DB-backed session cookies

## Quick start (local)

```bash
bun install                # or npm install
cp .env.example .env       # defaults work with SQLite
bun run db:push            # create the SQLite schema
bun run db:seed            # create the superadmin account
bun run dev                # http://localhost:3000
```

Default superadmin login: `admin@recruitertool.local` / `Superadmin@123`
at **`/superadmin`** (dedicated console URL with its own username + password
login — username `admin`, or the full email) — change the password immediately in
**Keys & access → Superadmin credentials**.

## URLs

| URL | Who | What |
| --- | --- | --- |
| `/` | Recruiters | Log in / sign up (email + password) → checklists & calculator |
| `/superadmin` | Superadmin only | Username + password console login → the six admin tabs below |
| `/?c=<token>` | Candidates | Public checklist self-assessment (no account needed) |

## Superadmin (platform owner)

The superadmin console lives at its own URL, **`/superadmin`**, with a dedicated
username + password login (`POST /api/auth/admin-login` accepts the full email or
its local part — e.g. `admin` for `admin@recruitertool.local`; only accounts with
the `superadmin` role can sign in there). One superadmin account owns all
platform data, split into six tabs:

| Tab | What lives there |
| --- | --- |
| **Overview** | Usage stats — recruiters, checklists, completions, avg score, saved calculator runs, emails sent — plus recent signups & submissions |
| **Skills data** | The skills library itself: master-detail editor (Professions → Job Titles → Specialties → Skills) with add/edit/delete skills, rename/delete groups, and the **2-step Excel import** (validate → import) matching the MyZipVault `Skills Data` template, plus blank-template download and full-data export |
| **Checklist data** | Every skills checklist + candidate response across all recruiter accounts, with status filters, search, full score-sheet view, and CSV export |
| **Users & auth** | All accounts (checklists/runs counts) with **active sessions** — live auth login tokens — and every saved bill-to-pay run |
| **Email** | Brevo API key, sender identity, test mode, test send, and the send log |
| **Keys & access** | Shared GSA Per Diem API key and the superadmin credentials |

What deliberately stays **per-user** (not superadmin): each recruiter's calculator
settings (company name/logo, onboarding default, min-W2, overtime toggle) and their
own checklists in their workspace. The skills library lives in the database
(`SkillTemplate` / `Skill` models) and is managed by the superadmin — sent checklists
keep an immutable snapshot of their skills, so editing the library never breaks
existing checklists.

### Skills data format (Excel import)

The import matches the MyZipVault template — a single `Skills Data` sheet with the
columns: `Profession | Job Title | Specialty | Category | Skill Name | Question
Type | Has N/A Option`. Question types: `rating_1_4` (default), `yes_no`, `text`.
Rows are keyed by (Profession, Job Title, Specialty); duplicates are skipped, and
missing templates are created automatically. The initial 32,837-row dataset
ships as `prisma/seed-skills.xlsx` and is seeded on first run.

## Deploying (GitHub → Vercel → Supabase → Brevo)

See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step guide.

## Project structure

```
prisma/schema.prisma     # data model (User, SkillTemplate, Skill, Checklist, …)
prisma/seed-skills.xlsx  # 32,837-row skills dataset (MyZipVault import template)
scripts/seed.ts          # superadmin + skills seed
src/lib/skills.ts        # 1–4 scale, xlsx import/export, checklist snapshots
src/lib/                 # auth, email (Brevo), GSA, calculator math
src/app/api/             # REST API routes
src/app/page.tsx         # the recruiter app (single route, view-switched)
src/app/superadmin/      # /superadmin — console login + admin shell
src/components/          # calculator, checklists, admin, auth UI
src/components/admin/    # superadmin panels (overview, skills, data, users, email, keys)
```

## Security notes

- Passwords hashed with bcrypt; sessions are random tokens in HttpOnly cookies
  (SameSite=Lax, Secure in production), stored server-side with expiry.
- All checklist/calculation APIs are scoped to the owning user; superadmin-only
  routes check the role server-side.
- `/api/auth/admin-login` only authenticates `superadmin`-role accounts; regular
  users who hit `/superadmin` get an access-restricted page.
- Candidate links use unguessable tokens; a submitted checklist cannot be
  re-submitted.
- Skills xlsx uploads are capped at 10MB, parsed server-side only, and every
  rating is validated (1–4, N/A, yes/no) before anything is stored.
- The Brevo/GSA keys never reach the browser — email and per-diem calls are
  proxied through server routes.
