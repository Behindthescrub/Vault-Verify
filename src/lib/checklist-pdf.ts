// VaultVerify Skills Checklist PDF — server-side renderer (pdfkit).
// Pixel-faithful replica of the reference document:
//   p1: full brand band (logo + VaultVerify + tagline, right "Skills Checklist"),
//       profile card (avatar, name, role pills, meta), "Summary at a glance"
//       (rating-mix donut + last-performed donut with legends), "Category overview"
//       (mint card, progress bars), rating-scale legend, skills table.
//   p2+: slim band + repeated teal table header, "(continued)" group labels.
//   p3: additional questions (Yes/No pills, green-accented text answers).
//   p4: candidate attestation (mint card, green left border, signature columns)
//       + disclaimer. Every page: divider footer with "Page X of N".
import fs from 'fs'
import path from 'path'
import PDFDocument from 'pdfkit'
import {
  CHECKLIST_BRAND, VALIDITY_DAYS, SCALE_LEGEND, LAST_PERFORMED_OPTIONS,
  ADDITIONAL_SECTIONS, ATTESTATION, summarizeChecklist, ratingShortLabel,
  type Ratings, type LastPerformed, type RatingValue,
} from '@/lib/skills'
import type { SerializedChecklistDetail } from '@/lib/skills'

// ─── Palette (extracted from the VaultVerify reference PDF) ──────────
const C = {
  band1: '#0E3B32', band2: '#145043', accent: '#8BC34A',
  heading: '#0F3D33', text: '#333B37', label: '#66756E', muted: '#8CA096',
  divider: '#E0E5E2', rowLine: '#ECEFEA', track: '#D3DDD6',
  mint: '#EDF6F1', mintBar: '#EDF6F1', mintSoft: '#EDF5EF',
  green: '#2E9E5B', greenDeep: '#2E7D32', greenText: '#2E7D4F',
  chartGreen: '#34A853', blue: '#3B82F6', blueText: '#2F6BC4',
  amber: '#F5A623', amberText: '#9A6200', red: '#E5484D', redText: '#C13A3E',
  navy: '#1E3A5F', blueGray: '#5B7A99', grayIcon: '#9AA5AB', paleGray: '#C9D2D6',
  pillGreenBg: '#DFF2E3', pillBlueBg: '#E3EDFB', pillAmberBg: '#FDF1DC',
  pillRedBg: '#FDEAEA', pillGrayBg: '#EEF1F2', lpGrayBg: '#E3E8EA',
  donutRest: '#D7DDE0', recentRest: '#DDE3E0',
  white: '#FFFFFF', bandText: '#B9DCC4',
  pageBg: '#F1F5F3', cardBorder: '#E5EAE7', footerBg: '#F4F6F5', avatar: '#14503F',
}

const PAGE_W = 612, PAGE_H = 792
const M = 40                      // side margin
const CW = PAGE_W - M * 2         // content width (532)
const BAND_H = 102                // page-1 brand band
const BAND2_H = 44                // continuation band
const BOTTOM = 738                // content bottom limit

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

type Tone = { ring: string; pillBg: string; pillFg: string }
function ratingTone(v: RatingValue): Tone | null {
  if (v === 4) return { ring: C.green, pillBg: C.pillGreenBg, pillFg: C.greenText }
  if (v === 3) return { ring: C.blue, pillBg: C.pillBlueBg, pillFg: C.blueText }
  if (v === 2) return { ring: C.amber, pillBg: C.pillAmberBg, pillFg: C.amberText }
  if (v === 1) return { ring: C.red, pillBg: C.pillRedBg, pillFg: C.redText }
  return null
}

function lpTone(v: string | undefined): { bg: string; fg: string; icon: string } {
  switch (v) {
    case '3m': return { bg: C.navy, fg: '#FFFFFF', icon: '#FFFFFF' }
    case '6m': return { bg: C.blueGray, fg: '#FFFFFF', icon: '#FFFFFF' }
    case '6m+': return { bg: C.lpGrayBg, fg: '#55645C', icon: '#8CA096' }
    default: return { bg: C.pillGrayBg, fg: C.muted, icon: C.muted }
  }
}

function sanitizeFileToken(s: string): string {
  return s.trim().replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'Candidate'
}

export function checklistPdfFilename(d: SerializedChecklistDetail): string {
  const parts = d.templateLabel.split('|').map((p) => p.trim())
  const specialty = parts.length === 3 ? parts[2] : d.title
  return `Skills-Checklist-${sanitizeFileToken(specialty)}-${sanitizeFileToken(d.candidateName ?? 'Candidate')}.pdf`
}

