import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { DEFAULT_TEMPLATES } from '@/lib/email-templates'

// GET /api/admin/email-templates — the full template library
// (DB rows win over code defaults; missing rows are shown from defaults).
export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const rows = await db.emailTemplate.findMany()
    const byKey = new Map(rows.map((r) => [r.key, r]))
    const templates = DEFAULT_TEMPLATES.map((def) => {
      const row = byKey.get(def.key)
      return {
        key: def.key,
        name: def.name,
        description: def.description,
        automated: def.automated,
        purpose: def.purpose,
        subject: row?.subject ?? def.subject,
        bodyHtml: row?.bodyHtml ?? def.bodyHtml,
        isActive: row?.isActive ?? true,
        updatedAt: (row?.updatedAt ?? new Date(0)).toISOString(),
        sampleVars: def.sampleVars,
      }
    })
    return NextResponse.json({ templates })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

const schema = z.object({
  key: z.string().trim().min(1).max(64),
  subject: z.string().trim().min(1).max(300),
  bodyHtml: z.string().min(1).max(200 * 1024),
  isActive: z.boolean(),
})

// PUT /api/admin/email-templates — save (create or update) one template.
export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { key, subject, bodyHtml, isActive } = parsed.data
    const def = DEFAULT_TEMPLATES.find((t) => t.key === key)
    if (!def) return NextResponse.json({ error: 'Unknown template' }, { status: 404 })

    const row = await db.emailTemplate.upsert({
      where: { key },
      create: { key, subject, bodyHtml, isActive },
      update: { subject, bodyHtml, isActive },
    })
    return NextResponse.json({
      template: {
        key: row.key,
        name: def.name,
        description: def.description,
        automated: def.automated,
        purpose: def.purpose,
        subject: row.subject,
        bodyHtml: row.bodyHtml,
        isActive: row.isActive,
        updatedAt: row.updatedAt.toISOString(),
        sampleVars: def.sampleVars,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
