import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin, hashPassword, verifyPassword } from '@/lib/auth'

async function requireSuperadmin() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return null
  return user
}

function maskKey(key?: string | null): string {
  if (!key) return ''
  if (key.length <= 8) return '••••'
  return key.slice(0, 4) + '••••••••' + key.slice(-4)
}

export async function GET() {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  const s = await db.platformSetting.findUnique({ where: { id: 'main' } })
  return NextResponse.json({
    settings: {
      brevoApiKeyMasked: maskKey(s?.brevoApiKey),
      brevoApiKeySet: !!s?.brevoApiKey,
      brevoSenderEmail: s?.brevoSenderEmail ?? '',
      brevoSenderName: s?.brevoSenderName ?? '',
      emailTestMode: s?.emailTestMode ?? true,
      gsaApiKeyMasked: maskKey(s?.gsaApiKey),
      gsaApiKeySet: !!s?.gsaApiKey,
    },
    adminEmail: admin.email,
  })
}

const schema = z.object({
  brevoApiKey: z.string().trim().max(200).optional(), // '' clears
  brevoSenderEmail: z.string().email().optional(),
  brevoSenderName: z.string().trim().max(120).optional(),
  emailTestMode: z.boolean().optional(),
  gsaApiKey: z.string().trim().max(200).optional(), // '' clears
  newAdminEmail: z.string().email().optional(),
  newAdminPassword: z.string().min(8).optional(),
  currentPassword: z.string().optional(),
})

export async function PUT(req: NextRequest) {
  const admin = await requireSuperadmin()
  if (!admin) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { newAdminEmail, newAdminPassword, currentPassword, ...rest } = parsed.data

    // Ensure the settings row exists
    await db.platformSetting.upsert({ where: { id: 'main' }, create: { id: 'main' }, update: {} })

    const data: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(rest)) {
      if (v === undefined) continue
      if ((k === 'brevoApiKey' || k === 'gsaApiKey') && v === '') { data[k] = null; continue }
      data[k] = v
    }
    if (Object.keys(data).length > 0) {
      await db.platformSetting.update({ where: { id: 'main' }, data })
    }

    // Credential changes require the current password
    if (newAdminEmail || newAdminPassword) {
      const me = await db.user.findUnique({ where: { id: admin.id } })
      if (!currentPassword || !me || !verifyPassword(currentPassword, me.passwordHash)) {
        return NextResponse.json({ error: 'Enter your current password to change admin credentials' }, { status: 400 })
      }
      if (newAdminEmail && newAdminEmail.toLowerCase() !== me.email) {
        const taken = await db.user.findUnique({ where: { email: newAdminEmail.toLowerCase() } })
        if (taken) return NextResponse.json({ error: 'That email is already in use' }, { status: 409 })
        await db.user.update({ where: { id: me.id }, data: { email: newAdminEmail.toLowerCase() } })
      }
      if (newAdminPassword) {
        await db.user.update({ where: { id: me.id }, data: { passwordHash: hashPassword(newAdminPassword) } })
      }
    }

    const s = await db.platformSetting.findUnique({ where: { id: 'main' } })
    return NextResponse.json({
      ok: true,
      settings: {
        brevoApiKeyMasked: maskKey(s?.brevoApiKey),
        brevoApiKeySet: !!s?.brevoApiKey,
        brevoSenderEmail: s?.brevoSenderEmail ?? '',
        brevoSenderName: s?.brevoSenderName ?? '',
        emailTestMode: s?.emailTestMode ?? true,
        gsaApiKeyMasked: maskKey(s?.gsaApiKey),
        gsaApiKeySet: !!s?.gsaApiKey,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
