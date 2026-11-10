// E2E: recreate the reference scenario (VaultVerify "sswws" Healthcare Leadership
// checklist) and render both the on-screen document and the server-side PDF.
import fs from 'fs'
const BASE = 'http://localhost:3000'
const TEMPLATE_ID = 'cmwatma3i0ca1nebzyvpvj226' // Nursing | Healthcare Leadership | Leadership (38 skills)

function cookieOf(res) {
  const set = res.headers.getSetCookie?.() ?? [res.headers.get('set-cookie')]
  const raw = (set.filter(Boolean)[0] ?? '').split(';')[0]
  return raw
}

async function main() {
  // 1. login recruiter
  const login = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e@test.com', password: 'E2epass@123' }),
  })
  if (login.status === 401) {
    const su = await fetch(`${BASE}/api/auth/signup`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'e2e@test.com', password: 'E2epass@123', name: 'E2E Tester', company: 'E2E Co' }),
    })
    if (!su.ok) throw new Error('signup failed: ' + await su.text())
  }
  const relogin = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'e2e@test.com', password: 'E2epass@123' }),
  })
  if (!relogin.ok) throw new Error('login failed: ' + await relogin.text())
  const cookie = cookieOf(relogin)
  console.log('1. recruiter logged in')

  // 2. fetch template snapshot (authenticated, ?templateId= returns skills grouped)
  const tplDetail = await fetch(`${BASE}/api/templates?templateId=${TEMPLATE_ID}`, { headers: { cookie } })
  const detail = await tplDetail.json()
  const skills = detail.skills ?? []
  if (skills.length === 0) throw new Error('no skills: ' + JSON.stringify(detail).slice(0, 300))
  const byCat = new Map()
  for (const s of skills) {
    if (!byCat.has(s.category)) byCat.set(s.category, [])
    byCat.get(s.category).push({ name: s.skillName, questionType: s.questionType, hasNaOption: s.hasNaOption })
  }
  const items = [...byCat.entries()].map(([category, list]) => ({ category, skills: list }))
  console.log('2. template loaded:', items.length, 'categories,', skills.length, 'skills')

  // 3. create checklist
  const create = await fetch(`${BASE}/api/checklists`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', cookie },
    body: JSON.stringify({
      title: 'Healthcare Leadership Skill Checklist',
      templateId: TEMPLATE_ID,
      candidateName: 'sswws',
      candidateEmail: 'candidate@example.com',
    }),
  })
  const created = await create.json()
  if (!create.ok) throw new Error('create failed: ' + JSON.stringify(created))
  const checklistId = created.checklist.id
  // token comes from the detail endpoint
  const det0 = await fetch(`${BASE}/api/checklists/${checklistId}`, { headers: { cookie } })
  const det0Json = await det0.json()
  const token = det0Json.checklist?.token
  console.log('3. checklist created:', checklistId, 'token:', token)

  // 4. submit as the candidate, reproducing the reference mix:
  //    avg 3.4, 25 proficient / 6 experienced / 6 limited / 1 no-theory,
  //    6 skills recent (within 3 months), rest 6+ months ago.
  const ratings = {}
  const lastPerformed = {}
  const flat = []
  for (const c of items) for (const s of c.skills) flat.push(s)
  // Reference pattern: Relationship Management gets 4,3,4,3,4,4 (first 6 recent)
  // Communication gets 1,2,2,2,2,2 ; Leadership & People Dev 2,3,4,3,3,4,4,4 ;
  // Strategic Planning 4,4,3,4 ; Professional Development all 4 ;
  // Business & Quality Knowledge all 4 with 1 recent.
  let i = 0
  for (const c of items) {
    for (const s of c.skills) {
      const cat = c.category
      let v = 4
      let lp = '6m+'
      if (cat === 'Relationship Management') {
        v = [4, 3, 4, 3, 4, 4][Math.min(i, 5)]
        lp = i < 6 ? '3m' : '6m+'
      } else if (cat === 'Communication') {
        v = i === 0 ? 1 : 2
      } else if (cat === 'Leadership & People Development') {
        v = [2, 3, 4, 3, 3, 4, 4, 4][Math.min(i, 7)]
      } else if (cat === 'Strategic Planning') {
        v = [4, 4, 3, 4][Math.min(i, 3)]
      }
      if (cat === 'Business & Quality Knowledge' && i === 7) lp = '3m'
      ratings[s.name] = v
      lastPerformed[s.name] = lp
      i++
    }
    i = 0
  }
  const submit = await fetch(`${BASE}/api/public/checklist/${token}/submit`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ratings,
      lastPerformed,
      additional: {
        experienceYears: 3,
        answers: {
          float_units: 'yes', night_shifts: 'yes', ehr_experience: 'yes', travel_assignments: 'yes',
          ehr_systems: 'EPIC', extra_notes: 'BLS',
        },
      },
      candidateName: 'sswws',
      signedName: 'sswws',
      printedName: 'sswws',
    }),
  })
  const submitted = await submit.json()
  if (!submit.ok) throw new Error('submit failed: ' + JSON.stringify(submitted))
  console.log('4. submitted — avg:', submitted.response?.avgRating ?? submitted.checklist?.avgRating ?? JSON.stringify(submitted).slice(0, 200))

  // 5. verify detail JSON
  const det = await fetch(`${BASE}/api/checklists/${checklistId}`, { headers: { cookie } })
  const detJson = await det.json()
  console.log('5. detail status:', detJson.checklist?.status, '| avg:', detJson.checklist?.avgRating,
    '| skills:', detJson.checklist?.items?.reduce((n, c) => n + c.skills.length, 0))

  // 6. download the PDF
  const pdf = await fetch(`${BASE}/api/checklists/${checklistId}/pdf`, { headers: { cookie } })
  if (!pdf.ok) throw new Error('pdf failed: ' + (await pdf.text()).slice(0, 300))
  const buf = Buffer.from(await pdf.arrayBuffer())
  fs.writeFileSync('/tmp/out-checklist.pdf', buf)
  console.log('6. PDF saved:', buf.length, 'bytes | disposition:', pdf.headers.get('content-disposition'))
  console.log('CHECKLIST_ID=' + checklistId)
}

main().catch((e) => { console.error('E2E ERROR:', e.message); process.exit(1) })
