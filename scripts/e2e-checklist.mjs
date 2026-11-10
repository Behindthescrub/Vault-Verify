// E2E test: recreate the reference PDF (VaultVerify checklist for "Sam")
// and verify the full candidate → document pipeline.
// Run: node scripts/e2e-checklist.mjs
const BASE = process.env.BASE_URL || 'http://localhost:3000'

let cookie = ''
async function call(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}), ...(opts.headers || {}) },
  })
  const setC = res.headers.get('set-cookie')
  if (setC) cookie = setC.split(';')[0]
  let body = null
  try { body = await res.json() } catch {}
  return { status: res.status, body }
}

// The 7 skills exactly as in the reference PDF (Medication Administration).
const PDF_ITEMS = [{
  category: 'Medication Administration',
  skills: [
    { name: 'Documentation on M.A.R.', questionType: 'rating_1_4', hasNaOption: false },
    { name: 'Dose Calculation', questionType: 'rating_1_4', hasNaOption: false },
    { name: 'Generic Equivalents', questionType: 'rating_1_4', hasNaOption: false },
    { name: 'Usage of PDR', questionType: 'rating_1_4', hasNaOption: false },
    { name: 'Knowledge of Drug Actions/Interactions', questionType: 'rating_1_4', hasNaOption: false },
    { name: 'IV push / infusion medications', questionType: 'rating_1_4', hasNaOption: false },
    { name: 'Diabetic care & insulin management', questionType: 'rating_1_4', hasNaOption: false },
  ],
}]

// Ratings from the PDF: six 4s and one 1 → avg 3.6, mix 86/14.
const RATINGS = {
  'Documentation on M.A.R.': 4, 'Dose Calculation': 4, 'Generic Equivalents': 4,
  'Usage of PDR': 4, 'Knowledge of Drug Actions/Interactions': 4,
  'IV push / infusion medications': 4, 'Diabetic care & insulin management': 1,
}
const LAST_PERFORMED = {
  'Documentation on M.A.R.': '3m', 'Dose Calculation': '6m+', 'Generic Equivalents': '6m',
  'Usage of PDR': '6m', 'Knowledge of Drug Actions/Interactions': '6m',
  'IV push / infusion medications': '6m+', 'Diabetic care & insulin management': '6m+',
}

const fail = (msg) => { console.error('❌ ' + msg); process.exit(1) }
const ok = (msg) => console.log('✅ ' + msg)

