// GSA Per Diem API (https://api.gsa.gov/travel/perdiem/v2/rates/) —
// proxied server-side so the API key never reaches the browser.
// The key is managed exclusively by the platform admin (PlatformSetting);
// recruiter accounts have no personal key override.

export type PerDiemResult = {
  lodging: number
  meals: number
  daily: number
  weekly: number
  location: string
  fiscalYear: number
}

const PD_BASE = 'https://api.gsa.gov/travel/perdiem/v2/rates/'

// GSA fiscal years run Oct 1 → Sep 30. In Oct–Dec of a calendar year the
// current fiscal year is the NEXT calendar year (e.g. Nov 2026 → FY2027);
// defaulting to the calendar year would fetch the expired table.
export function currentGsaFiscalYear(now: Date = new Date()): number {
  return now.getMonth() + 1 >= 10 ? now.getFullYear() + 1 : now.getFullYear()
}

function pickMonth(rate: { months?: { month?: { number: string; value: string }[] } }, month: number) {
  const months = rate.months?.month ?? []
  return months.find((m) => Number(m.number) === month)
}

export async function fetchPerDiem(opts: {
  apiKey: string
  city?: string
  state?: string
  zip?: string
  year: number
  month: number
}): Promise<PerDiemResult> {
  const { apiKey, city, state, zip, year, month } = opts
  if (!apiKey) throw new Error('No GSA API key configured — the platform admin must add one in the admin console (Keys & access).')
  if (!zip && (!state || state.length !== 2)) throw new Error('Enter a two-letter state abbreviation.')
  if (!city && !zip) throw new Error('Enter a city OR a ZIP code.')

  let endpoint: string
  if (zip) {
    endpoint = `zip/${encodeURIComponent(zip)}/year/${year}`
  } else {
    const cleanCity = (city ?? '').replace(/[.'’\-]/g, ' ').replace(/\s+/g, ' ').trim()
    endpoint = `city/${encodeURIComponent(cleanCity)}/state/${encodeURIComponent(state ?? '')}/year/${year}`
  }
  const url = `${PD_BASE}${endpoint}?api_key=${encodeURIComponent(apiKey)}`
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`GSA API HTTP ${resp.status} — check the API key and destination`)
  const data = await resp.json()
  if (data?.errors?.length) throw new Error(JSON.stringify(data.errors))

  // GSA returns the destination's applicable rate FIRST and the universal
  // "Standard Rate" fallback (city === 'Standard Rate') after it. Prefer the
  // county-specific row explicitly so a re-ordered response can never make us
  // quote the fallback for a county that has its own rate; when the county has
  // no specified rate only the Standard row exists and it is used.
  const rows: unknown[] = data?.rates?.[0]?.rate ?? []
  const applicable = rows.find((r) => (r as { city?: unknown })?.city !== 'Standard Rate')
  const rate = (applicable ?? rows[0]) as
    | { city?: string; state?: string; meals?: string; months?: { month?: { number: string; value: string }[] } }
    | undefined
  if (!rate) throw new Error('No Per Diem rate found for this destination/year.')

  const monthObj = pickMonth(rate, month)
  if (!monthObj) throw new Error('No lodging value found for the selected month.')

  const lodging = Number(monthObj.value) || 0
  const meals = Number(rate.meals) || 0
  const daily = lodging + meals
  const weekly = daily * 7

  // Label the tier the way gsa.gov does: county-specific locality, or the
  // universal fallback ("Standard Rate applies for all locations without
  // specified rates") shown next to the searched destination.
  const isStandard = (applicable == null) && rows.length > 0
  const place = rate.city && rate.city !== 'Standard Rate'
    ? rate.city
    : (city ?? (zip ? `ZIP ${zip}` : '—'))
  const statePart = rate.state ? `, ${rate.state}` : state ? `, ${state}` : ''
  const location = `${place}${statePart}${isStandard ? ' (Standard Rate)' : ''}`

  return { lodging, meals, daily, weekly, location, fiscalYear: year }
}
