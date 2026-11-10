// One-shot diagnostic: create a temporary session row for the superadmin
// directly in the DB, use it to call EVERY admin endpoint on the LIVE
// deployment, then delete the session. Answers: do the 500s reproduce
// on the current deployment, and what do the endpoints actually return?
// Run: DATABASE_URL="$(from .env)" bun scripts/probe_live_admin.ts
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'

const BASE = process.env.PROBE_BASE || 'https://vault-verify.vercel.app'
const db = new PrismaClient()

const token = 'diag_' + randomBytes(24).toString('hex')
const admin = await db.user.findFirst({ where: { role: 'superadmin' }, select: { id: true, email: true } })
if (!admin) { console.log('no superadmin found'); process.exit(1) }
await db.session.create({
  data: { token, userId: admin.id, expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
})
console.log(`probe session for ${admin.email} @ ${BASE}`)

const endpoints = [
  '/api/auth/me',
  '/api/admin/overview',
  '/api/admin/skills',
  '/api/admin/users',
  '/api/admin/calculations',
  '/api/admin/settings',
  '/api/admin/email-templates',
  '/api/admin/email-logs',
  '/api/templates',
]

for (const ep of endpoints) {
  try {
    const r = await fetch(BASE + ep, { headers: { cookie: `rt_session=${token}` } })
    const body = await r.text()
    console.log(`${r.status} ${ep} — ${body.slice(0, 160).replace(/\s+/g, ' ')}`)
  } catch (e) {
    console.log(`ERR ${ep} — ${(e as Error).message.slice(0, 120)}`)
  }
}

await db.session.deleteMany({ where: { token } })
console.log('probe session deleted')
await db.$disconnect()
