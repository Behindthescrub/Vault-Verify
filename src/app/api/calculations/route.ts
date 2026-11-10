import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'

export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  const rows = await db.calculation.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })
  return NextResponse.json({
    calculations: rows.map((r) => ({
      id: r.id,
      name: r.name,
      inputs: JSON.parse(r.inputJson),
      results: JSON.parse(r.resultJson),
      createdAt: r.createdAt,
    })),
  })
}

const schema = z.object({
  name: z.string().trim().min(1).max(160),
  inputs: z.record(z.string(), z.unknown()),
  results: z.record(z.string(), z.unknown()),
})

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  try {
    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const calc = await db.calculation.create({
      data: {
        userId: user.id,
        name: parsed.data.name,
        inputJson: JSON.stringify(parsed.data.inputs),
        resultJson: JSON.stringify(parsed.data.results),
      },
    })
    return NextResponse.json({ calculation: { id: calc.id } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
