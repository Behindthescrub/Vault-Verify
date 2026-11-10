// One-shot: drop all EmailTemplate rows so they lazily re-create from the
// new CRM-frame defaults in src/lib/email-templates.ts (content-only bodies;
// the branded shell is applied by buildEmailFrame at send time).
//
// Usage: bun scripts/reset_email_templates.mjs
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

const res = await db.emailTemplate.deleteMany({})
console.log(`deleted ${res.count} email template rows (they re-create from code defaults on next use)`)

// sanity: show the superadmin accounts for the e2e test send
const supers = await db.user.findMany({
  where: { role: 'superadmin' },
  select: { email: true, name: true },
})
console.log('superadmins:', JSON.stringify(supers))

await db.$disconnect()
