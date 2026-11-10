// Superadmin console login — POST /api/auth/admin-login
// Accepts { username, password } where username is either the full email
// (admin@recruitertool.local) or its local part ("admin"). Only users with
// role="superadmin" can authenticate through this endpoint.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { verifyPassword, createSession, hashPassword } from '@/lib/auth'
import { readPlatformBackup } from '@/lib/platform-backup'

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

    // Dev-sandbox self-heal: a DB re-provision can leave the user table empty
    // (this actually happened — every login 401'd). If the platform has been
    // configured before (backup file exists) but NO user of any kind remains,
    // re-create the default superadmin so the console isn't locked out.
    // Production DBs are seeded via scripts/seed.ts with env credentials and
    // have no backup file, so this never fires there.
    if (candidates.length === 0) {
      const [userCount, backup] = [await db.user.count(), readPlatformBackup()]
      if (userCount === 0 && backup) {
        const admin = await db.user.create({
          data: {
            email: DEFAULT_SUPERADMIN_EMAIL,
            passwordHash: hashPassword(DEFAULT_SUPERADMIN_PASSWORD),
            name: 'Super Admin',
            role: 'superadmin',
            settings: { create: {} },
          },
        })
        console.warn(`[admin-login] DB was re-provisioned empty — recreated default superadmin ${DEFAULT_SUPERADMIN_EMAIL}`)
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
