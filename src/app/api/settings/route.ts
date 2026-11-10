import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  let settings = await db.userSettings.findUnique({ where: { userId: user.id } })
  if (!settings) settings = await db.userSettings.create({ data: { userId: user.id } })
  return NextResponse.json({ settings })
}

const schema = z.object({
  companyName: z.string().trim().max(160).nullable().optional(),
  companyLogoUrl: z.string().max(512 * 1024).nullable().optional(), // data URL or https URL
  defaultOnboardingPct: z.number().min(0).max(100).optional(),
  minW2: z.number().min(0).max(1000).optional(),
  otEnabled: z.boolean().optional(),
})

export async function PUT(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(parsed.data)) {
      if (v !== undefined) data[k] = v === null ? null : v
    }
    const settings = await db.userSettings.upsert({
      where: { userId: user.id },
      create: { userId: user.id, ...data },
      update: data,
    })
    return NextResponse.json({ settings })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
