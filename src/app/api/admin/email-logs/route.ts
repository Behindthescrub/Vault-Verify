import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  const logs = await db.emailLog.findMany({ orderBy: { createdAt: 'desc' }, take: 50 })
  return NextResponse.json({ logs })
}
