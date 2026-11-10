import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { fetchPerDiem } from '@/lib/gsa'
import { getPlatformSettings } from '@/lib/email'

// GET /api/calculator/gsa?city=&state=&zip=&year=&month=
// GSA Per Diem proxy — key stays server-side (platform key, or the user's own).
export async function GET(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const sp = req.nextUrl.searchParams
  const city = sp.get('city') ?? undefined
  const state = sp.get('state') ?? undefined
  const zip = sp.get('zip') ?? undefined
  const year = Number(sp.get('year')) || new Date().getFullYear()
  const month = Number(sp.get('month')) || new Date().getMonth() + 1

  try {
    const [userSettings, platform] = await Promise.all([
      db.userSettings.findUnique({ where: { userId: user.id } }),
      getPlatformSettings(),
    ])
    const apiKey = userSettings?.gsaApiKey?.trim() || platform.gsaApiKey?.trim() || ''
    const result = await fetchPerDiem({ apiKey, city, state, zip, year, month })
    return NextResponse.json({ perDiem: result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Per Diem fetch failed'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
