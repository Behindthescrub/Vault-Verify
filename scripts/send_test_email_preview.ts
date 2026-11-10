// One-shot: send ONE real platform_test email through the new CRM frame to
// the platform owner, with the app origin set to the live deployment so the
// embedded logo + banner link resolve from a public URL.
// Run: DATABASE_URL="$(from .env)" bun scripts/send_test_email_preview.ts
import { DEFAULT_TEMPLATES, sendTemplateEmail } from '../src/lib/email-templates'
import { db } from '../src/lib/db'

const ORIGIN = process.env.SEND_ORIGIN || 'https://vault-verify.vercel.app'
const TO = process.env.SEND_TO || 'shaswatpandey0047@gmail.com'

const platform = await db.platformSetting.findUnique({ where: { id: 'main' } })
console.log('emailTestMode:', platform?.emailTestMode, '| sender:', platform?.brevoSenderEmail, '| key set:', !!platform?.brevoApiKey)

const def = DEFAULT_TEMPLATES.find((t) => t.key === 'platform_test')!
const res = await sendTemplateEmail({
  key: 'platform_test',
  to: TO,
  force: true,
  origin: ORIGIN,
  vars: {
    ...def.sampleVars,
    mode: platform?.emailTestMode ? 'TEST MODE (logged, not delivered)' : 'LIVE',
    sender_name: platform?.brevoSenderName || 'VaultVerify',
    sender_email: platform?.brevoSenderEmail || 'not set',
    template_name: def.name,
    sent_at: new Date().toLocaleString(),
    link: `${ORIGIN}/`,
  },
})
console.log('send result:', JSON.stringify(res))
await db.$disconnect()
