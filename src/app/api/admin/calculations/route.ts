// Superadmin — every saved calculator run on the platform (read-only audit).
import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  }

  const rows = await db.calculation.findMany({
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { email: true } } },
    take: 200,
  })

  return NextResponse.json({
    calculations: rows.map((r) => {
      const inputs = JSON.parse(r.inputJson) as { billRate?: number }
      return {
        id: r.id,
        name: r.name,
        ownerEmail: r.user.email,
        billRate: typeof inputs.billRate === 'number' ? inputs.billRate : null,
        createdAt: r.createdAt,
      }
    }),
  })
}
