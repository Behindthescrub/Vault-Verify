// Superadmin — CSV export of every checklist on the platform (summary per checklist).
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

function csvCell(v: string | number | null | undefined): string {
  const s = v == null ? '' : String(v)
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export async function GET(_req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  }

  const rows = await db.checklist.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { email: true } },
      response: { select: { avgRating: true, completedAt: true } },
    },
  })

  const header = [
    'Checklist',
    'Template',
    'Candidate name',
    'Candidate email',
    'Status',
    'Submitted via',
    'Average rating',
    'Skills',
    'Owner (recruiter)',
    'Created',
    'Completed',
  ]
  const lines = [header.join(',')]
  for (const c of rows) {
    const items = JSON.parse(c.itemsJson) as { category: string; skills: string[] }[]
    lines.push(
      [
        c.title,
        c.templateKey.toUpperCase(),
        c.candidateName,
        c.candidateEmail,
        c.status,
        c.submittedVia ?? '',
        c.response ? (c.response.avgRating ?? 0).toFixed(2) : '',
        items.reduce((n, cat) => n + cat.skills.length, 0),
        c.user.email,
        c.createdAt.toISOString(),
        c.response?.completedAt?.toISOString() ?? '',
      ]
        .map(csvCell)
        .join(','),
    )
  }

  const csv = lines.join('\n')
  const date = new Date().toISOString().slice(0, 10)
  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="recruiter-tool-checklists-${date}.csv"`,
    },
  })
}
