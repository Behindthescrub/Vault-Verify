// One-shot: render every default template through the REAL send pipeline
// (renderTemplate + buildEmailFrame) into public/email-preview/*.html so the
// new CRM frame can be verified in a browser.
// Run: DATABASE_URL="$(from .env)" bun scripts/gen_email_previews.ts
// Delete public/email-preview before shipping (verification artifact only).
import { mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { DEFAULT_TEMPLATES } from '../src/lib/email-templates'
import { buildEmailFrame } from '../src/lib/email-frame'
import { renderTemplate } from '../src/lib/template-render'

const out = 'public/email-preview'
rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })

for (const def of DEFAULT_TEMPLATES) {
  const vars: Record<string, string> = {
    ...def.sampleVars,
    mode: 'LIVE',
    sent_at: new Date().toLocaleString(),
    link: def.sampleVars.link || 'https://vaultverify.app/',
  }
  const content = renderTemplate(def.bodyHtml, vars, ['personal_message'])
  const html = buildEmailFrame(content, {
    logoUrl: '/vaultverify-logo.png',
    appUrl: 'https://vaultverify.app/',
    senderName: vars.sender_name || 'VaultVerify',
    validDays: '30',
    preheader: renderTemplate(def.preheader, vars),
  })
  writeFileSync(`${out}/${def.key}.html`, html)
  console.log('wrote', def.key, html.length, 'bytes')
}
console.log('done → public/email-preview/')
