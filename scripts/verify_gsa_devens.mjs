// E2E: GSA per-diem for Devens, MA 01434 through the live app endpoint.
// Self-contained: creates a short-lived session for an existing recruiter,
// boots `next start`, hits /api/calculator/gsa, then cleans up.
import { PrismaClient } from '@prisma/client'
import { randomBytes } from 'crypto'
import { spawn } from 'child_process'

const DB_URL = 'postgresql://postgres.tjjquvynogdqrehsspwg:Shaswat%400047@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=require'
const PORT = 3117
const BASE = `http://127.0.0.1:${PORT}`

const prisma = new PrismaClient()
let server = null
let token = null

async function waitForServer(timeoutMs = 90000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${BASE}/api/auth/me`, { headers: { cookie: 'x=x' } })
      if (r.status === 401 || r.ok) return true // route answered
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  return false
}

async function callGsa(qs) {
  const r = await fetch(`${BASE}/api/calculator/gsa?${qs}`, {
    headers: { cookie: `rt_session=${token}` },
  })
  const body = await r.json().catch(() => ({}))
  return { status: r.status, body }
}

function check(label, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'} — ${label}${detail ? '  [' + detail + ']' : ''}`)
  if (!cond) process.exitCode = 1
}

try {
  // 1. session for an existing recruiter account
  const user = await prisma.user.findFirst({ where: { email: 'david@medstalent.com' } })
  if (!user) throw new Error('recruiter test user not found')
  token = randomBytes(24).toString('hex')
  await prisma.session.create({
    data: { token, userId: user.id, expiresAt: new Date(Date.now() + 3600_000) },
  })

  // 2. boot server from the fresh production build
  server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: process.cwd(),
    env: { ...process.env, DATABASE_URL: DB_URL, NODE_ENV: 'production' },
    stdio: 'ignore',
  })
  if (!(await waitForServer())) throw new Error('server did not start')

  // 3. no year param → server falls back to the CURRENT GSA fiscal year (FY2027 in Nov 2026)
  const a = await callGsa('city=Devens&state=MA&zip=01434&month=11')
  check('endpoint 200 with no year', a.status === 200, `status=${a.status}`)
  const pd = a.body?.perDiem
  check('FY fallback = 2027 (Nov 2026 is FY2027)', pd?.fiscalYear === 2027, `got ${pd?.fiscalYear}`)
  check('lodging $140/night', pd?.lodging === 140, `got ${pd?.lodging}`)
  check('M&IE $80/day', pd?.meals === 80, `got ${pd?.meals}`)
  check('daily $220/day', pd?.daily === 220, `got ${pd?.daily}`)
  check('weekly $1,540/week', pd?.weekly === 1540, `got ${pd?.weekly}`)
  check('location Worcester, MA', /Worcester/.test(pd?.location ?? ''), `got ${pd?.location}`)

  // 4. explicit year=2026 (expired FY) still honored when the user asks
  const b = await callGsa('city=Devens&state=MA&zip=01434&month=11&year=2026')
  const pd2 = b.body?.perDiem
  check('explicit FY2026 honored: $135/$80/$215/$1,505',
    pd2?.lodging === 135 && pd2?.meals === 80 && pd2?.daily === 215 && pd2?.weekly === 1505,
    `got ${pd2?.lodging}/${pd2?.meals}/${pd2?.daily}/${pd2?.weekly}`)

  // 5. city-only path (no zip) — GSA fuzzy-matches, must not 500
  const c = await callGsa('city=Devens&state=MA&month=11&year=2027')
  check('city-only path returns 200 (GSA locality match)', c.status === 200, `status=${c.status} loc=${c.body?.perDiem?.location}`)

  // 6. Standard-Rate tier: ZIP 01301 (Greenfield, Franklin County — no specified rate)
  const d = await callGsa('city=Greenfield&state=MA&zip=01301&month=11&year=2027')
  const pd3 = d.body?.perDiem
  check('standard-rate county uses Standard Rate $113/$68/$181/$1,267',
    pd3?.lodging === 113 && pd3?.meals === 68 && pd3?.daily === 181 && pd3?.weekly === 1267,
    `got ${pd3?.lodging}/${pd3?.meals}/${pd3?.daily}/${pd3?.weekly}`)
  check('standard-rate location labeled', /Standard Rate/.test(pd3?.location ?? ''), `got ${pd3?.location}`)

  console.log('\nPer Diem for Devens, MA 01434 (Worcester County):')
  console.log(`  FY2027 (current): lodging $${pd.lodging}/night + M&IE $${pd.meals}/day = $${pd.daily}/day = $${pd.weekly}/week`)
  console.log(`  FY2026 (expired): lodging $${pd2.lodging}/night + M&IE $${pd2.meals}/day = $${pd2.daily}/day = $${pd2.weekly}/week`)
  console.log(`  Standard-Rate comparison (Greenfield 01301): $${pd3.lodging} + $${pd3.meals} = $${pd3.daily}/day = $${pd3.weekly}/week — ${pd3.location}`)
} catch (e) {
  console.error('SCRIPT ERROR:', e.message)
  process.exitCode = 1
} finally {
  if (server) server.kill('SIGKILL')
  try { if (token) await prisma.session.deleteMany({ where: { token } }) } catch {}
  await prisma.$disconnect()
}