// ─── Main renderer ───────────────────────────────────────────────────
export async function renderChecklistPdf(data: SerializedChecklistDetail): Promise<Buffer> {
  const doc = new PDFDocument({ size: 'LETTER', margin: 0, bufferPages: true, autoFirstPage: true })

  const ratings = (data.ratings ?? {}) as Ratings
  const lastPerformed = (data.lastPerformed ?? null) as LastPerformed | null
  const hasLp = !!lastPerformed && Object.keys(lastPerformed).length > 0
  const stats = summarizeChecklist(data.items, ratings, lastPerformed)

  const parts = data.templateLabel.split('|').map((p) => p.trim())
  const profession = parts.length === 3 ? parts[0] : ''
  const jobTitle = parts.length === 3 ? parts[1] : ''
  const specialty = parts.length === 3 ? parts[2] : ''
  const name = data.candidateName ?? 'Candidate'
  const runningTitle = `${name}${jobTitle ? `, ${jobTitle}` : ''}${specialty ? ` (${specialty.toUpperCase()})` : ''}`
  const experience = data.additional?.experienceYears
  const avg = stats.avg

  let y = 0
  let logoImg: string | null = null
  const logoPath = path.join(process.cwd(), 'public', 'vaultverify-logo.png')
  if (fs.existsSync(logoPath)) logoImg = logoPath

  // ── low-level helpers ──
  const text = (s: string, x: number, yy: number, opts: PDFKit.Mixins.TextOptions & { size?: number; font?: string; color?: string } = {}) => {
    doc.font(opts.font ?? 'Helvetica')
      .fontSize(opts.size ?? 8)
      .fillColor(opts.color ?? C.text)
      .text(s, x, yy, { width: opts.width, align: opts.align, lineBreak: opts.lineBreak !== false, ellipsis: true, ...opts })
  }
  const textW = (s: string, size: number, font = 'Helvetica') => {
    doc.font(font).fontSize(size)
    return doc.widthOfString(s)
  }
  const ensure = (h: number) => { if (y + h > BOTTOM) newPage() }

  // table-mode state for page breaks
  let inTable = false
  let tableCategory: string | null = null
  let pageWithHeader: unknown = null // page object that already has the table header

  function newPage() {
    doc.addPage()
    band(false)
    if (inTable) {
      drawTableHeader()
      if (tableCategory) {
        doc.roundedRect(M + 2, y, CW - 4, 16, 4).fill(C.mintBar)
        text(`${tableCategory} (continued)`, M + 10, y + 4.5, { size: 7.5, font: 'Helvetica-Bold', color: C.heading })
        y += 20
      }
    }
  }

  function band(first: boolean) {
    const h = first ? BAND_H : BAND2_H
    // gradient approximation: three stacked stops (smoother on the tall band)
    doc.rect(0, 0, PAGE_W, h * 0.4).fill(C.band1)
    doc.rect(0, h * 0.4, PAGE_W, h * 0.25).fill('#103F36')
    doc.rect(0, h * 0.65, PAGE_W, h * 0.35).fill(C.band2)
    // lime accent line along the bottom edge (full width, ~3.5pt)
    doc.rect(0, h - 3.5, PAGE_W, 3.5).fill(C.accent)

    if (first) {
      const logoSize = 46
      const lx = M, ly = (h - logoSize) / 2 - 2
      if (logoImg) {
        doc.image(logoImg, lx, ly, { width: logoSize, height: logoSize })
      } else {
        doc.roundedRect(lx, ly, logoSize, logoSize, 10).fill(C.white)
        doc.roundedRect(lx + 12, ly + 12, logoSize - 24, logoSize - 24, 8).fillAndStroke(C.green, C.band1)
      }
      const tx = lx + logoSize + 10
      text(CHECKLIST_BRAND.name, tx, h / 2 - 20, { size: 20, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
      text(CHECKLIST_BRAND.tagline, tx, h / 2 - 0.5, { size: 7.5, color: C.bandText, lineBreak: false })
      // right block
      text('Skills Checklist', M, h / 2 - 19, { width: CW, align: 'right', size: 15, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
      text('Self-assessed — not independently verified', M, h / 2 - 1, { width: CW, align: 'right', size: 7.5, color: C.bandText, lineBreak: false })
    } else {
      const logoSize = 26
      const ly = (h - logoSize) / 2 - 1
      if (logoImg) doc.image(logoImg, M, ly, { width: logoSize, height: logoSize })
      text(CHECKLIST_BRAND.name, M + logoSize + 7, h / 2 - 6.5, { size: 12, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
      text(`Skills Checklist: ${runningTitle}`, M, h / 2 - 5, { width: CW, align: 'right', size: 7.5, color: '#DCE9E0', lineBreak: false })
    }
    y = h + 14
  }

  const pill = (px: number, py: number, label: string, bg: string, fg: string, size = 6.5, opts: { bold?: boolean; dot?: boolean; right?: boolean; clock?: boolean } = {}): number => {
    const font = opts.bold === false ? 'Helvetica' : 'Helvetica-Bold'
    // width budget: left pad 5 (or 11 past a dot / 15 past a clock) + label + 5 right pad
    let w = textW(label, size, font) + 10
    if (opts.dot) w += 6
    if (opts.clock) w += 10
    const h = 13
    let x = px
    if (opts.right) x = px - w
    doc.roundedRect(x, py, w, h, h / 2).fill(bg)
    let cx = x + 5
    if (opts.dot) {
      doc.circle(x + 7, py + h / 2, 2.2).fill(opts.clock ? bg : C.white)
      cx = x + 11
    }
    if (opts.clock) {
      drawClock(cx + 2.5, py + h / 2, 2.7, opts.clock === true ? (bg === C.navy || bg === C.blueGray ? '#FFFFFF' : C.muted) : fg)
      cx += 10
    }
    text(label, cx, py + (h - size) / 2, { size, font, color: fg, lineBreak: false })
    return w
  }

  // soft shadow simulation under white cards (reference has subtle shadows)
  function cardShadow(cardH: number) {
    doc.fillOpacity(0.10)
    doc.roundedRect(M + 1, y + 1.5, CW, cardH + 2, 11).fill('#3D4A45')
    doc.fillOpacity(1)
  }

  function drawClock(cx: number, cy: number, r: number, color: string) {
    doc.circle(cx, cy, r).lineWidth(0.7).strokeColor(color).stroke()
    doc.moveTo(cx, cy).lineTo(cx, cy - r + 0.8).lineTo(cx + r - 1.2, cy + 0.4)
      .lineWidth(0.7).strokeColor(color).stroke()
  }

  function badge(cx: number, cy: number, num: number, ring: string) {
    doc.circle(cx, cy, 5.8).lineWidth(1.4).strokeColor(ring).stroke()
    text(String(num), cx - 8, cy - 3.4, { width: 16, align: 'center', size: 7, font: 'Helvetica-Bold', color: ring, lineBreak: false })
  }

  function progressBar(px: number, py: number, w: number, pct: number) {
    doc.roundedRect(px, py, w, 7, 3.5).fill(C.track)
    if (pct > 0) doc.roundedRect(px, py, Math.max(7, w * Math.min(1, pct)), 7, 3.5).fill(C.chartGreen)
  }

  // Donut ring segment as a filled polygon path
  function ringSegment(cx: number, cy: number, rOut: number, rIn: number, a0: number, a1: number, color: string) {
    const steps = Math.max(8, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 120))
    const pts: string[] = []
    for (let i = 0; i <= steps; i++) {
      const a = a0 + ((a1 - a0) * i) / steps
      pts.push(`${(cx + rOut * Math.cos(a)).toFixed(2)},${(cy + rOut * Math.sin(a)).toFixed(2)}`)
    }
    for (let i = steps; i >= 0; i--) {
      const a = a0 + ((a1 - a0) * i) / steps
      pts.push(`${(cx + rIn * Math.cos(a)).toFixed(2)},${(cy + rIn * Math.sin(a)).toFixed(2)}`)
    }
    doc.polygon(...pts.map((p) => p.split(',').map(Number) as [number, number])).fill(color)
  }

  function donut(cx: number, cy: number, rOut: number, rIn: number, segments: { pct: number; color: string }[], center: string, sub: string) {
    let a = -Math.PI / 2
    for (const s of segments) {
      if (s.pct <= 0) continue
      const sweep = (s.pct / 100) * Math.PI * 2
      ringSegment(cx, cy, rOut, rIn, a, a + sweep, s.color)
      a += sweep
    }
    // remainder track
    if (a < Math.PI * 1.5 - 0.001) {
      const rest = ((Math.PI * 1.5) - a) / (Math.PI * 2)
      if (rest > 0.002) ringSegment(cx, cy, rOut, rIn, a, a + rest * Math.PI * 2, C.donutRest)
    }
    const cs = 15, ss = 6
    // optically centered in the hole, clear of the ring
    text(center, cx - 40, cy - cs / 2 - 4, { width: 80, align: 'center', size: cs, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
    text(sub, cx - 40, cy + 6, { width: 80, align: 'center', size: ss, color: C.label, lineBreak: false })
  }

  function dot(px: number, py: number, color: string, r = 3) {
    doc.circle(px, py, r).fill(color)
  }

  function drawTableHeader() {
    if (pageWithHeader === doc.page) return // one header per page (idempotent)
    pageWithHeader = doc.page
    doc.roundedRect(M + 2, y, CW - 4, 23, 8).fill(C.band1)
    text('Skill', M + 12, y + 7.5, { size: 8, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
    text('Rating', M + 338, y + 7.5, { width: 100, align: 'center', size: 8, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
    text('Last performed', M + 396, y + 7.5, { width: 120, align: 'right', size: 8, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
    y += 27
  }

  // ═══ PAGE 1 ═══
  band(true)

  // ── Profile card ──
  {
    const cardH = 74
    cardShadow(cardH)
    doc.roundedRect(M, y, CW, cardH, 10).fill(C.white)
    // avatar
    const avR = 17, ax = M + 28, ay = y + cardH / 2
    doc.circle(ax, ay, avR).fill(C.avatar)
    text(name.trim().charAt(0).toUpperCase() || '?', ax - 10, ay - 6.5, { width: 20, align: 'center', size: 15, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
    // name + pills
    const nx = ax + avR + 12
    text(name, nx, y + 16, { size: 15, font: 'Helvetica-Bold', color: C.heading, lineBreak: false, width: 160 })
    const rolePills: { label: string }[] = []
    if (jobTitle) rolePills.push({ label: jobTitle })
    if (specialty) rolePills.push({ label: specialty.toUpperCase() })
    let pxx = nx
    for (const p of rolePills) {
      const w = textW(p.label, 6.5, 'Helvetica-Bold') + 14
      doc.roundedRect(pxx, y + 35, w, 12, 6).fill(C.pillGreenBg)
      text(p.label, pxx + 7, y + 37.5, { size: 6.5, font: 'Helvetica-Bold', color: C.greenText, lineBreak: false })
      pxx += w + 7
    }
    // divider
    doc.rect(nx + 160, y + 14, 0.7, cardH - 28).fill(C.divider)
    // meta grid — email column is wider (explicit columns, values truncated)
    const mx = nx + 175
    const gridW = CW - (mx - M) - 6
    const cols = [0, 0.42, 0.70].map((f) => mx + f * gridW) // [email | completed | valid until]
    const c1 = cols[1] - cols[0], c2 = cols[2] - cols[1], c3 = gridW - (cols[2] - cols[0])
    const clamp = (v: string, w: number, size = 7.5) => {
      let s = v
      while (textW(s, size, 'Helvetica-Bold') > w && s.length > 4) s = s.slice(0, -2) + '…'
      return s
    }
    const metaRow = (label: string, value: string, x: number, w: number, yy: number) => {
      text(label, x, yy, { size: 6.2, font: 'Helvetica-Bold', color: C.muted, lineBreak: false })
      text(clamp(value, w), x, yy + 9.5, { size: 7.5, font: 'Helvetica-Bold', color: C.text, lineBreak: false })
    }
    metaRow('Email', data.candidateEmail ?? '—', cols[0], c1 - 6, y + 11)
    metaRow('Completed', fmtDate(data.completedAt), cols[1], c2 - 6, y + 11)
    metaRow('Valid until', data.validUntil ? `${fmtDate(data.validUntil)} (${VALIDITY_DAYS} days)` : '—', cols[2], c3 - 2, y + 11)
    metaRow('Self-reported experience', experience != null ? `${experience} yr(s)` : '—', cols[0], c1 - 6, y + 39)
    metaRow('Profession', profession || '—', cols[1], c2 + c3 - 6, y + 39)
    y += cardH + 12
  }

  // ── Summary at a glance ──
  {
    const cardH = 118
    cardShadow(cardH)
    doc.roundedRect(M, y, CW, cardH, 10).fill(C.white)
    text('Summary at a glance', M + 14, y + 12, { size: 11, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
    text(`${stats.skillsAssessed} skills assessed`, M, y + 14, { width: CW - 16, align: 'right', size: 7.5, color: C.label, lineBreak: false })

    const cy = y + 74
    // Donut 1: rating mix
    const d1x = M + 58
    const segs1 = stats.ratingMix.map((m2) => ({
      pct: m2.pct,
      color: m2.key === '4' ? C.chartGreen : m2.key === '3' ? C.blue : m2.key === '2' ? C.amber : C.red,
    }))
    donut(d1x, cy, 33, 24, segs1, avg != null ? avg.toFixed(1) : '—', 'avg of 4')
    // Legend 1 — count and percent right-aligned to shared column edges
    const l1x = M + 108
    text('Rating mix', l1x, y + 30, { size: 7, font: 'Helvetica-Bold', color: C.label, lineBreak: false })
    stats.ratingMix.forEach((m2, i) => {
      const ly = y + 42 + i * 13
      const color = m2.key === '4' ? C.chartGreen : m2.key === '3' ? C.blue : m2.key === '2' ? C.amber : C.red
      dot(l1x + 3, ly + 3.5, color, 2.8)
      text(m2.label, l1x + 12, ly, { size: 7, color: C.text, lineBreak: false, width: 76, ellipsis: true })
      text(String(m2.count), l1x + 88, ly, { size: 7, font: 'Helvetica-Bold', color: C.text, width: 14, align: 'right', lineBreak: false })
      text(`${m2.pct}%`, l1x + 112, ly, { size: 7, color: C.label, width: 14, align: 'right', lineBreak: false })
    })

    // divider between groups (clear of both donut rings)
    doc.rect(M + 258, y + 28, 0.7, cardH - 56).fill(C.divider)

    // Donut 2: recent
    const d2x = M + 305
    if (hasLp) {
      donut(d2x, cy, 33, 24, [{ pct: stats.recentPct, color: C.navy }], `${stats.recentPct}%`, 'recent')
    } else {
      donut(d2x, cy, 33, 24, [], '—', 'recent')
    }
    const l2x = M + 352
    text('Last performed', l2x, y + 30, { size: 7, font: 'Helvetica-Bold', color: C.label, lineBreak: false })
    const lpColors: Record<string, string> = { '3m': C.navy, '6m': C.blueGray, '6m+': C.grayIcon, na: C.paleGray }
    stats.lastPerformedMix.forEach((m2, i) => {
      const ly = y + 42 + i * 13
      dot(l2x + 3, ly + 3.5, lpColors[m2.key] ?? C.paleGray, 2.8)
      text(m2.label, l2x + 12, ly, { size: 7, color: C.text, lineBreak: false, width: 76, ellipsis: true })
      text(String(m2.count), l2x + 88, ly, { size: 7, font: 'Helvetica-Bold', color: C.text, width: 14, align: 'right', lineBreak: false })
      text(`${m2.pct}%`, l2x + 112, ly, { size: 7, color: C.label, width: 14, align: 'right', lineBreak: false })
    })
    y += cardH + 12
  }

  // ── Category overview + rating scale + last performed (one mint card) ──
  {
    const rows = stats.categories.filter((c) => c.total > 0)
    const legendH = 58 // two legend rows + footnote
    const cardH = 46 + rows.length * 22 + 14 + legendH
    doc.roundedRect(M, y, CW, cardH, 10).fill(C.mint)
    text('Category overview', M + 14, y + 12, { size: 11, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
    text('Average rating and recent activity by category', M, y + 14, { width: CW - 16, align: 'right', size: 7.5, color: C.label, lineBreak: false })
    rows.forEach((c, i) => {
      const ry = y + 36 + i * 22
      let cat = c.category
      while (textW(cat, 8, 'Helvetica-Bold') > 145 && cat.length > 4) cat = cat.slice(0, -2)
      if (cat !== c.category) cat = cat.slice(0, -1) + '…'
      text(cat, M + 14, ry, { size: 8, font: 'Helvetica-Bold', color: C.text, lineBreak: false })
      progressBar(M + 170, ry + 1, 112, (c.avg ?? 0) / 4)
      text(c.avg != null ? c.avg.toFixed(1) : '—', M + 296, ry, { size: 9, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
      text(`${c.proficient}/${c.total} Proficient`, M + 318, ry, { size: 7, color: C.label, lineBreak: false })
      if (hasLp) text(`${c.recent}/${c.total} recent`, M + 404, ry, { size: 7, color: C.label, lineBreak: false, width: 112, align: 'right' })
    })
    let ly0 = y + 36 + rows.length * 22 + 10
    if (hasLp) {
      text('Recent means last performed within 3 months.', M + 14, ly0, { size: 6.5, color: C.label, lineBreak: false })
      ly0 += 14
    }
    // rating scale legend row
    text('Rating scale', M + 14, ly0 + 2, { size: 8, font: 'Helvetica-Bold', color: C.text, lineBreak: false })
    let lx = M + 14 + textW('Rating scale', 8, 'Helvetica-Bold') + 14
    const ringByValue: Record<number, string> = { 1: C.red, 2: C.amber, 3: C.blue, 4: C.green }
    for (const l of SCALE_LEGEND) {
      badge(lx + 6, ly0 + 5, l.value, ringByValue[l.value])
      text(l.label, lx + 15, ly0 + 2, { size: 7, color: C.label, lineBreak: false })
      lx += 15 + textW(l.label, 7) + 12
    }
    ly0 += 20
    // last performed pills row
    text('Last performed', M + 14, ly0 + 3, { size: 8, font: 'Helvetica-Bold', color: C.text, lineBreak: false })
    let lx2 = M + 14 + textW('Last performed', 8, 'Helvetica-Bold') + 14
    for (const o of LAST_PERFORMED_OPTIONS) {
      const w = pill(lx2, ly0, o.label, o.value === '3m' ? C.navy : o.value === '6m' ? C.blueGray : o.value === '6m+' ? C.lpGrayBg : C.pillGrayBg,
        o.value === '3m' || o.value === '6m' ? '#FFFFFF' : o.value === '6m+' ? '#55645C' : C.muted, 6.5, { clock: true })
      lx2 += w + 8
    }
    y += cardH + 14
  }

  // ── Skills table (rows sit directly on the white page, as in the reference) ──
  // Keep-together pagination: a category never starts at the very bottom of a
  // page (group bar + <3 rows), and a split always leaves ≥2 rows on each side,
  // so no page opens or closes with a single orphaned skill row. The header row
  // is drawn per page, lazily, only when a category actually renders on it —
  // never stranded above an empty area.
  inTable = true
  const BAR_H = 19, ROW_H = 16.5
  const renderCatBar = (label: string) => {
    doc.roundedRect(M + 2, y, CW - 4, 16, 4).fill(C.mintBar)
    text(label, M + 10, y + 4.5, { size: 7.5, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
    y += BAR_H
  }
  const renderRow = (s: { name: string; questionType: string }) => {
    ensure(ROW_H + 3)
    const v = ratings[s.name] as RatingValue | undefined
    const lp = lastPerformed?.[s.name]
    // name
    let nm = s.name
    while (textW(nm, 8) > 280 && nm.length > 4) nm = nm.slice(0, -2)
    if (nm !== s.name) nm = nm.slice(0, -1) + '…'
    text(nm, M + 12, y + 4, { size: 8, color: C.text, lineBreak: false })
    // rating cell — badge + label pill share one left edge, centered under the header
    if (typeof v === 'number') {
      const tone = ratingTone(v)!
      badge(M + 357, y + 8, v, tone.ring)
      pill(M + 366, y + 1.5, ratingShortLabel(v), tone.pillBg, tone.pillFg)
    } else if (v === 'na') {
      pill(M + 366, y + 1.5, 'N/A', C.pillGrayBg, C.label)
    } else {
      text('—', M + 378, y + 4, { width: 20, align: 'center', size: 8, color: C.paleGray, lineBreak: false })
    }
    // last performed cell — right edge at the shared content gutter (M + CW - 16)
    if (hasLp && lp) {
      const t = lpTone(lp)
      const label = LAST_PERFORMED_OPTIONS.find((o) => o.value === lp)?.label ?? '—'
      pill(M + CW - 16, y + 1.5, label, t.bg, t.fg, 6.5, { right: true, clock: true })
    } else {
      text('—', M + CW - 32, y + 4, { width: 16, align: 'right', size: 8, color: C.paleGray, lineBreak: false })
    }
    // row divider
    doc.moveTo(M + 8, y + 16).lineTo(M + CW - 8, y + 16).lineWidth(0.4).strokeColor(C.rowLine).stroke()
    y += ROW_H
  }
  for (const cat of data.items) {
    const ratedSkills = cat.skills.filter((s) => s.questionType === 'rating_1_4')
    if (ratedSkills.length === 0) continue
    tableCategory = cat.category
    // The header row consumes 27pt the first time it is drawn on a page —
    // the fit math must include it, or the last row spills onto the next
    // page as an orphan under a "(continued)" band.
    const headerH = pageWithHeader === doc.page ? 0 : 27
    const catH = headerH + BAR_H + ratedSkills.length * ROW_H
    if (y + catH <= BOTTOM) {
      drawTableHeader()
      renderCatBar(cat.category)
      for (const s of ratedSkills) renderRow(s)
      continue
    }
    // Optimal split: fill this page as far as possible while leaving at
    // least 2 rows to continue on the next page (and at least 3 here).
    const fitMax = Math.max(0, Math.floor((BOTTOM - y - headerH - BAR_H) / ROW_H))
    const k = Math.min(fitMax, ratedSkills.length - 2)
    if (k >= 3) {
      drawTableHeader()
      renderCatBar(cat.category)
      for (const s of ratedSkills.slice(0, k)) renderRow(s)
      newPage() // inTable → repeats the header + "(continued)" band
      for (const s of ratedSkills.slice(k)) renderRow(s)
    } else {
      // Fresh page for the whole category. tableCategory must be cleared
      // first: newPage() (inside ensure) would otherwise draw a "(continued)"
      // band here too, stacking a duplicate band above the plain one.
      tableCategory = null
      ensure(catH)
      tableCategory = cat.category
      renderCatBar(cat.category)
      for (const s of ratedSkills) renderRow(s)
    }
  }
  inTable = false
  tableCategory = null
  y += 10

  // ── Additional questions ──
  ensure(80)
  {
    doc.roundedRect(M + 2, y, CW - 4, 20, 5).fill(C.band1)
    text('Additional questions', M + 12, y + 6.5, { size: 8, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
    text('Answer', M + 12, y + 6.5, { width: CW - 28, align: 'right', size: 8, font: 'Helvetica-Bold', color: C.white, lineBreak: false })
    y += 24

    for (const sec of ADDITIONAL_SECTIONS) {
      ensure(64)
      doc.roundedRect(M + 2, y, CW - 4, 16, 4).fill(C.mintBar)
      text(sec.section, M + 10, y + 4.5, { size: 7.5, font: 'Helvetica-Bold', color: C.greenDeep, lineBreak: false })
      y += 21
      for (const q of sec.questions) {
        const a = data.additional?.answers?.[q.id]
        if (q.type === 'yes_no') {
          ensure(18)
          text(q.text, M + 12, y + 4, { size: 8, color: C.text, lineBreak: false, width: 360 })
          if (a === 'yes') {
            pill(M + CW - 16, y + 2, 'Yes', C.greenDeep, '#FFFFFF', 6.5, { right: true, dot: true })
          } else if (a === 'no') {
            pill(M + CW - 16, y + 2, 'No', '#475569', '#FFFFFF', 6.5, { right: true })
          } else {
            text('—', M + CW - 32, y + 4, { width: 16, align: 'right', size: 8, color: C.paleGray, lineBreak: false })
          }
          doc.moveTo(M + 8, y + 16).lineTo(M + CW - 8, y + 16).lineWidth(0.4).strokeColor(C.rowLine).stroke()
          y += 16.5
        } else {
          // label + answer box with green left accent
          const val = typeof a === 'string' && a.trim() ? a : ''
          const lines = val ? doc.font('Helvetica-Bold').fontSize(8).heightOfString(val, { width: CW - 52 }) / 9.2 : 0
          const boxH = Math.max(17, 10 + Math.ceil(lines) * 10)
          ensure(22 + boxH)
          text(q.text, M + 12, y + 2, { size: 6.8, color: C.label, lineBreak: false, width: CW - 30 })
          y += 12
          doc.roundedRect(M + 12, y, CW - 24, boxH, 5).fill(C.white).stroke('#CCCCCC')
          // accent bar clipped to the box's rounded corners
          doc.save()
          doc.roundedRect(M + 12, y, CW - 24, boxH, 5).clip()
          doc.rect(M + 12, y, 3.5, boxH).fill(C.greenDeep)
          doc.restore()
          if (val) {
            text(val, M + 24, y + (boxH - 8) / 2 - 1, { size: 8, font: 'Helvetica-Bold', color: C.text, width: CW - 52, lineBreak: true })
          } else {
            text('—', M + 24, y + (boxH - 8) / 2 - 1, { size: 8, color: C.paleGray, lineBreak: false })
          }
          y += boxH + 8
        }
      }
    }
  }

  // ── Candidate attestation ──
  {
    const items = [ATTESTATION.confirm, ATTESTATION.agree]
    const itemH = items.map((item) =>
      Math.max(12, Math.ceil(doc.font('Helvetica').fontSize(7.5).heightOfString(item, { width: CW - 60 }) / 9.2) * 9.5 + 4))
    const itemsH = itemH.reduce((a, b) => a + b, 0)
    // heading(12+intro 15) + items + gap + signature block (36+12) — never overlaps
    const cardH = Math.max(128, itemsH + 100)
    ensure(cardH + 8)
    doc.roundedRect(M, y, CW, cardH, 10).fill(C.mintSoft)
    // green spine, clipped to the card's rounded corners
    doc.save()
    doc.roundedRect(M, y, CW, cardH, 10).clip()
    doc.rect(M, y, 4, cardH).fill(C.green)
    doc.restore()
    text('Candidate attestation', M + 16, y + 12, { size: 11, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
    text(ATTESTATION.intro, M + 16, y + 27, { size: 7.5, color: C.label, lineBreak: false })
    // checkbox items
    let iy = y + 42
    items.forEach((item, idx) => {
      doc.roundedRect(M + 16, iy + 1, 10, 10, 2.5).fill(C.greenDeep)
      // white check
      doc.moveTo(M + 18.4, iy + 6).lineTo(M + 20.2, iy + 8.2).lineTo(M + 24, iy + 3.4)
        .lineWidth(1.4).strokeColor('#FFFFFF').stroke()
      text(item, M + 34, iy, { size: 7.5, color: C.text, width: CW - 60 })
      iy += itemH[idx]
    })
    // signature columns — shared baselines; right column ends at the card's right padding
    const sy = y + cardH - 46
    const c1x = M + 16, c1w = 200
    const c2x = M + 232, c2w = 156
    const c3x = M + 396, c3w = 120
    // 1. signature (script) — baseline aligned with the printed values below
    doc.moveTo(c1x, sy + 24).lineTo(c1x + c1w - 10, sy + 24).lineWidth(0.6).strokeColor('#999999').stroke()
    text(data.signedName ?? data.printedName ?? name, c1x, sy + 5, { size: 13, font: 'Helvetica-Oblique', color: C.heading, lineBreak: false, width: c1w - 10 })
    text('Candidate signature', c1x, sy + 27, { size: 6.5, color: C.label, lineBreak: false })
    text('Signed electronically', c1x + c1w - 10 - textW('Signed electronically', 6.5, 'Helvetica-Bold'), sy + 27, { size: 6.5, font: 'Helvetica-Bold', color: C.greenDeep, lineBreak: false })
    // 2. printed name
    doc.moveTo(c2x, sy + 24).lineTo(c2x + c2w - 12, sy + 24).lineWidth(0.6).strokeColor(C.divider).stroke()
    text(data.printedName ?? data.signedName ?? name, c2x, sy + 7.8, { size: 9, font: 'Helvetica-Bold', color: C.text, lineBreak: false, width: c2w - 12 })
    text('Printed name', c2x, sy + 27, { size: 6.5, color: C.label, lineBreak: false })
    // 3. date
    doc.moveTo(c3x, sy + 24).lineTo(c3x + c3w, sy + 24).lineWidth(0.6).strokeColor(C.divider).stroke()
    text(fmtDate(data.completedAt), c3x, sy + 7.8, { size: 9, font: 'Helvetica-Bold', color: C.text, lineBreak: false, width: c3w })
    text('Date', c3x, sy + 27, { size: 6.5, color: C.label, lineBreak: false })
    y += cardH + 12
  }

  // ── Disclaimer ──
  ensure(40)
  {
    const discl = `Self-reported assessment. Completed once by the candidate and valid for ${VALIDITY_DAYS} days. Access was granted to the recruiter who requested this checklist, through ${CHECKLIST_BRAND.name}.`
    doc.font('Helvetica').fontSize(7)
    const dh = doc.heightOfString(discl, { width: CW })
    text(discl, M, y, { size: 7, color: C.muted, width: CW })
    y += dh + 5
  }
  const genDate = fmtDate(data.completedAt)
  const genW = textW(`Generated ${genDate} by `, 7) + textW(CHECKLIST_BRAND.name, 7, 'Helvetica-Bold') + textW('.', 7)
  text(`Generated ${genDate} by `, M, y, { size: 7, color: C.muted, lineBreak: false })
  text(CHECKLIST_BRAND.name, M + textW(`Generated ${genDate} by `, 7), y, { size: 7, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
  text('.', M + genW - textW('.', 7), y, { size: 7, color: C.muted, lineBreak: false })

  // ── Footers on every page ──
  const range = doc.bufferedPageRange()
  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i)
    doc.moveTo(M, 754).lineTo(PAGE_W - M, 754).lineWidth(0.6).strokeColor(C.divider).stroke()
    text(CHECKLIST_BRAND.name, M, 760, { size: 7.5, font: 'Helvetica-Bold', color: C.heading, lineBreak: false })
    text(`Skills Checklist: ${runningTitle}`, M + textW(CHECKLIST_BRAND.name, 7.5, 'Helvetica-Bold') + 12, 760.3, { size: 7, color: '#55645C', lineBreak: false, width: 360 })
    text(`Page ${i + 1} of ${range.count}`, M, 760.3, { width: CW, align: 'right', size: 7, color: '#55645C', lineBreak: false })
  }

  doc.end()

  // Collect the output stream into a Buffer
  const chunks: Buffer[] = []
  await new Promise<void>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c))
    doc.on('end', () => resolve())
    doc.on('error', (e: Error) => reject(e))
  })
  return Buffer.concat(chunks)
}
