// Set the VaultVerify sender identity on the existing PlatformSetting row.
// The stored xkeysib- key was verified live end-to-end (senders list + real
// send 201), so test mode is turned OFF — sends are real now.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  await db.platformSetting.upsert({
    where: { id: 'main' },
    create: {
      id: 'main',
      brevoSenderName: 'VaultVerify',
      brevoSenderEmail: 'myzipvault@gmail.com',
      emailTestMode: false,
    },
    update: {
      brevoSenderName: 'VaultVerify',
      brevoSenderEmail: 'myzipvault@gmail.com',
      emailTestMode: false,
    },
  })
  const s = await db.platformSetting.findUnique({ where: { id: 'main' } })
  console.log({
    id: s?.id,
    senderName: s?.brevoSenderName,
    senderEmail: s?.brevoSenderEmail,
    apiKeySet: !!s?.brevoApiKey, // expected: false — invalid key not stored
    emailTestMode: s?.emailTestMode,
    gsaApiKeySet: !!s?.gsaApiKey,
  })
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
