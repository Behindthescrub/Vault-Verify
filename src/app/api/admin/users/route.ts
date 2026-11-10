import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const [users, activeSessions] = await Promise.all([
      db.user.findMany({
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { checklists: true, calculations: true, sessions: true } } },
      }),
      // Auth data: currently active (unexpired) sessions per user
      db.session.findMany({ where: { expiresAt: { gt: new Date() } }, select: { userId: true } }),
    ])
    const sessionByUser = new Map<string, number>()
    for (const s of activeSessions) sessionByUser.set(s.userId, (sessionByUser.get(s.userId) ?? 0) + 1)
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
        activeSessions: sessionByUser.get(u.id) ?? 0,
      })),
    })
  } catch (e) {
    console.error('[api/admin/users] GET failed:', e)
    return NextResponse.json({ error: 'Failed to load users' }, { status: 500 })
  }
}
