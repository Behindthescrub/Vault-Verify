// Superadmin console login — POST /api/auth/admin-login
// Accepts { username, password } where username is either the full email
// (admin@recruitertool.local) or its local part ("admin"). Only users with
// role="superadmin" can authenticate through this endpoint.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, createSession, hashPassword } from '@/lib/auth'

const DEFAULT_SUPERADMIN_EMAIL = 'admin@recruitertool.local'
const DEFAULT_SUPERADMIN_PASSWORD = 'Superadmin@123' // change in Keys & access after first login

const schema = z.object({
  username: z.string().min(1).max(200),
  password: z.string().min(1),
})

function toPublic(user: { id: string; email: string; name: string | null; company: string | null; role: string }) {
  return { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: 'Enter your username and password' }, { status: 400 })
    }
    const input = parsed.data.username.toLowerCase().trim()
    const isEmail = input.includes('@')

    // Resolve candidate superadmin accounts. Superadmins are few (typically one),
    // so fetch them all and match by email or by the email's local part.
    let candidates: { id: string; email: string; passwordHash: string; name: string | null; company: string | null; role: string }[]
    if (isEmail) {
      candidates = await db.user.findMany({
        where: { email: input, role: 'superadmin' },
      })
    } else {
      const superadmins = await db.user.findMany({ where: { role: 'superadmin' } })
      candidates = superadmins.filter((u) => u.email.toLowerCase().split('@')[0] === input)
    }

    // Dev-sandbox self-heal: the sandbox can re-provision db/custom.db empty
    // (this happened twice: 2026-11-10 16:54 and 17:14 UTC — the second wipe
    // also deleted db/platform-backup.json, so an earlier backup-gated heal
    // never fired and every login 401'd). If NO superadmin exists at all, the
    // console is permanently locked out — nobody can authenticate here. So:
    // whenever the platform has zero superadmin accounts, recreate the default
    // one so the console is always recoverable. Production DBs are seeded via
    // scripts/seed.ts (a superadmin always exists), and if the seed is re-run
    // afterwards it just reports "already exists" — no side effects.
    if (candidates.length === 0) {
      const superadminCount = await db.user.count({ where: { role: 'superadmin' } })
      if (superadminCount === 0) {
        const admin = await db.user.create({
          data: {
            email: DEFAULT_SUPERADMIN_EMAIL,
            passwordHash: hashPassword(DEFAULT_SUPERADMIN_PASSWORD),
            name: 'Super Admin',
            role: 'superadmin',
            settings: { create: {} },
          },
        })
        console.warn(`[admin-login] no superadmin exists (DB re-provisioned?) — recreated default superadmin ${DEFAULT_SUPERADMIN_EMAIL}`)
        candidates = input === DEFAULT_SUPERADMIN_EMAIL || (!isEmail && input === DEFAULT_SUPERADMIN_EMAIL.split('@')[0])
          ? [admin]
          : []
      }
    }

    const user = candidates.find((u) => verifyPassword(parsed.data.password, u.passwordHash))
    if (!user) {
      return NextResponse.json({ error: 'Invalid superadmin username or password' }, { status: 401 })
    }

    await createSession(user.id)
    return NextResponse.json({ user: toPublic(user) })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
