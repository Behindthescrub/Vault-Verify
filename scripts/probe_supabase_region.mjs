// Probe which Supabase pooler region hosts project REF (env: SUPA_REF, SUPA_PW).
// No secrets in this file — credentials come from env vars.
const REF = process.env.SUPA_REF
const PW = process.env.SUPA_PW
if (!REF || !PW) { console.error('Need SUPA_REF and SUPA_PW env'); process.exit(1) }
const enc = encodeURIComponent(PW)

// Ordered by likelihood for an IST-timezone user, then worldwide.
const REGIONS = [
  'ap-south-1', 'ap-southeast-1', 'ap-northeast-1', 'ap-southeast-2',
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-west-3', 'eu-central-1', 'eu-north-1',
  'ca-central-1', 'sa-east-1',
]

for (const r of REGIONS) {
  const url = `postgresql://postgres.${REF}:${enc}@aws-0-${r}.pooler.supabase.com:5432/postgres`
  let sql
  try {
    sql = new Bun.sql(url, { ssl: 'require', idleTimeout: 5, max: 1 })
    const res = await sql`select current_database() as db, version() as v`
    console.log(`REGION_MATCH=${r} db=${res[0]?.db}`)
    await sql.end()
    process.exit(0)
  } catch (e) {
    const msg = String((e && e.message) || e).slice(0, 100).replace(/\s+/g, ' ')
    console.log(`no: aws-0-${r} — ${msg}`)
    try { await sql?.end() } catch {}
  }
}
console.log('REGION_MATCH=none')
process.exit(2)
