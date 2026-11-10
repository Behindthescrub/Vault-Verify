# One-shot scrub: remove provider names / personal identifiers from ALL
# user-visible UI text + neutralize personal data in committed scripts & docs.
# Every replacement is asserted (exact count) — the script fails loudly.
import sys
from pathlib import Path

ROOT = Path('/home/z/my-project')

def job(rel, pairs):
    p = ROOT / rel
    s = p.read_text(encoding='utf-8')
    applied = 0
    for old, new, cnt in pairs:
        found = s.count(old)
        if found == 0 and s.count(new) >= 1 and new != old:
            continue  # already applied by an earlier partial pass
        if found != cnt:
            print(f'FAIL {rel}: expected {cnt}, found {found} for: {old[:80]!r}')
            sys.exit(1)
        s = s.replace(old, new)
        applied += 1
    p.write_text(s, encoding='utf-8')
    print(f'OK   {rel} ({applied} edits, {len(pairs) - applied} already applied)')

# ─────────────────────────────────────────────────────────────────────
# 1) email-panel.tsx — every visible "Brevo" → neutral provider wording
job('src/components/admin/email-panel.tsx', [
    ('// Superadmin → Email: Brevo transactional settings, the full branded SMTP',
     '// Admin console → Email: provider transactional settings, the full branded', 1),
    ('  // form state — Brevo settings', '  // form state — email provider settings', 1),
    ('  // test email (Brevo settings card)', '  // test email (email settings card)', 1),
    ('// Live preview: sample vars + the CURRENT Brevo sender identity.',
     '// Live preview: sample vars + the CURRENT sender identity.', 1),
    ('<Mail className="w-4 h-4 text-[#1F7A44]" /> Brevo transactional email',
     '<Mail className="w-4 h-4 text-[#1F7A44]" /> Transactional email', 1),
    ('''            All templates below are delivered through Brevo. Generate an <strong>API v3 key</strong> (starts with <code>xkeysib-</code>) at
            <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" className="text-[#1F7A44] font-bold ml-1">app.brevo.com → SMTP &amp; API → API keys</a>.
            SMTP keys (<code>xsmtpsib-…</code>) only work on the SMTP relay, not with this API — the REST endpoint is what the app uses (it also works on Vercel serverless).''',
     '''            All templates below are delivered through the platform's transactional email provider. Generate an <strong>API v3 key</strong> with your provider (the REST API key — SMTP-only keys are not used) and paste it below.''', 1),
    ('>Brevo API key</Label>', '>Email provider API key</Label>', 1),
    (": 'xkeysib-…'} className", ": 'API key…'} className", 1),
    ('placeholder="myzipvault@gmail.com" className="h-11 mt-1.5"', 'placeholder="noreply@yourdomain.com" className="h-11 mt-1.5"', 1),
    ('Must be added &amp; verified as a sender in Brevo (Senders &amp; IP). Stamps every template footer.',
     'Must be added &amp; verified as a sender with your email provider. Stamps every template footer.', 1),
    ('Save Brevo settings', 'Save email settings', 1),
    ("setSaveMsg('Brevo settings saved.')", "setSaveMsg('Email settings saved.')", 1),
    ('''            <strong>sent</strong> = accepted by Brevo’s API (their messageId shown) — not a delivery guarantee. Actual delivery shows in{' '}
            <a href="https://app.brevo.com/transactional" target="_blank" rel="noreferrer" className="font-bold underline">Brevo → Transactional → Events</a>.''',
     '''            <strong>sent</strong> = accepted by the provider’s API (message id shown) — not a delivery guarantee. Actual delivery shows in your email provider’s delivery log.''', 1),
    (": 'This template is sent on demand (recruiter/superadmin action), so it always fires.'}",
     ": 'This template is sent on demand (recruiter/admin action), so it always fires.'}", 1),
    ('// ─── Connected Brevo account strip', '// ─── Connected email account strip', 1),
    ('// Live truth from the Brevo API: which account the saved key belongs to',
     "// Live truth from the provider's API: which account the saved key belongs to", 1),
    ("? 'No Brevo API key saved yet — every send stays in test mode (logged, never delivered).'",
     "? 'No email provider API key saved yet — every send stays in test mode (logged, never delivered).'", 1),
    (": `Brevo rejected the saved key: ${status.error ?? 'unknown error'} — paste a valid xkeysib-… key below and save.`}",
     ": `The email provider rejected the saved key: ${status.error ?? 'unknown error'} — paste a valid API key below and save.`}", 1),
    ('title="Re-check Brevo"', 'title="Re-check status"', 1),
    ('Connected Brevo account:', 'Connected email account:', 1),
    ('title="Re-check the Brevo account"', 'title="Re-check the email account"', 1),
    ('''          Free plan: sends draw from a <strong>300/day quota that resets every 24h</strong> — there is no prepaid credit balance to deduct.
          To see usage, log into Brevo with <strong>{a.email}</strong> (not another Brevo login) and check <strong>Transactional → Real-time</strong>.''',
     '''          Free plan: sends draw from a <strong>daily quota that resets every 24h</strong> — there is no prepaid credit balance to deduct.
          To see usage, log into the email provider with <strong>{a.email}</strong> (the account that owns the key) and check its usage dashboard.''', 1),
    ('''          <strong className="text-[#334155]">Accepted ≠ delivered.</strong> A <strong>sent</strong> row (with a Brevo id) means Brevo’s API <em>accepted</em> the email — final delivery shows in{' '}
          <a href="https://app.brevo.com/transactional" target="_blank" rel="noreferrer" className="font-bold underline">Brevo → Transactional → Events</a>.
          If nothing arrives <strong>and no credits are used</strong>, look for <strong>“Your sending platform is currently disabled”</strong> there — that account’s transactional platform needs an{' '}
          <a href="https://help.brevo.com/hc/en-us/requests/new" target="_blank" rel="noreferrer" className="font-bold underline">activation ticket from Brevo support</a>; every send is silently dropped until Brevo enables it.''',
     '''          <strong className="text-[#334155]">Accepted ≠ delivered.</strong> A <strong>sent</strong> row (with a provider id) means the provider’s API <em>accepted</em> the email — final delivery shows in their delivery log.
          If nothing arrives <strong>and no quota is used</strong>, look for a <strong>“sending platform disabled”</strong> status there — that account’s transactional sending needs to be reactivated by the provider’s support; every send is silently dropped until then.''', 1),
    ('is verified &amp; active on this account — Brevo accepts emails from it.',
     'is verified &amp; active on this account — the provider accepts emails from it.', 1),
    (''' —{' '}
              <a href="https://app.brevo.com/senders" target="_blank" rel="noreferrer" className="font-bold underline">add &amp; verify it in Brevo</a> or sends will be rejected.''',
     ''' — add &amp; verify it with your email provider or sends will be rejected.''', 1),
    ('''            <strong>Deliverability warning:</strong> {status.senderDomain} is a free-mail domain. Brevo cannot publish SPF/DKIM records for it, so inbox providers often sort these emails into <strong>spam</strong>.
            For reliable delivery, verify a sender on a domain you own{suggestDomain ? <> (e.g. <code className="bg-white border border-[#F3D9A4] rounded px-1 py-0.5">no-reply@{suggestDomain}</code>)</> : null} in Brevo with its SPF/DKIM records, then switch the sender above. Until then, check the spam folder when testing.''',
     '''            <strong>Deliverability warning:</strong> {status.senderDomain} is a free-mail domain. Your email provider cannot publish SPF/DKIM records for it, so inbox providers often sort these emails into <strong>spam</strong>.
            For reliable delivery, verify a sender on a domain you own{suggestDomain ? <> (e.g. <code className="bg-white border border-[#F3D9A4] rounded px-1 py-0.5">no-reply@{suggestDomain}</code>)</> : null} with its SPF/DKIM records, then switch the sender above. Until then, check the spam folder when testing.''', 1),
])

