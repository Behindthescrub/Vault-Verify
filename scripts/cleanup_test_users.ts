// Remove throwaway test users created during verification.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const deleted = await db.user.deleteMany({
    where: { email: { in: ['vv1794327245@test.local', 'vv1794327270@test.local'] } },
  })
  console.log('deleted test users:', deleted.count)
  const remaining = await db.user.findMany({
    select: { email: true, role: true },
    orderBy: { role: 'asc' },
  })
  console.log('remaining users:', remaining)
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
