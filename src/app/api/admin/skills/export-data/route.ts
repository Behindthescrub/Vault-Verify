// Superadmin — export ALL skills data as the "Skills Data" xlsx.
import { NextResponse } from 'next/server'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { buildSkillsDataXlsx } from '@/lib/skills'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  const buf = await buildSkillsDataXlsx()
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="recruiter-tool-skills-data-${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  })
}
