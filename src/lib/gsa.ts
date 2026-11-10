// GSA Per Diem API (https://api.gsa.gov/travel/perdiem/v2/rates/) —
// proxied server-side so the API key never reaches the browser.
// The key is managed in the superadmin panel; users may set a personal
// override in their own settings.

export type PerDiemResult = {
  lodging: number
  meals: number
  daily: number
  weekly: number
  location: string
  fiscalYear: number
}

const PD_BASE = 'https://api.gsa.gov/travel/perdiem/v2/rates/'

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
  if (!apiKey) throw new Error('No GSA API key configured. Add one in Superadmin → Platform, or in your own Settings.')
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

  const rate = data?.rates?.[0]?.rate?.[0]
  if (!rate) throw new Error('No Per Diem rate found for this destination/year.')

  const monthObj = pickMonth(rate, month)
  if (!monthObj) throw new Error('No lodging value found for the selected month.')

  const lodging = Number(monthObj.value) || 0
  const meals = Number(rate.meals) || 0
  const daily = lodging + meals
  const weekly = daily * 7
  const location = `${rate.city ?? city ?? '—'}${rate.state ? ', ' + rate.state : ''}`

  return { lodging, meals, daily, weekly, location, fiscalYear: year }
}
