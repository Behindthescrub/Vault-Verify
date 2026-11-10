const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const u = await db.user.deleteMany({ where: { email: 'recruiter2@test.com' } });
  console.log('deleted:', u.count);
  await db.$disconnect();
})();