# ─────────────────────────────────────────────────────────────────────
# 2) Admin console chrome + role chips
job('src/components/admin-view.tsx', [
    ('// Superadmin shell — one account owns all platform data:',
     '// Admin console shell — one account owns all platform data:', 1),
    ('<ShieldCheck className="w-6 h-6 text-[#1F7A44]" /> Superadmin',
     '<ShieldCheck className="w-6 h-6 text-[#1F7A44]" /> Admin console', 1),
    ('Platform-wide data &amp; configuration — skills library, every checklist, account, session and calculator run on Recruiter tool.',
     'Platform-wide data &amp; configuration — skills library, every checklist, account, session and calculator run on the platform.', 1),
])
job('src/components/admin/users-panel.tsx', [
    ("// Superadmin → Users & auth: all accounts, active sessions (auth data),",
     "// Admin console → Users & auth: all accounts, active sessions (auth data),", 1),
    ("{u.role === 'superadmin' ? 'superadmin' : u.company || 'no company'}",
     "{u.role === 'superadmin' ? 'platform admin' : u.company || 'no company'}", 1),
])
job('src/components/settings-view.tsx', [
    ("{user.role === 'superadmin' ? 'Superadmin' : 'Recruiter'}",
     "{user.role === 'superadmin' ? 'Platform admin' : 'Recruiter'}", 1),
])
job('src/components/admin/keys-panel.tsx', [
    ('// Superadmin → Keys & access: shared GSA Per Diem API key + superadmin credentials.',
     '// Admin console → Keys & access: shared GSA Per Diem API key + administrator credentials.', 1),
    ('/> Superadmin credentials', '/> Administrator credentials', 1),
])
job('src/components/admin/overview-panel.tsx', [
    ('// Superadmin → Overview: platform usage stats + recent activity.',
     '// Admin console → Overview: platform usage stats + recent activity.', 1),
])
job('src/components/admin/checklists-panel.tsx', [
    ('// Superadmin → Skill checklist data: every checklist + candidate responses',
     '// Admin console → Skill checklist data: every checklist + candidate responses', 1),
])
job('src/components/top-bar.tsx', [
    ('href="/superadmin" title="Open the superadmin console"', 'href="/console" title="Open the admin console"', 1),
    ('<ShieldCheck className="w-4 h-4" /> Superadmin <ExternalLink className="w-3.5 h-3.5 opacity-70" />',
     '<ShieldCheck className="w-4 h-4" /> Admin <ExternalLink className="w-3.5 h-3.5 opacity-70" />', 1),
])

