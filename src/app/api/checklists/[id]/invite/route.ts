import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { sendEmail } from '@/lib/email'

type Params = { params: Promise<{ id: string }> }

const schema = z.object({
  toEmail: z.string().email(),
  message: z.string().trim().max(2000).optional(),
})

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

export async function POST(req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const c = await db.checklist.findUnique({ where: { id } })
    if (!c || c.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const origin = req.nextUrl.origin
    const link = `${origin}/?c=${c.token}`
    const recruiterName = user.name || user.email
    const personal = parsed.data.message ? `<p style="color:#334155">${escapeHtml(parsed.data.message).replace(/\n/g, '<br>')}</p>` : ''

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
        <div style="background:linear-gradient(135deg,#0a1628,#1a2a6c);border-radius:14px 14px 0 0;padding:22px 26px;color:#fff">
          <h2 style="margin:0;font-size:18px">Skills Checklist Invitation</h2>
          <p style="margin:6px 0 0;color:#a8b8d8;font-size:13px">from ${escapeHtml(recruiterName)}</p>
        </div>
        <div style="border:1px solid #e2e8f0;border-top:0;border-radius:0 0 14px 14px;padding:26px">
          <p style="font-size:15px">Hello${c.candidateName ? ' ' + escapeHtml(c.candidateName) : ''},</p>
          ${personal}
          <p style="font-size:14px;color:#475569;line-height:1.6">
            Please complete the <strong>${escapeHtml(c.title)}</strong> skills checklist.
            It takes about 10–15 minutes — you'll rate each skill from 1 (no experience) to 5 (expert).
          </p>
          <p style="text-align:center;margin:28px 0">
            <a href="${link}" style="background:#4f46e5;color:#fff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 28px;border-radius:10px;display:inline-block">Open the checklist</a>
          </p>
          <p style="font-size:12px;color:#94a3b8;border-top:1px solid #eef1f6;padding-top:14px">
            If the button doesn't work, paste this link into your browser:<br>${link}
          </p>
        </div>
      </div>`

    const result = await sendEmail({
      to: parsed.data.toEmail,
      toName: c.candidateName ?? undefined,
      subject: `Skills Checklist — ${c.title}`,
      html,
      purpose: 'invite',
    })

    if (!result.ok) {
      return NextResponse.json({ error: `Email failed: ${result.error}`, status: result.status }, { status: 502 })
    }

    await db.checklist.update({
      where: { id },
      data: {
        candidateEmail: c.candidateEmail ?? parsed.data.toEmail,
        status: c.status === 'draft' ? 'sent' : c.status,
        inviteSentAt: new Date(),
      },
    })
    return NextResponse.json({ ok: true, emailStatus: result.status, link })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