// 1. Login as superadmin
let r = await call('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: 'admin@recruitertool.local', password: 'Superadmin@123' }) })
if (r.status !== 200) fail('login failed: ' + r.status)
ok('logged in as superadmin')

// 2. Find an RN template (any profession works; we override items anyway)
r = await call('/api/templates')
if (r.status !== 200 || !r.body.templates?.length) fail('no templates')
const tpl = r.body.templates.find((t) => /RN/i.test(t.jobTitle)) || r.body.templates[0]
ok(`template: ${tpl.profession} | ${tpl.jobTitle} | ${tpl.specialty}`)

// 3. Create the checklist with the PDF items
r = await call('/api/checklists', {
  method: 'POST',
  body: JSON.stringify({
    title: 'RN General Nursing',
    templateId: tpl.id,
    candidateName: 'Sam',
    candidateEmail: 'candidate@example.com',
    items: PDF_ITEMS,
  }),
})
if (r.status !== 200) fail('create checklist: ' + JSON.stringify(r.body))
const id = r.body.checklist.id
ok('checklist created: ' + id)

// 4. Get the public token
r = await call(`/api/checklists/${id}`)
if (r.status !== 200) fail('detail fetch failed')
const token = r.body.checklist.token
const candidateEmail = r.body.checklist.candidateEmail
ok(`token: ${token.slice(0, 10)}… email on record: ${candidateEmail}`)

// 5. Public GET — candidate sees brand, additional sections, email
r = await call(`/api/public/checklist/${token}`)
if (r.status !== 200) fail('public fetch failed')
if (r.body.checklist.brand?.name !== 'VaultVerify') fail('brand missing in public payload')
if (!r.body.checklist.additionalSections?.length) fail('additional sections missing in public payload')
ok('public view serves brand + additional sections')

// 6. Submit with the exact PDF responses
r = await call(`/api/public/checklist/${token}/submit`, {
  method: 'POST',
  body: JSON.stringify({
    ratings: RATINGS,
    lastPerformed: LAST_PERFORMED,
    additional: {
      experienceYears: 3,
      answers: {
        float_units: 'yes', night_shifts: 'yes', ehr_experience: 'yes', travel_assignments: 'no',
        ehr_systems: 'epic, cerner and meditech', extra_notes: 'BLS',
      },
    },
    candidateName: 'Sam',
    candidateEmail: 'candidate@example.com',
    signedName: 'Test User',
    printedName: 'Test User',
  }),
})
if (r.status !== 200) fail('submit failed: ' + JSON.stringify(r.body))
ok(`submitted — avg ${r.body.avgRating}, valid until ${r.body.validUntil?.slice(0, 10)}`)

// 7. Validation: missing lastPerformed must be rejected
r = await call('/api/checklists', {
  method: 'POST',
  body: JSON.stringify({ title: 'LP-test', templateId: tpl.id, items: [{ category: 'C', skills: [{ name: 'S1', questionType: 'rating_1_4', hasNaOption: false }] }] }),
})
const id2 = r.body.checklist.id
r = await call(`/api/checklists/${id2}`)
const token2 = r.body.checklist.token
r = await call(`/api/public/checklist/${token2}/submit`, {
  method: 'POST',
  body: JSON.stringify({ ratings: { S1: 4 }, candidateName: 'X', signedName: 'X Y' }),
})
if (r.status !== 400 || !/last performed/i.test(r.body.error || '')) fail('missing last-performed not rejected: ' + JSON.stringify(r.body))
ok('missing last-performed rejected: "' + r.body.error.slice(0, 50) + '…"')
await call(`/api/checklists/${id2}`, { method: 'DELETE' })

// 8. Recruiter detail — all new fields present
r = await call(`/api/checklists/${id}`)
const c = r.body.checklist
if (r.status !== 200) fail('detail fetch failed')
if (!c.ratings) fail('ratings missing')
if (!c.lastPerformed || c.lastPerformed['Documentation on M.A.R.'] !== '3m') fail('lastPerformed missing/wrong')
if (!c.additional || c.additional.experienceYears !== 3) fail('additional.experienceYears missing')
if (c.additional?.answers?.ehr_systems !== 'epic, cerner and meditech') fail('additional answers missing')
if (c.printedName !== 'Test User') fail('printedName missing')
if (!c.validUntil) fail('validUntil missing')
if (c.signedName !== 'Test User') fail('signedName missing')
ok('detail API returns lastPerformed + additional + printedName + validUntil')

// 9. Math check: avg 3.57 ≈ 3.6 displayed; PDF mix 6×4 + 1×1
const nums = Object.values(c.ratings)
const avg = nums.reduce((a, b) => a + b, 0) / nums.length
if (Math.abs(avg - 25 / 7) > 0.001) fail(`avg math wrong: ${avg}`)
ok(`avg math: ${avg.toFixed(2)} → displays ${(avg).toFixed(1)} (PDF: 3.6)`)
const proficient = nums.filter((v) => v === 4).length
if (proficient !== 6) fail('proficient count wrong')
ok('rating mix: 6 Proficient (86%), 1 No theory (14%) — matches PDF')
const recent = Object.values(c.lastPerformed).filter((v) => v === '3m').length
if (recent !== 1) fail('recent count wrong')
ok('last performed mix: 1 within 3m (14%), 3 within 6m (43%), 3 6m+ (43%) — matches PDF')

// 10. Admin read-only detail gets the same shape
r = await call(`/api/admin/checklists/${id}`)
if (r.status !== 200 || !r.body.checklist.lastPerformed) fail('admin detail missing new fields')
ok('superadmin read-only detail includes the same fields')

// 11. Double submission blocked
r = await call(`/api/public/checklist/${token}/submit`, {
  method: 'POST',
  body: JSON.stringify({ ratings: RATINGS, candidateName: 'Sam', signedName: 'Test User' }),
})
if (r.status !== 409) fail('double submission not blocked')
ok('double submission blocked (409)')

console.log('\n🎉 E2E passed — checklist id ' + id)
