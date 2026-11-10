import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { sendTemplateEmail, DEFAULT_TEMPLATES } from '@/lib/email-templates'

// POST /api/admin/test-email — send a test email through Brevo.
// Optional templateKey: renders THAT template with its sample vars
// (exactly what the superadmin preview shows). Default: platform_test.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const to = typeof body.to === 'string' && body.to.includes('@') ? body.to : user.email
    const templateKey = typeof body.templateKey === 'string' ? body.templateKey : 'platform_test'
    if (!DEFAULT_TEMPLATES.some((t) => t.key === templateKey)) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 404 })
    }

    const platform = await db.platformSetting.findUnique({ where: { id: 'main' } })
    const origin = req.nextUrl.origin

    // Sample vars, with links pointed at the real app origin so the
    // buttons in the test email actually lead somewhere.
    const def = DEFAULT_TEMPLATES.find((t) => t.key === templateKey)!
    const vars: Record<string, string> = {
      ...def.sampleVars,
      link: def.sampleVars.link?.includes('example.com')
        ? `${origin}/?c=sample-token`
        : def.sampleVars.link ?? `${origin}/`,
      mode: platform?.emailTestMode ? 'TEST MODE (logged, not delivered)' : 'LIVE',
      sender_name: platform?.brevoSenderName || 'VaultVerify',
      sender_email: platform?.brevoSenderEmail || 'not set',
      template_name: def.name,
      sent_at: new Date().toLocaleString(),
    }

    const result = await sendTemplateEmail({
      key: templateKey as Parameters<typeof sendTemplateEmail>[0]['key'],
      to,
      vars,
      force: true,
      origin,
    })
    if (result && !result.ok) return NextResponse.json({ error: `Email failed: ${result.error}`, status: result.status }, { status: 502 })
    return NextResponse.json({ ok: true, emailStatus: result?.status ?? 'skipped', sentTo: to, templateKey, messageId: result?.messageId })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
