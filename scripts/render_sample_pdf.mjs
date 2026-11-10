// Render a reference-style skills-checklist PDF for visual inspection.
// Self-contained: starts its own server (Supabase DB), creates a test user +
// checklist + response, downloads the PDF, then cleans up the test records.
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) throw new Error('DATABASE_URL required')
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } })
const PORT = 3211
const BASE = `http://127.0.0.1:${PORT}`
const EMAIL = `pdf-check+${Date.now()}@example.com`
const PASS = 'Pdfcheck#1'
let server = null

function cookieOf(res) {
  const set = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')]
  return (set.filter(Boolean)[0] ?? '').split(';')[0]
}

async function main() {
  // 1) server
  server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
    cwd: '/home/z/my-project', env: { ...process.env, DATABASE_URL: DB_URL }, stdio: 'ignore', detached: true,
  })
  let ready = false
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try { const res = await fetch(BASE + '/api/templates', { headers: { cookie: 'x=1' } }); if (res.status !== 404) { ready = true; break } } catch {}
  }
  if (!ready) throw new Error('server never became ready')
  console.log('server up on', BASE)

  // 2) login (fresh throwaway user)
  const su = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, name: 'PDF Check', company: 'QA' }),
  })
  if (!su.ok) throw new Error('signup failed: ' + await su.text())
  const cookie = cookieOf(su)
  console.log('user created')

  // 3) pick a good template (Nursing | Healthcare Leadership | Leadership, else any with ≥30 skills)
  const tpls = await (await fetch(`${BASE}/api/templates`, { headers: { cookie } })).json()
  const all = tpls.templates ?? []
  const want = all.find((t) => t.profession === 'Nursing' && t.jobTitle === 'Healthcare Leadership' && t.specialty === 'Leadership')
    ?? all.find((t) => t.skillCount >= 30)
    ?? all[0]
  console.log('template:', want.profession, '|', want.jobTitle, '|', want.specialty, `(${want.skillCount} skills)`)
  const det = await (await fetch(`${BASE}/api/templates?templateId=${want.id}`, { headers: { cookie } })).json()
  const byCat = new Map()
  for (const s of det.skills) {
    if (!byCat.has(s.category)) byCat.set(s.category, [])
    byCat.get(s.category).push({ name: s.skillName, questionType: s.questionType, hasNaOption: s.hasNaOption })
  }
  const items = [...byCat.entries()].map(([category, skills]) => ({ category, skills }))

  // 4) create + submit with a realistic rating mix (1–4, N/A, last-performed spread)
  const create = await fetch(`${BASE}/api/checklists`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ title: `${want.jobTitle} — PDF Check`, templateId: want.id, candidateName: 'Jordan Rivera', candidateEmail: 'jordan.rivera@example.com' }),
  })
  const created = await create.json()
  if (!create.ok) throw new Error('create failed: ' + JSON.stringify(created))
  const id = created.checklist.id
  const token = (await (await fetch(`${BASE}/api/checklists/${id}`, { headers: { cookie } })).json()).checklist.token

  const ratings = {}, lastPerformed = {}
  let n = 0
  for (const c of items) {
    for (const s of c.skills) {
      const cycle = [4, 4, 3, 4, 3, 2, 4, 1]
      ratings[s.name] = cycle[n % cycle.length]
      lastPerformed[s.name] = ['3m', '3m', '6m', '6m+', '3m', '6m+', '6m', '6m+'][n % 8]
      n++
    }
  }
  // a couple of N/A where offered
  let naDone = 0
  for (const c of items) for (const s of c.skills) {
    if (s.hasNaOption && naDone < 2) { ratings[s.name] = 'na'; lastPerformed[s.name] = 'na'; naDone++ }
  }
  const submit = await fetch(`${BASE}/api/public/checklist/${token}/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ratings, lastPerformed,
      additional: {
        experienceYears: 6,
        answers: {
          float_units: 'yes', night_shifts: 'no', ehr_experience: 'yes', travel_assignments: 'yes',
          ehr_systems: 'Epic, Cerner, Meditech', extra_notes: 'BLS and ACLS certified; charge nurse experience on a 36-bed ICU.',
        },
      },
      candidateName: 'Jordan Rivera', signedName: 'Jordan Rivera', printedName: 'Jordan A. Rivera',
    }),
  })
  if (!submit.ok) throw new Error('submit failed: ' + await submit.text())
  console.log('submitted')

  // 5) PDF
  const pdf = await fetch(`${BASE}/api/checklists/${id}/pdf`, { headers: { cookie } })
  if (!pdf.ok) throw new Error('pdf failed: ' + (await pdf.text()).slice(0, 400))
  const buf = Buffer.from(await pdf.arrayBuffer())
  fs.writeFileSync('/tmp/out-checklist.pdf', buf)
  console.log('PDF saved:', buf.length, 'bytes')
  console.log('CHECKLIST_ID=' + id)
}

try {
  await main()
} catch (e) {
  console.error('ERROR:', e.message)
  process.exitCode = 1
} finally {
  try { if (server?.pid) process.kill(-server.pid, 'SIGKILL') } catch {}
  await db.user.deleteMany({ where: { email: EMAIL } }).catch(() => {})
  await db.$disconnect().catch(() => {})
  console.log('cleanup done (server killed, test user deleted)')
}
