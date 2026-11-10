import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { getCurrentUser } from '@/lib/auth'
import { serializeChecklistDetail } from '@/lib/skills'
import { renderChecklistPdf, checklistPdfFilename } from '@/lib/checklist-pdf'

type Params = { params: Promise<{ id: string }> }

// GET /api/checklists/[id]/pdf — download the VaultVerify skills-checklist PDF.
// Owner or superadmin only; only submitted checklists have a document to render.
export async function GET(_req: NextRequest, { params }: Params) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { id } = await params
  const c = await db.checklist.findUnique({ where: { id }, include: { response: true } })
  if (!c || (c.userId !== user.id && user.role !== 'superadmin')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!c.response) {
    return NextResponse.json({ error: 'This checklist has not been submitted yet' }, { status: 409 })
  }

  try {
    const detail = serializeChecklistDetail(c)
    const buf = await renderChecklistPdf(detail)
    const filename = checklistPdfFilename(detail)
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (e) {
    console.error('PDF render failed', e)
    return NextResponse.json({ error: 'Could not generate the PDF' }, { status: 500 })
  }
}