# ─────────────────────────────────────────────────────────────────────
# 3) Server-side strings that surface in the UI
job('src/app/api/admin/email-status/route.ts', [
    ('// GET /api/admin/email-status — live picture of the Brevo account behind the',
     "// GET /api/admin/email-status — live picture of the email provider account behind the", 1),
    ('? `Brevo returned HTTP ${accResp.status}`', '? `The email provider returned HTTP ${accResp.status}`', 1),
    (": 'Could not reach Brevo'", ": 'Could not reach the email provider'", 1),
])
job('src/lib/gsa.ts', [
    ('// The key is managed exclusively by the superadmin (PlatformSetting);',
     '// The key is managed exclusively by the platform admin (PlatformSetting);', 1),
    ("throw new Error('No GSA API key configured — the platform admin must add one in Superadmin → Keys & access.')",
     "throw new Error('No GSA API key configured — the platform admin must add one in the admin console (Keys & access).')", 1),
])
job('src/app/api/admin/skills/export-template/route.ts', [
    ('filename="MyZipVault_Skills_Import_Template.xlsx"', 'filename="Skills_Import_Template.xlsx"', 1),
])

# ─────────────────────────────────────────────────────────────────────
# 4) Email template defaults (sample data shown in previews)
job('src/lib/email-templates.ts', [
    ("// Managed by the superadmin (Email tab): subject + HTML body per template,",
     "// Managed by the platform admin (Email tab): subject + HTML body per template,", 1),
    ("sender_email: 'myzipvault@gmail.com',", "sender_email: 'noreply@yourdomain.com',", 6),
    ("description: 'Sent by the superadmin \"Send test email\" buttons to verify Brevo delivery.',",
     "description: 'Sent by the \"Send test email\" buttons to verify email delivery.',", 1),
])

# ─────────────────────────────────────────────────────────────────────
# 5) Fallback default sender (was a real address) — schema + settings API
job('prisma/schema.prisma', [
    ('brevoSenderEmail String  @default("myzipvault@gmail.com")',
     'brevoSenderEmail String  @default("noreply@example.com")', 1),
])
job('src/app/api/admin/settings/route.ts', [
    ("?? 'myzipvault@gmail.com'", "?? 'noreply@example.com'", 1),
])

# ─────────────────────────────────────────────────────────────────────
# 6) Comments with old brand names (repo cleanliness)
job('src/components/admin/skills-panel.tsx', [
    ('// Superadmin → Skills data: the MyZipVault skills management UI.',
     '// Admin console → Skills data: the skills library management UI.', 1),
])
job('src/lib/skills.ts', [
    ('// Shared skills-checklist library — the MyZipVault/VaultVerify data model:',
     '// Shared skills-checklist library — the VaultVerify data model:', 1),
    ('// ─── xlsx import (MyZipVault "Skills Data" template) ────────────────',
     '// ─── xlsx import ("Skills Data" template) ────────────────', 1),
])
job('src/lib/email.ts', [
    ('// Brevo transactional email — API key is managed in the superadmin panel',
     '// Transactional email — API key is managed in the admin console (server-side only)', 1),
])
job('src/lib/platform-backup.ts', [
    ('// row from this file, so the saved Brevo/GSA keys and sender identity',
     '// row from this file, so the saved email/GSA keys and sender identity', 1),
])
job('src/app/api/admin/skills/route.ts', [
    ('// Superadmin — skills data management (MyZipVault model).',
     '// Admin console — skills data management.', 1),
])
job('src/app/api/admin/skills/import/route.ts', [
    ('// Superadmin — import skills data from the MyZipVault "Skills Data" xlsx template.',
     '// Admin console — import skills data from the "Skills Data" xlsx template.', 1),
])
job('scripts/seed.ts', [
    ('// prisma/seed-skills.xlsx (the MyZipVault "Skills Data" import template).',
     '// prisma/seed-skills.xlsx (the "Skills Data" import template).', 1),
])

