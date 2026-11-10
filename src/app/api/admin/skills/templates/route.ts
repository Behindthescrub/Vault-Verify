// Superadmin — create a specialty template (Profession / Job Title / Specialty).
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  try {
    const schema = z.object({
      profession: z.string().trim().min(1).max(80),
      jobTitle: z.string().trim().min(1).max(120),
      specialty: z.string().trim().min(1).max(120),
    })
    const parsed = schema.safeParse(await req.json())
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
    }
    const { profession, jobTitle, specialty } = parsed.data
    const existing = await db.skillTemplate.findFirst({
      where: { profession: { equals: profession }, jobTitle: { equals: jobTitle }, specialty: { equals: specialty } },
    })
    if (existing) return NextResponse.json({ error: 'This specialty already exists for that job title' }, { status: 409 })
    const template = await db.skillTemplate.create({
      data: {
        profession,
        jobTitle,
        specialty,
        name: `${jobTitle} - ${specialty} Skill Checklist`,
        sortOrder: 0,
      },
    })
    return NextResponse.json({ template: { id: template.id } })
  } catch {
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
