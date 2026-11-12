// Dump raw GSA ZIP-lookup row fields (no API key printed).
import { PrismaClient } from '@prisma/client'

const p = new PrismaClient()
const key = (await p.platformSetting.findFirst()).gsaApiKey
await p.$disconnect()

const resp = await fetch('https://api.gsa.gov/travel/perdiem/v2/rates/zip/01434/year/2027?api_key=' + encodeURIComponent(key))
const data = await resp.json()
const rows = (data.rates[0].rate || []).map((r) => {
  const o = {}
  for (const [k, v] of Object.entries(r)) if (k !== 'months') o[k] = typeof v === 'object' ? '(obj)' : v
  return o
})
console.log(JSON.stringify(rows, null, 1))