# ─────────────────────────────────────────────────────────────────────
# 7) DEPLOY.md — keep provider guidance (it's deployment docs), scrub
#    personal identifiers + old brand + admin URL
job('DEPLOY.md', [
    ('(do NOT reuse the MyZipVault repo):', "(do NOT reuse a previous project's repo):", 1),
    ('(superadmin + 315 templates /', '(platform admin + 315 templates /', 1),
    ('**Create the tables + superadmin** (one-time, from your laptop):',
     '**Create the tables + platform admin** (one-time, from your laptop):', 1),
    ('Visit **`https://<your-app>.vercel.app/superadmin`** — the superadmin console has',
     'Visit **`https://<your-app>.vercel.app/console`** — the admin console has', 1),
    ('**Keys & access → Superadmin credentials**', '**Keys & access → Administrator credentials**', 1),
    ('the app self-heals: the superadmin', 'the app self-heals: the admin console', 1),
    ('log in as superadmin → **Superadmin → Email**:', 'log in as the platform admin → **Admin console → Email**:', 1),
    ('`sam.p@medstalent.com — free · 300 emails/day`', '`your.account@example.com — free · 300 emails/day`', 1),
    ('2. Superadmin → Keys & access → **GSA Per Diem API key (shared)**',
     '2. Admin console → Keys & access → **GSA Per Diem API key (shared)**', 1),
    ('4. **Superadmin** maintains the skills library itself: Excel import\n   (MyZipVault `Skills Data` format)',
     '4. **The platform admin** maintains the skills library itself: Excel import\n   (`Skills Data` format)', 1),
    ('in **Superadmin → Skills data**.', 'in **Admin console → Skills data**.', 1),
    ('- Superadmin → Email → Send log', '- Admin console → Email → Send log', 1),
    ('- Superadmin → Checklist data', '- Admin console → Checklist data', 1),
    ('- Superadmin → Skills data — import/export the skills library (MyZipVault\n  `Skills Data` xlsx format)',
     '- Admin console → Skills data — import/export the skills library (the\n  `Skills Data` xlsx format)', 1),
])

# ─────────────────────────────────────────────────────────────────────
# 8) Committed scripts — scrub personal identifiers, update admin URL
job('scripts/browser_check.sh', [
    ('======== SUPERADMIN: /superadmin ========', '======== ADMIN CONSOLE: /console ========', 1),
    ('$AB open http://localhost:3000/superadmin || true', '$AB open http://localhost:3000/console || true', 1),
    ("grep -Ei 'brevo|sender|vaultverify|myzipvault|test mode|xkeysib|xsmtp|current key'",
     "grep -Ei 'email provider|sender|vaultverify|test mode|current key|api key'", 1),
])
job('scripts/browser_check_subject.sh', [
    ('$AB open http://localhost:3000/superadmin || true', '$AB open http://localhost:3000/console || true', 1),
])
job('scripts/browser_check_templates.sh', [
    ('$AB open http://localhost:3000/superadmin || true', '$AB open http://localhost:3000/console || true', 1),
])
job('scripts/verify_selfheal.sh', [
    ('$AB open http://localhost:3000/superadmin || true', '$AB open http://localhost:3000/console || true', 1),
    ('myzipvault@gmail.com', 'noreply@example.com', 3),
    ("t.includes('No Brevo API key saved yet')", "t.includes('No email provider API key saved yet')", 1),
    ("['Brevo key input present',", "['Email provider key input present',", 1),
])
job('scripts/verify_templates.sh', [
    ('myzipvault@gmail.com', 'test@example.com', 1),
])
job('scripts/e2e-reference-checklist.mjs', [
    ("candidateEmail: 'shaswatpandey0047@gmail.com',", "candidateEmail: 'candidate@example.com',", 1),
])
job('scripts/e2e-checklist.mjs', [
    ("candidateEmail: 'shaswat.0047@gmail.com',", "candidateEmail: 'candidate@example.com',", 2),
    ("'Shaswat pandey'", "'Test User'", 5),
    ('if (c.printedName !== ' + repr('Shaswat pandey') + ')', 'if (c.printedName !== ' + repr('Test User') + ')', 1),
    ('if (c.signedName !== ' + repr('Shaswat pandey') + ')', 'if (c.signedName !== ' + repr('Test User') + ')', 1),
    ("candidateName: 'Sam', signedName: 'Shaswat pandey'", "candidateName: 'Sam', signedName: 'Test User'", 1),
])

print('\nAll scrub edits applied.')
