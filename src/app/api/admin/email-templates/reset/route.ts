import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { DEFAULT_TEMPLATES } from '@/lib/email-templates'

// POST /api/admin/email-templates/reset — revert one template (or all)
// to the built-in VaultVerify default. Deleting the row makes every
// read fall back to the code default.
export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const parsed = z.object({ key: z.string().trim().optional(), all: z.boolean().optional() })
      .safeParse(await req.json().catch(() => ({})))
    if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 })

    if (parsed.data.all) {
      await db.emailTemplate.deleteMany()
      return NextResponse.json({ ok: true, reset: 'all' })
    }
    const key = parsed.data.key
    if (!key || !DEFAULT_TEMPLATES.some((t) => t.key === key)) {
      return NextResponse.json({ error: 'Unknown template' }, { status: 404 })
    }
    await db.emailTemplate.deleteMany({ where: { key } })
    return NextResponse.json({ ok: true, reset: key })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
