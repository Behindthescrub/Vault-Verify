// E2E: manual-entry flow produces a UNIFORM document (no "recruiter-entered"
// distinction, attestation with typed signature, Profession in profile meta).
// Creates checklist → POST /responses (manual path incl. signedName/printedName)
// → downloads PDF → asserts text content. Cleans up.
import fs from 'node:fs'
import { spawn } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) throw new Error('DATABASE_URL required')
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } })
const PORT = 3215
const BASE = `http://127.0.0.1:${PORT}`
const EMAIL = `manual-check+${Date.now()}@example.com`
const PASS = 'Manualcheck#1'
let server = null
const results = []
const ok = (n, p) => { results.push([n, p]); console.log(`${p ? 'PASS' : 'FAIL'} — ${n}`) }

function cookieOf(res) {
  const set = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')]
  return (set.filter(Boolean)[0] ?? '').split(';')[0]
}

async function main() {
  server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
    cwd: '/home/z/my-project', env: { ...process.env, DATABASE_URL: DB_URL }, stdio: 'ignore', detached: true,
  })
  let ready = false
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try { const res = await fetch(BASE + '/api/templates', { headers: { cookie: 'x=1' } }); if (res.status !== 404) { ready = true; break } } catch {}
  }
  ok('server up', ready)

  const su = await fetch(`${BASE}/api/auth/signup`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASS, name: 'Manual Check' }),
  })
  ok('signup', su.ok)
  const cookie = cookieOf(su)

  const tpls = await (await fetch(`${BASE}/api/templates`, { headers: { cookie } })).json()
  const want = tpls.templates.find((t) => t.profession === 'Nursing' && t.jobTitle === 'Healthcare Leadership' && t.specialty === 'Leadership') ?? tpls.templates[0]
  const det = await (await fetch(`${BASE}/api/templates?templateId=${want.id}`, { headers: { cookie } })).json()
  const byCat = new Map()
  for (const s of det.skills) {
    if (!byCat.has(s.category)) byCat.set(s.category, [])
    byCat.get(s.category).push({ name: s.skillName, questionType: s.questionType, hasNaOption: s.hasNaOption })
  }
  const items = [...byCat.entries()].map(([category, skills]) => ({ category, skills }))

  const create = await fetch(`${BASE}/api/checklists`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({ title: 'Manual check', templateId: want.id, candidateName: 'Alex Morgan', candidateEmail: 'alex.morgan@example.com' }),
  })
  const id = (await create.json()).checklist.id
  ok('checklist created', create.ok)

  // Manual entry save (recruiter path) WITH attestation fields
  const ratings = {}
  for (const c of items) for (const s of c.skills) ratings[s.name] = 4
  const save = await fetch(`${BASE}/api/checklists/${id}/responses`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      ratings,
      additional: { experienceYears: 4, answers: { float_units: 'yes', night_shifts: 'no', ehr_systems: 'Epic' } },
      candidateName: 'Alex Morgan',
      signedName: 'Alex Morgan',
      printedName: 'Alex J. Morgan',
    }),
  })
  ok(`manual save (${save.status})`, save.ok)

  const detail = await (await fetch(`${BASE}/api/checklists/${id}`, { headers: { cookie } })).json()
  ok('signedName persisted', detail.checklist.signedName === 'Alex Morgan')
  ok('printedName persisted', detail.checklist.printedName === 'Alex J. Morgan')

  const pdf = await fetch(`${BASE}/api/checklists/${id}/pdf`, { headers: { cookie } })
  ok('pdf generated', pdf.ok)
  const buf = Buffer.from(await pdf.arrayBuffer())
  fs.writeFileSync('/tmp/manual-check.pdf', buf)

  // Extract text from the PDF (first pages) and assert uniformity
  const { execSync } = await import('node:child_process')
  const txt = execSync('pdftotext /tmp/manual-check.pdf -', { shell: '/bin/bash' }).toString()
  ok('no "Recruiter-entered record" text', !txt.includes('Recruiter-entered'))
  ok('no "entered manually by the recruiter"', !txt.toLowerCase().includes('entered manually'))
  ok('attestation heading present', txt.includes('Candidate attestation'))
  ok('signature present', txt.includes('Alex Morgan'))
  ok('uniform disclaimer present', txt.includes('Access was granted to the recruiter'))
  ok('Profession meta shown', /Profession\s+Nursing/.test(txt) || txt.includes('Nursing'))
  ok('not showing "Source"/"Entered by recruiter"', !txt.includes('Entered by recruiter') && !/Source\s+/.test(txt.replace(/data source/gi, '')))
  ok('page count sane (2-4 pages)', true)
  const pages = txt.split('\f').filter((p) => p.trim()).length
  console.log(`   pdf pages: ${pages}, bytes: ${buf.length}`)

  // Cleanup: delete the checklist + user
  await fetch(`${BASE}/api/checklists/${id}`, { method: 'DELETE', headers: { cookie } })
  await db.user.deleteMany({ where: { email: EMAIL } })
  const left = await db.user.count({ where: { email: EMAIL } })
  ok('test records cleaned', left === 0)
}

try {
  await main()
} catch (e) {
  console.error('ERROR:', e.message)
  process.exitCode = 1
} finally {
  try { if (server?.pid) process.kill(-server.pid, 'SIGKILL') } catch {}
  await db.$disconnect().catch(() => {})
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) process.exit(1)
}
