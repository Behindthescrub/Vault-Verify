// List Brevo senders for the stored key and try a real end-to-end test send
// as VaultVerify <myzipvault@gmail.com>. Prints statuses only, never keys.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const s = await db.platformSetting.findUnique({ where: { id: 'main' } })
  const brevo = s?.brevoApiKey ?? ''

  const r = await fetch('https://api.brevo.com/v3/senders?limit=100', {
    headers: { 'api-key': brevo, accept: 'application/json' },
  })
  console.log('GET /v3/senders ->', r.status)
  const body = await r.json().catch(() => ({}))
  const senders = (body?.senders ?? []) as { email: string; name?: string; active?: boolean }[]
  for (const s of senders) {
    console.log(`  sender: ${s.email} | name: ${s.name ?? '—'} | active: ${s.active}`)
  }

  const target = senders.find((x) => x.email.toLowerCase() === 'myzipvault@gmail.com')
  if (!target) {
    console.log('myzipvault@gmail.com NOT among senders — attempting to create it…')
    const add = await fetch('https://api.brevo.com/v3/senders', {
      method: 'POST',
      headers: { 'api-key': brevo, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({ name: 'VaultVerify', email: 'myzipvault@gmail.com' }),
    })
    console.log('POST /v3/senders ->', add.status, (await add.text()).slice(0, 300))
  } else {
    console.log('myzipvault@gmail.com found — sending one test email…')
    const send = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': brevo, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: 'myzipvault@gmail.com', name: 'VaultVerify' },
        to: [{ email: 'myzipvault@gmail.com', name: 'VaultVerify' }],
        subject: 'VaultVerify — test email from your Recruiter tool',
        htmlContent: '<div style="font-family:Arial,sans-serif"><h3>VaultVerify</h3><p>This is a live test send. If you can read this, transactional email works.</p></div>',
      }),
    })
    console.log('POST /v3/smtp/email ->', send.status, (await send.text()).slice(0, 300))
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
