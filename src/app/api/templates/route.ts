import { NextResponse } from 'next/server'
import { templateSummary, SCALE_LEGEND } from '@/lib/templates'

export async function GET() {
  return NextResponse.json({ templates: templateSummary(), scale: SCALE_LEGEND })
}
