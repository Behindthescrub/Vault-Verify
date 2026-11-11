// Verification: superadmin is reachable ONLY via /console
// 1) No "/console" string anywhere in the CLIENT bundle (recruiter UI cannot link to it).
// 2) POST /api/auth/login with a superadmin account -> 401 (blocked).
// 3) POST /api/auth/admin-login with the same account -> 200 (console works).
// 4) POST /api/auth/login with a regular recruiter -> 200 (normal users unaffected).
// 5) POST /api/auth/admin-login with a regular recruiter -> 401 (console rejects non-admins).
// Uses throwaway accounts, deleted at the end. Self-contained: starts/stops its own server.
import { execSync, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, existsSync } from 'node:fs'
import bcrypt from 'bcryptjs'
import { PrismaClient } from '@prisma/client'

const DB_URL = process.env.DATABASE_URL
if (!DB_URL) throw new Error('DATABASE_URL required')
const db = new PrismaClient({ datasources: { db: { url: DB_URL } } })
const PORT = 3199
const BASE = `http://127.0.0.1:${PORT}`
const ts = Date.now()
const adminEmail = `vv-verify-admin+${ts}@example.com`
const recEmail = `vv-verify-rec+${ts}@example.com`
const adminPass = 'VerifyAdmin#1'
const recPass = 'VerifyRec#1'
const results = []
let server = null

const ok = (name, pass) => { results.push([name, pass]); console.log(`${pass ? 'PASS' : 'FAIL'} — ${name}`) }

async function post(path, body) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  let json = null
  try { json = await res.json() } catch {}
  return { status: res.status, json, setCookie: res.headers.get('set-cookie') || '' }
}

async function main() {
  // ── 1) client bundle grep ────────────────────────────────────────────
  const hits = []
  execSync(`grep -rl '/console' /home/z/my-project/.next/static/chunks/ 2>/dev/null || true`, { shell: '/bin/bash' })
  const files = execSync('ls /home/z/my-project/.next/static/chunks/ 2>/dev/null || true', { shell: '/bin/bash' }).toString().trim().split('\n').filter(Boolean)
  for (const f of files) {
    const p = `/home/z/my-project/.next/static/chunks/${f}`
    if (!existsSync(p)) continue
    if (readFileSync(p, 'utf8').includes('"/console"') || readFileSync(p, 'utf8').includes("'/console'") || readFileSync(p, 'utf8').includes('href:"/console"')) hits.push(f)
  }
  ok('client bundle contains no /console link', hits.length === 0)

  // ── throwaway accounts ──────────────────────────────────────────────
  await db.user.create({
    data: { email: adminEmail, passwordHash: bcrypt.hashSync(adminPass, 10), name: 'Verify Admin', role: 'superadmin', settings: { create: {} } },
  })
  await db.user.create({
    data: { email: recEmail, passwordHash: bcrypt.hashSync(recPass, 10), name: 'Verify Recruiter', role: 'user', settings: { create: {} } },
  })
  ok('throwaway accounts created', true)

  // ── start server (single script owns the whole lifecycle) ───────────
  server = spawn('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(PORT)], {
    cwd: '/home/z/my-project', env: { ...process.env, DATABASE_URL: DB_URL, PORT: String(PORT) }, stdio: 'ignore', detached: true,
  })
  let ready = false
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 1000))
    try { const res = await fetch(BASE + '/api/auth/me', { headers: { cookie: 'x=1' } }); if (res.status !== 404) { ready = true; break } } catch {}
  }
  ok(`server up on :${PORT}`, ready)
  if (!ready) throw new Error('server never became ready')

  // ── auth rule tests ─────────────────────────────────────────────────
  const a = await post('/api/auth/login', { email: adminEmail, password: adminPass })
  ok(`main login rejects superadmin (401) [got ${a.status}]`, a.status === 401)
  ok('main login rejection message is generic (no role hint)', !JSON.stringify(a.json || {}).toLowerCase().includes('admin'))

  const b = await post('/api/auth/admin-login', { username: adminEmail, password: adminPass })
  ok(`console login accepts superadmin (200) [got ${b.status}]`, b.status === 200 && b.json?.user?.role === 'superadmin')
  ok('console login sets a session cookie', /rt_session=/.test(b.setCookie))

  const c = await post('/api/auth/login', { email: recEmail, password: recPass })
  ok(`main login accepts regular recruiter (200) [got ${c.status}]`, c.status === 200 && c.json?.user?.role === 'user')

  const d = await post('/api/auth/admin-login', { username: recEmail, password: recPass })
  ok(`console login rejects regular recruiter (401) [got ${d.status}]`, d.status === 401)

  // wrong password on main login still 401 for recruiter (sanity)
  const e = await post('/api/auth/login', { email: recEmail, password: 'wrong-password' })
  ok('main login rejects wrong password (401)', e.status === 401)

  // ── cleanup: delete throwaway users (sessions cascade) ──────────────
  await db.user.deleteMany({ where: { email: { in: [adminEmail, recEmail] } } })
  const left = await db.user.count({ where: { email: { in: [adminEmail, recEmail] } } })
  ok('throwaway accounts deleted', left === 0)
}

try {
  await main()
} finally {
  try { if (server?.pid) process.kill(-server.pid, 'SIGKILL') } catch {}
  await db.$disconnect().catch(() => {})
  const failed = results.filter((r) => !r[1])
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) { console.log('FAILED: ' + failed.map((f) => f[0]).join(' | ')); process.exit(1) }
}
