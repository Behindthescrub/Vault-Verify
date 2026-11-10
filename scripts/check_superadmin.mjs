// Check superadmin records in the DB (no secret values printed — only lengths/matches)
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

async function main() {
  const users = await db.user.findMany({
    select: { id: true, email: true, name: true, role: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  console.log(`Total users: ${users.length}`)
  for (const u of users) {
    console.log(`- [${u.role}] ${u.email} (name=${u.name ?? 'null'}, created=${u.createdAt.toISOString()})`)
  }

  const admins = await db.user.findMany({ where: { role: 'superadmin' } })
  console.log(`\nSuperadmins: ${admins.length}`)
  for (const a of admins) {
    const hash = String(a.passwordHash)
    const tries = ['Superadmin@123', 'superadmin@123', 'Superadmin@1234', 'Admin@123', 'admin123', 'password']
    const results = tries.map((t) => (bcrypt.compareSync(t, hash) ? 'MATCH' : 'no'))
    console.log(`- ${a.email}: hashLen=${hash.length} hashPrefix=${hash.slice(0, 7)}…`)
    console.log(`  password probe: ${tries.map((t, i) => `${t}=${results[i]}`).join(', ')}`)
  }

  const settings = await db.platformSetting.findUnique({ where: { id: 'main' } })
  console.log(`\nPlatform settings present: ${!!settings}`)
  const counts = {
    recruiters: await db.user.count({ where: { role: 'recruiter' } }),
    templates: await db.skillTemplate.count(),
    emailLogs: await db.emailLog.count(),
  }
  console.log('Counts:', counts)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
