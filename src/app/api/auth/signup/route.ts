import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { hashPassword, createSession } from '@/lib/auth'
import { sendTemplateEmail } from '@/lib/email-templates'

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { email, password, name, company } = parsed.data
    const normalizedEmail = email.toLowerCase().trim()

    const existing = await db.user.findUnique({ where: { email: normalizedEmail } })
    if (existing) {
      return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 })
    }

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hashPassword(password),
        name: name || null,
        company: company || null,
        settings: { create: {} },
      },
    })
    await createSession(user.id)

    // Welcome email (automated template — failure never blocks signup).
    await sendTemplateEmail({
      key: 'recruiter_welcome',
      to: user.email,
      toName: user.name ?? undefined,
      vars: {
        name: user.name || user.email,
        name_suffix: user.name ? ` ${user.name}` : '',
        company: company || '',
        company_suffix: company ? ` (${company})` : '',
        account_email: user.email,
        link: `${req.nextUrl.origin}/`,
      },
    }).catch(() => null)

    return NextResponse.json({
      user: { id: user.id, email: user.email, name: user.name, company: user.company, role: user.role },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
