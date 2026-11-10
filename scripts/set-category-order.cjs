// Fix-up: set Skill.categorySort from the natural (xlsx first-appearance) order
// per template, so checklist documents keep the source category order
// (e.g. Relationship Management → Communication → … like the reference PDF).
const { PrismaClient } = require('@prisma/client')
const XLSX = require('xlsx')
const fs = require('fs')

const db = new PrismaClient()

function main() {
  const wb = XLSX.read(fs.readFileSync('prisma/seed-skills.xlsx'), { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames.includes('Skills Data') ? 'Skills Data' : wb.SheetNames[0]]
  const raw = XLSX.utils.sheet_to_json(ws, { header: 1 })

  // (profession|jobTitle|specialty) -> category -> order index
  const order = new Map()
  for (let i = 1; i < raw.length; i++) {
    const r = raw[i]
    if (!r) continue
    const prof = (String(r[0] ?? '').trim() === 'ursing' ? 'Nursing' : String(r[0] ?? '').trim())
    const jt = String(r[1] ?? '').trim()
    const sp = String(r[2] ?? '').trim()
    const cat = String(r[3] ?? '').trim()
    if (!prof || !jt || !sp || !cat) continue
    const key = `${prof}|${jt}|${sp}`
    if (!order.has(key)) order.set(key, new Map())
    const cats = order.get(key)
    if (!cats.has(cat)) cats.set(cat, cats.size)
  }

  const templates = db.skillTemplate.findMany({ select: { id: true, profession: true, jobTitle: true, specialty: true } })
  return templates.then((ts) => {
    let pending = []
    for (const t of ts) {
      const key = `${t.profession}|${t.jobTitle}|${t.specialty}`
      const cats = order.get(key)
      if (!cats) continue
      for (const [cat, idx] of cats) {
        pending.push(db.skill.updateMany({
          where: { templateId: t.id, category: cat },
          data: { categorySort: idx },
        }))
      }
    }
    // chunk awaits to keep SQLite happy
    return (async () => {
      let n = 0
      for (const p of pending) n += (await p).count
      return n
    })()
  })
}

main()
  .then((n) => { console.log(`✅ categorySort set on ${n} skill rows`); return db.$disconnect() })
  .catch((e) => { console.error(e); process.exit(1) })
