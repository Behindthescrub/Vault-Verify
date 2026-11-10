// Wipe ALL test data from the production database (Supabase).
// Keeps: the platform-admin account, the skills library, and the
// PlatformSetting row (keys/sender neutralized).
// Credentials come from DATABASE_URL env — nothing hardcoded.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const before = {
    users: await db.user.count(),
    sessions: await db.session.count(),
    emailLogs: await db.emailLog.count(),
    emailTemplates: await db.emailTemplate.count(),
    checklists: await db.checklist.count(),
    calculations: await db.calculation.count(),
  }
  console.log('BEFORE:', before)

  // Test data: sessions (logins from verification runs), email logs,
  // lazily-recreated email templates, test checklists/calculations,
  // and any non-admin users.
  await db.session.deleteMany({})
  await db.emailLog.deleteMany({})
  await db.emailTemplate.deleteMany({})
  await db.calculation.deleteMany({})
  await db.checklist.deleteMany({})
  await db.checklistResponse.deleteMany({})
  const nonAdmin = await db.user.deleteMany({ where: { role: { not: 'superadmin' } } })

  // Neutralize the default sender (was a real personal address).
  await db.platformSetting.update({
    where: { id: 'main' },
    data: {
      brevoSenderEmail: 'noreply@example.com',
      brevoApiKey: null,
      gsaApiKey: null,
      emailTestMode: true,
    },
  })

  const after = {
    users: await db.user.count(),
    sessions: await db.session.count(),
    emailLogs: await db.emailLog.count(),
    emailTemplates: await db.emailTemplate.count(),
    checklists: await db.checklist.count(),
    calculations: await db.calculation.count(),
    templates: await db.skillTemplate.count(),
    skills: await db.skill.count(),
  }
  console.log('deleted non-admin users:', nonAdmin.count)
  console.log('AFTER :', after)
  if (after.users !== 1 || after.sessions !== 0 || after.emailLogs !== 0 || after.templates !== 315) {
    console.error('UNEXPECTED FINAL STATE')
    process.exit(1)
  }
  console.log('✅ test data wiped; skills library + admin account intact')
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
