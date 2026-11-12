// Inspect raw GSA API responses to see which rows come back for ZIP lookups:
// - 01434 (Devens → Worcester County, has a specified rate)
// - a county with NO specified rate (falls to Standard Rate)
// Never prints the API key.
import { PrismaClient } from '@prisma/client'

const PD_BASE = 'https://api.gsa.gov/travel/perdiem/v2/rates/'

const p = new PrismaClient()
const row = await p.platformSetting.findFirst()
const key = row?.gsaApiKey
await p.$disconnect()
if (!key) { console.log('NO KEY'); process.exit(1) }

async function show(label, endpoint) {
  const resp = await fetch(`${PD_BASE}${endpoint}?api_key=${encodeURIComponent(key)}`)
  const data = await resp.json().catch(() => null)
  console.log(`\n== ${label} ==  HTTP ${resp.status}`)
  const rates = data?.rates ?? []
  for (const r of rates) {
    for (const rate of r.rate ?? []) {
      const m11 = (rate.months?.month ?? []).find((m) => Number(m.number) === 11)
      console.log(`  row: City="${rate.City}" County="${rate.County}" State="${rate.State}" meals=$${rate.meals} Nov-lodging=$${m11?.value}`)
    }
  }
}

// Worcester-spec ZIP
await show('ZIP 01434 (Devens, Worcester County)', 'zip/01434/year/2027')
// Franklin County MA (Greenfield) — typically NO specified rate → Standard
await show('ZIP 01301 (Greenfield, Franklin County)', 'zip/01301/year/2027')
// State-wide MA view (what the website shows: Standard + all specified counties)
await show('State MA (all rows)', 'state/MA/year/2027')
