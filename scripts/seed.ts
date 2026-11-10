// Seed: superadmin account + platform settings + skills data from
// prisma/seed-skills.xlsx (the MyZipVault "Skills Data" import template).
// Run: bun scripts/seed.ts
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { readFileSync } from 'fs'
import { join } from 'path'
import * as XLSX from 'xlsx'

const db = new PrismaClient()

const SUPERADMIN_EMAIL = (process.env.SUPERADMIN_EMAIL || 'admin@recruitertool.local').toLowerCase()
const SUPERADMIN_PASSWORD = process.env.SUPERADMIN_PASSWORD || 'Superadmin@123'

type SeedRow = {
  profession: string; jobTitle: string; specialty: string
  category: string; skillName: string
  questionType: string; hasNaOption: boolean
}

function parseSeedWorkbook(): SeedRow[] {
  const buf = readFileSync(join(__dirname, '..', 'prisma', 'seed-skills.xlsx'))
  const wb = XLSX.read(buf, { type: 'buffer' })
  const wsName = wb.SheetNames.includes('Skills Data') ? 'Skills Data' : wb.SheetNames[0]
  const raw: (string | number | undefined)[][] = XLSX.utils.sheet_to_json(wb.Sheets[wsName], { header: 1 })
  const rows: SeedRow[] = []
  for (let i = 1; i < raw.length; i++) {
    const row = raw[i]
    if (!row || row.every((c) => c === undefined || c === null || String(c).trim() === '')) continue
    const profession = String(row[0] ?? '').trim()
    const jobTitle = String(row[1] ?? '').trim()
    const specialty = String(row[2] ?? '').trim()
    const category = String(row[3] ?? '').trim()
    const skillName = String(row[4] ?? '').trim()
    const questionType = String(row[5] ?? '').trim()
    const hasNaOption = String(row[6] ?? '').trim().toLowerCase() === 'yes'
    if (!profession || !jobTitle || !specialty || !category || !skillName) continue
    rows.push({
      // tolerate typos in the source data
      profession: profession === 'ursing' ? 'Nursing' : profession,
      jobTitle, specialty, category, skillName,
      questionType: ['rating_1_4', 'yes_no', 'text'].includes(questionType) ? questionType : 'rating_1_4',
      hasNaOption,
    })
  }
  return rows
}

async function seedSkills() {
  const existing = await db.skillTemplate.count()
  if (existing > 0) {
    console.log(`✅ Skills data already present (${existing} templates) — skipping skills seed`)
    return
  }

  const rows = parseSeedWorkbook()
  console.log(`Importing ${rows.length} skills…`)

  // Group rows by (profession, jobTitle, specialty)
  const templates = new Map<string, SeedRow[]>()
  for (const r of rows) {
    const key = `${r.profession}\u0000${r.jobTitle}\u0000${r.specialty}`
    if (!templates.has(key)) templates.set(key, [])
    templates.get(key)!.push(r)
  }

  let tIdx = 0
  for (const [key, trows] of templates) {
    const [profession, jobTitle, specialty] = key.split('\u0000')
    const template = await db.skillTemplate.create({
      data: {
        profession,
        jobTitle,
        specialty,
        name: `${jobTitle} - ${specialty} Skill Checklist`,
        sortOrder: tIdx++,
      },
    })
    // Deduplicate skills within a template (case-insensitive)
    const seen = new Set<string>()
    const skills: { skillName: string; category: string; questionType: string; sortOrder: number; hasNaOption: boolean }[] = []
    const order = new Map<string, number>() // per-category sort order
    for (const r of trows) {
      const dedupe = `${r.category.toLowerCase()}\u0000${r.skillName.toLowerCase()}`
      if (seen.has(dedupe)) continue
      seen.add(dedupe)
      const so = (order.get(r.category) ?? -1) + 1
      order.set(r.category, so)
      skills.push({
        skillName: r.skillName,
        category: r.category,
        questionType: r.questionType,
        sortOrder: so,
        hasNaOption: r.hasNaOption,
      })
    }
    // Chunked createMany (SQLite variable limits)
    for (let i = 0; i < skills.length; i += 500) {
      await db.skill.createMany({
        data: skills.slice(i, i + 500).map((s) => ({ ...s, templateId: template.id })),
      })
    }
  }
  console.log(`✅ Skills data imported: ${templates.size} templates, ${rows.length} rows`)
}

async function main() {
  await db.platformSetting.upsert({
    where: { id: 'main' },
    create: { id: 'main' },
    update: {},
  })

  const existing = await db.user.findUnique({ where: { email: SUPERADMIN_EMAIL } })
  if (existing) {
    if (existing.role !== 'superadmin') {
      await db.user.update({ where: { id: existing.id }, data: { role: 'superadmin' } })
      console.log(`✅ Existing user ${SUPERADMIN_EMAIL} promoted to superadmin`)
    } else {
      console.log(`✅ Superadmin ${SUPERADMIN_EMAIL} already exists`)
    }
  } else {
    await db.user.create({
      data: {
        email: SUPERADMIN_EMAIL,
        passwordHash: bcrypt.hashSync(SUPERADMIN_PASSWORD, 10),
        name: 'Super Admin',
        role: 'superadmin',
        settings: { create: {} },
      },
    })
    console.log(`✅ Superadmin created: ${SUPERADMIN_EMAIL} / ${SUPERADMIN_PASSWORD}`)
    console.log('   → Log in and change the password in Superadmin → Keys & access.')
  }

  await seedSkills()
}

main()
  .catch((e) => { console.error(e); process.exit(1) })
  .finally(() => db.$disconnect())
