// Check GSA per diem for Devens, MA 01434 — replicating src/lib/gsa.ts exactly.
// Never prints the API key itself.
import { PrismaClient } from '@prisma/client'

const PD_BASE = 'https://api.gsa.gov/travel/perdiem/v2/rates/'

function pickMonth(rate, month) {
  const months = rate?.months?.month ?? []
  return months.find((m) => Number(m.number) === month)
}

async function fetchPerDiem(apiKey, { city, state, zip, year, month }) {
  let endpoint
  if (zip) {
    endpoint = `zip/${encodeURIComponent(zip)}/year/${year}`
  } else {
    const cleanCity = (city ?? '').replace(/[.'’\-]/g, ' ').replace(/\s+/g, ' ').trim()
    endpoint = `city/${encodeURIComponent(cleanCity)}/state/${encodeURIComponent(state ?? '')}/year/${year}`
  }
  const url = `${PD_BASE}${endpoint}?api_key=${encodeURIComponent(apiKey)}`
  const resp = await fetch(url)
  const status = resp.status
  const data = await resp.json().catch(() => null)
  if (!resp.ok) return { status, error: `HTTP ${status}` }
  if (data?.errors?.length) return { status, error: JSON.stringify(data.errors) }
  const rate = data?.rates?.[0]?.rate?.[0]
  if (!rate) return { status, error: 'No Per Diem rate found for this destination/year.' }
  const monthObj = pickMonth(rate, month)
  if (!monthObj) return { status, error: 'No lodging value found for the selected month.' }
  const lodging = Number(monthObj.value) || 0
  const meals = Number(rate.meals) || 0
  const daily = lodging + meals
  const weekly = daily * 7
  const location = `${rate.city ?? city ?? '—'}${rate.state ? ', ' + rate.state : ''}`
  return {
    status, ok: true,
    lodging, meals, daily, weekly, location, fiscalYear: year,
    county: rate.County ?? rate.county ?? null,
    rawMonths: (rate.months?.month ?? []).map((m) => `M${m.number}: $${m.value}`).join('  '),
  }
}

const p = new PrismaClient()
const row = await p.platformSetting.findFirst()
const apiKey = row?.gsaApiKey
await p.$disconnect()

if (!apiKey) {
  console.log('NO GSA KEY CONFIGURED')
  process.exit(1)
}

// Devens, MA 01434 — calculator would send city=Devens, state=MA, zip=01434.
// FY note: Nov 2026 calendar year = 2026, but Nov 2026 sits inside GSA FY2027 (Oct 2026–Sep 2027).
const tests = [
  { label: 'ZIP 01434, FY2026, Nov', city: 'Devens', state: 'MA', zip: '01434', year: 2026, month: 11 },
  { label: 'ZIP 01434, FY2027, Nov', city: 'Devens', state: 'MA', zip: '01434', year: 2027, month: 11 },
  { label: 'City Devens MA, FY2027, Nov', city: 'Devens', state: 'MA', zip: '', year: 2027, month: 11 },
]

for (const t of tests) {
  const r = await fetchPerDiem(apiKey, t)
  console.log('==', t.label, '==')
  if (r.ok) {
    console.log(`  location: ${r.location}${r.county ? ' (county: ' + r.county + ')' : ''}`)
    console.log(`  lodging: $${r.lodging}/night   M&IE: $${r.meals}/day`)
    console.log(`  daily total: $${r.daily}/day   weekly: $${r.weekly}/week`)
    console.log(`  months detail: ${r.rawMonths}`)
  } else {
    console.log('  FAILED:', r.error)
  }
}
