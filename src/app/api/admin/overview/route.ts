// Superadmin — platform overview stats.
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  }

  const [userCount, checklistStatus, responseAgg, calculationCount, emailStatus, recentSignups, recentSubmissions] =
    await Promise.all([
      db.user.count(),
      db.checklist.groupBy({ by: ['status'], _count: true }),
      db.checklistResponse.aggregate({ _count: true, _avg: { avgRating: true } }),
      db.calculation.count(),
      db.emailLog.groupBy({ by: ['status'], _count: true }),
      db.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, email: true, company: true, createdAt: true },
      }),
      db.checklist.findMany({
        where: { status: 'submitted' },
        orderBy: { updatedAt: 'desc' },
        take: 5,
        select: {
          id: true,
          title: true,
          candidateName: true,
          templateKey: true,
          updatedAt: true,
          response: { select: { avgRating: true } },
          user: { select: { email: true } },
        },
      }),
    ])

  const byStatus = Object.fromEntries(checklistStatus.map((s) => [s.status, s._count]))
  const byEmail = Object.fromEntries(emailStatus.map((s) => [s.status, s._count]))

  return NextResponse.json({
    overview: {
      users: userCount,
      checklists: (byStatus['draft'] ?? 0) + (byStatus['sent'] ?? 0) + (byStatus['submitted'] ?? 0),
      drafts: byStatus['draft'] ?? 0,
      sent: byStatus['sent'] ?? 0,
      submitted: byStatus['submitted'] ?? 0,
      responses: responseAgg._count,
      avgRating: responseAgg._avg.avgRating,
      calculations: calculationCount,
      emailsSent: byEmail['sent'] ?? 0,
      emailsTestMode: byEmail['test-mode'] ?? 0,
      emailsFailed: byEmail['failed'] ?? 0,
    },
    recentSignups,
    recentSubmissions: recentSubmissions.map((c) => ({
      id: c.id,
      title: c.title,
      candidateName: c.candidateName,
      templateKey: c.templateKey,
      avgRating: c.response?.avgRating ?? null,
      completedAt: c.updatedAt,
      ownerEmail: c.user.email,
    })),
  })
}
