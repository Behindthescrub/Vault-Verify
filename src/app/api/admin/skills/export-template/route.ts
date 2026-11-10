// Superadmin — download the blank "Skills Data" import template (.xlsx).
import { NextResponse } from 'next/server'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'
import { buildSkillsTemplateXlsx } from '@/lib/skills'

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  const buf = buildSkillsTemplateXlsx()
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': 'attachment; filename="MyZipVault_Skills_Import_Template.xlsx"',
    },
  })
}
