import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

// POST /api/admin/test-email — send a test email through Brevo.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const body = await req.json().catch(() => ({}))
    const to = typeof body.to === 'string' && body.to.includes('@') ? body.to : user.email
    const platform = await db.platformSetting.findUnique({ where: { id: 'main' } })
    const result = await sendEmail({
      to,
      subject: 'Recruiter tool — test email',
      html: `
        <div style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:0 auto;color:#0f172a">
          <div style="background:linear-gradient(135deg,#0a1628,#1a2a6c);border-radius:14px 14px 0 0;padding:20px 24px;color:#fff">
            <h2 style="margin:0;font-size:17px">✅ Brevo is wired up</h2>
          </div>
          <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;padding:22px;font-size:14px;color:#475569">
            <p style="margin:0">This is a test email from <strong>Recruiter tool</strong>.</p>
            <p style="margin:10px 0 0">If you can read this, transactional email delivery is working.</p>
            <p style="margin:10px 0 0;color:#94a3b8;font-size:12px">Mode: ${platform?.emailTestMode ? 'TEST MODE (logged, not delivered)' : 'LIVE'} · Sender: ${platform?.brevoSenderEmail ?? 'not set'}</p>
          </div>
        </div>`,
      purpose: 'test',
    })
    if (!result.ok) return NextResponse.json({ error: `Email failed: ${result.error}`, status: result.status }, { status: 502 })
    return NextResponse.json({ ok: true, emailStatus: result.status, sentTo: to })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
