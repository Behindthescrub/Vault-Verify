# Recruiter tool

A lightweight toolkit for healthcare staffing recruiters — two tools, nothing else:

1. **Skills Checklists** — send RN / LPN / CNA / PT / OT / RT skills checklists to
   candidates by email (Brevo), or enter their self-reported ratings yourself.
   Candidates fill the checklist from a link on any device — no account needed.
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
— change it immediately in **Superadmin → Keys & access → Superadmin credentials**.

## Superadmin (platform owner)

One superadmin account owns all platform data, split into five tabs:

| Tab | What lives there |
| --- | --- |
| **Overview** | Usage stats — recruiters, checklists, completions, avg score, saved calculator runs, emails sent — plus recent signups & submissions |
| **Checklist data** | Every skills checklist + candidate response across all recruiter accounts, with status/template filters, search, full score-sheet view, and CSV export |
| **Users & auth** | All accounts (checklists/runs counts) with **active sessions** — live auth login tokens — and every saved bill-to-pay run |
| **Email** | Brevo API key, sender identity, test mode, test send, and the send log |
| **Keys & access** | Shared GSA Per Diem API key and the superadmin credentials |

What deliberately stays **per-user** (not superadmin): each recruiter's calculator
settings (company name/logo, onboarding default, min-W2, overtime toggle) and their
own checklists in their workspace. Skill templates (RN/LPN/CNA/PT/OT/RRT) are versioned
in code (`src/lib/templates.ts`) so every account always gets the same checklist.

## Deploying (GitHub → Vercel → Supabase → Brevo)

See **[DEPLOY.md](./DEPLOY.md)** for the full step-by-step guide.

## Project structure

```
prisma/schema.prisma     # data model (User, Checklist, Calculation, …)
scripts/seed.ts          # superadmin seed
src/lib/                 # auth, email (Brevo), GSA, calculator math, templates
src/app/api/             # REST API routes
src/app/page.tsx         # the app (single route, view-switched)
src/components/          # calculator, checklists, admin, auth UI
src/components/admin/    # superadmin panels (overview, data, users, email, keys)
```

## Security notes

- Passwords hashed with bcrypt; sessions are random tokens in HttpOnly cookies
  (SameSite=Lax, Secure in production), stored server-side with expiry.
- All checklist/calculation APIs are scoped to the owning user; superadmin-only
  routes check the role server-side.
- Candidate links use unguessable tokens; a submitted checklist cannot be
  re-submitted.
- The Brevo/GSA keys never reach the browser — email and per-diem calls are
  proxied through server routes.
