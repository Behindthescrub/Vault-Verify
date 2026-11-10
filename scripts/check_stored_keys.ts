// Check whether the stored platform keys are live — prints only statuses,
// never the key values themselves.
import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const s = await db.platformSetting.findUnique({ where: { id: 'main' } })
  const brevo = s?.brevoApiKey ?? ''
  const gsa = s?.gsaApiKey ?? ''
  console.log('brevo key stored:', !!brevo, '| prefix:', brevo.slice(0, 8) + '…')
  console.log('gsa   key stored:', !!gsa, '| length:', gsa.length)

  if (brevo) {
    try {
      const r = await fetch('https://api.brevo.com/v3/account', {
        headers: { 'api-key': brevo, accept: 'application/json' },
      })
      const body = await r.text()
      console.log('Brevo REST /account ->', r.status, body.slice(0, 200))
    } catch (e) {
      console.log('Brevo REST /account -> network error', e instanceof Error ? e.message : e)
    }
  }

  if (gsa) {
    try {
      const url = `https://api.gsa.gov/travel/perdiem/v2/rates/zip/10001/year/${new Date().getFullYear()}?api_key=${encodeURIComponent(gsa)}`
      const r = await fetch(url)
      console.log('GSA perdiem (zip 10001) ->', r.status, (await r.text()).slice(0, 160))
    } catch (e) {
      console.log('GSA perdiem -> network error', e instanceof Error ? e.message : e)
    }
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
