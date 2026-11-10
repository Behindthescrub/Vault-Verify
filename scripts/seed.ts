// Seed: creates the superadmin account and the platform settings row.
// Run: bun scripts/seed.ts
// Credentials come from SUPERADMIN_EMAIL / SUPERADMIN_PASSWORD env vars
// (defaults below) — change the password afterwards in Superadmin → Platform.
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const db = new PrismaClient()

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'admin@recruitertool.local').toLowerCase()
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Superadmin@123'

async function main() {
  await db.platformSetting.upsert({
    where: { id: 'main' },
    create: { id: 'main' },
    update: {},
  })

  const existing = await db.user.findUnique({ where: { email: SUPERADMIN_EMAIL } })
  if (existing) {
    if (existing.role !== 'superadmin') {
      await db.user.update({ where: { id: existing.id }, data: { role: 'superadmin' } })
      console.log(`✅ Existing user ${SUPERADMIN_EMAIL} promoted to superadmin`)
    } else {
      console.log(`✅ Superadmin ${SUPERADMIN_EMAIL} already exists`)
    }
  } else {
    await db.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        passwordHash: bcrypt.hashSync(SUPERADMIN_PASSWORD, 10),
        name: 'Super Admin',
        role: 'superadmin',
        settings: { create: {} },
      },
    })
    console.log(`✅ Superadmin created: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`)
    console.log('   → Log in and change the password in Superadmin → Platform.')
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
