import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { sendTemplateEmail } from '@/lib/email-templates'

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
    const personal = parsed.data.message
      ? `<p style="color:#334155">${escapeHtml(parsed.data.message).replace(/\n/g, '<br>')}</p>`
      : ''

    // First send → invitation; re-send while already sent → reminder template.
    const templateKey = c.status === 'sent' ? 'candidate_reminder' : 'candidate_invite'
    const userSettings = await db.userSettings.findUnique({ where: { userId: user.id } })
    const company = (userSettings?.companyName || user.company || '').trim()

    const result = await sendTemplateEmail({
      key: templateKey,
      to: parsed.data.toEmail,
      toName: c.candidateName ?? undefined,
      force: true,
      vars: {
        candidate_name: c.candidateName ?? '',
        candidate_name_suffix: c.candidateName ? ` ${c.candidateName}` : '',
        checklist_title: c.title,
        skill_count: String(
          JSON.parse(c.itemsJson).reduce(
            (n: number, cat: { skills: unknown[] }) => n + cat.skills.length, 0,
          ),
        ),
        recruiter_name: recruiterName,
        company,
        company_suffix: company ? ` · ${company}` : '',
        link,
        personal_message: personal,
      },
      rawKeys: ['personal_message'],
    })

    if (!result || !result.ok) {
      return NextResponse.json({ error: `Email failed: ${result?.error ?? 'template disabled'}`, status: result?.status }, { status: 502 })
    }

    await db.checklist.update({
      where: { id },
      data: {
        candidateEmail: c.candidateEmail ?? parsed.data.toEmail,
        status: c.status === 'draft' ? 'sent' : c.status,
        inviteSentAt: new Date(),
      },
    })
    return NextResponse.json({ ok: true, emailStatus: result.status, link, templateKey })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
