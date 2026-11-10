import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  const users = await db.user.findMany({
    orderBy: { createdAt: 'desc' },
    include: { _count: { select: { checklists: true, calculations: true, sessions: true } } },
  })
  return NextResponse.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      company: u.company,
      role: u.role,
      createdAt: u.createdAt,
      checklistCount: u._count.checklists,
      calculationCount: u._count.calculations,
    })),
  })
}
