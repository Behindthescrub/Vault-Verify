import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ user: null, settings: null }, { status: 200 })
  const settings = await db.userSettings.findUnique({ where: { userId: user.id } })
  return NextResponse.json({ user, settings })
}
