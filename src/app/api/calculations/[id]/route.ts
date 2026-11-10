import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

type Params = { params: Promise<{ id: string }> }

export async function DELETE(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const { id } = await params
  const calc = await db.calculation.findUnique({ where: { id } })
  if (!calc || calc.userId !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  await db.calculation.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
