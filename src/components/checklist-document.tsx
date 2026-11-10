'use client'

// The VaultVerify Skills Checklist document — an exact visual replica of the
// reference PDF, used for the recruiter "view results" screen and the
// superadmin read-only view. The server-side PDF export
// (src/lib/checklist-pdf.ts) mirrors this same design 1:1.
//
// Layout (reference "Skills-Checklist-LEADERSHIP-sswws.pdf"):
//   • dark teal brand band with logo, VaultVerify + tagline, right title
//   • profile card: avatar initial, name, role pills, meta columns
//   • "Summary at a glance": rating-mix donut + recent donut with legends
//   • "Category overview": mint card, progress bars, proficient/recent counts
//   • rating-scale legend + last-performed pills
//   • skills table: teal header, mint groups, ring badges + label pills,
//     navy/grey last-performed pills
//   • additional questions: teal header, mint sections, Yes/No pills,
//     green-accented text answers
//   • candidate attestation: mint card, green left border, checkboxes,
//     signature columns • footer disclaimer
import { useMemo } from 'react'
import {
  CHECKLIST_BRAND, VALIDITY_DAYS, SCALE_LEGEND, LAST_PERFORMED_OPTIONS,
  ADDITIONAL_SECTIONS, ATTESTATION, summarizeChecklist,
  lastPerformedLabel, ratingShortLabel,
  type ChecklistSummaryStats, type Ratings, type LastPerformed, type RatingValue,
} from '@/lib/skills-shared'
import type { ChecklistDetail } from '@/lib/types'
import { CheckCircle2 } from 'lucide-react'

type Props = {
  data: ChecklistDetail
  className?: string
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// ─── VaultVerify palette (extracted from the reference PDF) ──────────
const RATING_COLORS: Record<number, { ring: string; pillBg: string; pillFg: string; dot: string }> = {
  4: { ring: '#2E9E5B', pillBg: '#DFF2E3', pillFg: '#2E7D4F', dot: '#34A853' },
  3: { ring: '#3B82F6', pillBg: '#E3EDFB', pillFg: '#2F6BC4', dot: '#3B82F6' },
  2: { ring: '#F5A623', pillBg: '#FDF1DC', pillFg: '#9A6200', dot: '#F5A623' },
  1: { ring: '#E5484D', pillBg: '#FDEAEA', pillFg: '#C13A3E', dot: '#E5484D' },
}
const LP_COLORS: Record<string, { dot: string }> = {
  '3m': { dot: '#1E3A5F' }, '6m': { dot: '#5B7A99' }, '6m+': { dot: '#9AA5AB' }, na: { dot: '#C9D2D6' },
}

function ratingTone(v: RatingValue) {
  if (typeof v === 'number') return RATING_COLORS[v] ?? null
  return null
}

function avgColor(v: number | null): string {
  if (v == null) return '#8CA096'
  if (v < 2) return '#E5484D'
  if (v < 3) return '#9A6200'
  if (v < 3.5) return '#2F6BC4'
  return '#2E7D4F'
}

export function ChecklistDocument({ data, className = '' }: Props) {
  const ratings = (data.ratings ?? {}) as Ratings
  const lastPerformed = (data.lastPerformed ?? null) as LastPerformed | null
  const hasLp = !!lastPerformed && Object.keys(lastPerformed).length > 0

  const stats: ChecklistSummaryStats = useMemo(
    () => summarizeChecklist(data.items, ratings, lastPerformed),
    [data.items, ratings, lastPerformed],
  )

  const parts = data.templateLabel.split('|').map((p) => p.trim())
  const profession = parts.length === 3 ? parts[0] : ''
  const jobTitle = parts.length === 3 ? parts[1] : ''
  const specialty = parts.length === 3 ? parts[2] : ''
  const name = data.candidateName ?? 'Candidate'
  const experience = data.additional?.experienceYears
  const initial = name.trim().charAt(0).toUpperCase() || '?'

  return (
    <div id="checklist-doc" className={`bg-white rounded-2xl shadow-[0_12px_40px_rgba(15,61,51,0.10)] ${className}`}>
      <style>{`
        @media print {
          @page { size: letter; margin: 10mm }
          body { background: #fff !important }
          .no-print { display: none !important }
          #checklist-doc { box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important }
          .doc-avoid-break { break-inside: avoid; page-break-inside: avoid }
        }
      `}</style>

      {/* ─── Brand band ─────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-t-2xl px-6 sm:px-9 pt-6 pb-5 text-white"
        style={{ background: 'linear-gradient(135deg,#0E3B32 0%,#145043 100%)' }}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <img src="/vaultverify-logo-128.png" alt="VaultVerify logo" width={46} height={46} className="shrink-0" />
            <div className="min-w-0">
              <div className="text-[20px] font-extrabold tracking-tight leading-none">{CHECKLIST_BRAND.name}</div>
              <div className="text-[10px] text-[#A8D5B5] mt-1.5 font-medium">{CHECKLIST_BRAND.tagline}</div>
            </div>
          </div>
          <div className="text-right shrink-0">
            <div className="text-[16px] font-extrabold tracking-tight leading-none">Skills Checklist</div>
            <div className="text-[9.5px] text-[#A8D5B5] mt-1.5">Self-assessed — not independently verified</div>
          </div>
        </div>
        {/* lime accent line */}
        <div className="absolute left-0 right-0 bottom-0 h-[3px]" style={{ background: '#8BC34A' }} />
      </div>

      <div className="px-5 sm:px-7 py-5 space-y-4" style={{ background: '#FFFFFF' }}>
        {/* ─── Profile card ─────────────────────────────────────── */}
        <div className="doc-avoid-break bg-white rounded-xl p-5 shadow-[0_1px_4px_rgba(20,50,45,0.12)]">
          <div className="flex gap-4 flex-wrap">
            <div className="flex gap-3.5 min-w-[210px]">
              <div className="w-[46px] h-[46px] rounded-full flex items-center justify-center text-white text-[19px] font-extrabold shrink-0"
                style={{ background: '#14503F' }}>
                {initial}
              </div>
              <div className="min-w-0">
                <div className="text-[17px] font-extrabold tracking-tight leading-tight" style={{ color: '#0F3D33' }}>{name}</div>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {jobTitle && (
                    <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full" style={{ background: '#E3F3E6', color: '#2E7D4F' }}>{jobTitle}</span>
                  )}
                  {specialty && (
                    <span className="text-[9.5px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide" style={{ background: '#E3F3E6', color: '#2E7D4F' }}>{specialty}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="hidden sm:block w-px self-stretch" style={{ background: '#E0E5E2' }} />
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-7 gap-y-3 flex-1 min-w-[260px]">
              <MetaItem label="Email" value={data.candidateEmail ?? '—'} />
              <MetaItem label="Completed" value={fmtDate(data.completedAt)} />
              <MetaItem label="Valid until" value={data.validUntil ? `${fmtDate(data.validUntil)} (${VALIDITY_DAYS} days)` : '—'} />
              <MetaItem label="Self-reported experience" value={experience != null ? `${experience} yr(s)` : '—'} />
              <MetaItem label="Profession" value={profession || '—'} />
            </div>
          </div>
        </div>

        {/* ─── Summary at a glance ───────────────────────────────── */}
        <div className="doc-avoid-break bg-white rounded-xl p-5 shadow-[0_1px_4px_rgba(20,50,45,0.12)]">
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="text-[13px] font-extrabold m-0" style={{ color: '#0F3D33' }}>Summary at a glance</h2>
            <span className="text-[10px] font-semibold" style={{ color: '#66756E' }}>{stats.skillsAssessed} skills assessed</span>
          </div>

          <div className="mt-4 grid sm:grid-cols-2 gap-x-6 gap-y-5">
            {/* Donut 1 — rating mix */}
            <div className="flex items-center gap-4">
              <Donut
                segments={stats.ratingMix.map((m) => ({
                  pct: m.pct,
                  color: RATING_COLORS[Number(m.key)]?.dot ?? '#D7DDE0',
                }))}
                track="#D7DDE0"
                center={stats.avg != null ? stats.avg.toFixed(1) : '—'}
                sub="avg of 4"
              />
              <div className="min-w-0 flex-1">
                <div className="text-[9px] font-extrabold uppercase tracking-[0.7px] mb-2" style={{ color: '#66756E' }}>Rating mix</div>
                <div className="space-y-1.5">
                  {stats.ratingMix.map((m) => (
                    <MixRow key={m.key} row={m} dot={RATING_COLORS[Number(m.key)]?.dot ?? '#C9D2D6'} />
                  ))}
                </div>
              </div>
            </div>
            {/* Donut 2 — recent */}
            {hasLp && (
              <div className="flex items-center gap-4 sm:border-l sm:pl-6" style={{ borderColor: '#E0E5E2' }}>
                <Donut
                  segments={[{ pct: stats.recentPct, color: '#1E3A5F' }]}
                  track="#DDE3E0"
                  center={`${stats.recentPct}%`}
                  sub="recent"
                />
                <div className="min-w-0 flex-1">
                  <div className="text-[9px] font-extrabold uppercase tracking-[0.7px] mb-2" style={{ color: '#66756E' }}>Last performed</div>
                  <div className="space-y-1.5">
                    {stats.lastPerformedMix.map((m) => (
                      <MixRow key={m.key} row={m} dot={LP_COLORS[m.key]?.dot ?? '#C9D2D6'} />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ─── Category overview + rating scale legends (one mint card) ── */}
        <div className="doc-avoid-break rounded-xl p-5" style={{ background: '#EDF6F1' }}>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <h2 className="text-[13px] font-extrabold m-0" style={{ color: '#0F3D33' }}>Category overview</h2>
            <span className="text-[10px] font-semibold" style={{ color: '#66756E' }}>Average rating and recent activity by category</span>
          </div>
          <div className="mt-3.5 space-y-2.5">
            {stats.categories.filter((c) => c.total > 0).map((c) => (
              <div key={c.category} className="flex items-center gap-3 flex-wrap">
                <div className="w-[180px] shrink-0 text-[11px] font-bold truncate" style={{ color: '#333B37' }} title={c.category}>{c.category}</div>
                <div className="flex-1 min-w-[90px] max-w-[220px] h-[8px] rounded-full overflow-hidden" style={{ background: '#D3DDD6' }}>
                  <div className="h-full rounded-full" style={{ width: `${((c.avg ?? 0) / 4) * 100}%`, background: '#34A853' }} />
                </div>
                <div className="text-[12px] font-extrabold tabular-nums w-7 text-right" style={{ color: avgColor(c.avg) }}>
                  {c.avg != null ? c.avg.toFixed(1) : '—'}
                </div>
                <span className="text-[10px] font-semibold tabular-nums" style={{ color: '#66756E' }}>{c.proficient}/{c.total} Proficient</span>
                {hasLp && (
                  <span className="text-[10px] font-semibold tabular-nums ml-auto" style={{ color: '#66756E' }}>{c.recent}/{c.total} recent</span>
                )}
              </div>
            ))}
          </div>
          {hasLp && (
            <p className="text-[9.5px] italic mt-3.5 mb-0" style={{ color: '#8CA096' }}>Recent means last performed within 3 months.</p>
          )}

          <div className="mt-4 pt-4" style={{ borderTop: '1px solid rgba(20,50,45,0.10)' }}>
            <div className="flex flex-wrap gap-x-5 gap-y-2.5 items-center">
              <span className="text-[11px] font-extrabold" style={{ color: '#333B37' }}>Rating scale</span>
              {SCALE_LEGEND.map((l) => (
                <span key={l.value} className="inline-flex items-center gap-1.5 text-[11px] font-medium" style={{ color: '#66756E' }}>
                  <RingBadge n={l.value} color={RATING_COLORS[l.value].ring} />
                  {l.label}
                </span>
              ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2.5 items-center mt-2.5">
              <span className="text-[11px] font-extrabold" style={{ color: '#333B37' }}>Last performed</span>
              {LAST_PERFORMED_OPTIONS.map((o) => (
                <LpPill key={o.value} value={o.value} label={o.label} />
              ))}
            </div>
          </div>
        </div>

        {/* ─── Skills table ──────────────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(20,50,45,0.12)]">
          <div className="grid grid-cols-[minmax(0,1fr)_150px_140px] gap-3 items-center px-5 py-2.5 text-[10.5px] font-bold text-white"
            style={{ background: '#0E3B32' }}>
            <span>Skill</span>
            <span className="text-center">Rating</span>
            <span className="text-right">Last performed</span>
          </div>
          {data.items.map((c) => {
            const rated = c.skills.filter((s) => s.questionType === 'rating_1_4')
            if (rated.length === 0) return null
            return (
              <div key={c.category}>
                <div className="doc-avoid-break px-5 py-2 text-[10.5px] font-extrabold" style={{ background: '#E8F3EC', color: '#0F3D33' }}>
                  {c.category}
                </div>
                {rated.map((s, i) => {
                  const v = ratings[s.name] as RatingValue | undefined
                  const lp = lastPerformed?.[s.name]
                  const tone = ratingTone(v ?? ('na' as RatingValue))
                  return (
                    <div key={s.name}
                      className="doc-avoid-break grid grid-cols-[minmax(0,1fr)_150px_140px] gap-3 items-center px-5 py-2"
                      style={{ borderTop: i === 0 ? 'none' : '1px solid #ECEFEA' }}>
                      <span className="text-[12px] font-medium leading-snug" style={{ color: '#333B37' }}>{s.name}</span>
                      <span className="flex items-center justify-center gap-1.5">
                        {typeof v === 'number' && tone ? (
                          <>
                            <RingBadge n={v} color={tone.ring} />
                            <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                              style={{ background: tone.pillBg, color: tone.pillFg }}>{ratingShortLabel(v)}</span>
                          </>
                        ) : v === 'na' ? (
                          <span className="text-[9.5px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#EEF1F2', color: '#66756E' }}>N/A</span>
                        ) : (
                          <span className="text-[11px]" style={{ color: '#C9D2D6' }}>—</span>
                        )}
                      </span>
                      <span className="flex justify-end">
                        {hasLp && lp ? <LpPill value={lp} label={lastPerformedLabel(lp)} /> : (
                          <span className="text-[11px]" style={{ color: '#C9D2D6' }}>—</span>
                        )}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>

        {/* ─── Additional questions ──────────────────────────────── */}
        <div className="bg-white rounded-xl overflow-hidden shadow-[0_1px_4px_rgba(20,50,45,0.12)]">
          <div className="flex items-center justify-between px-5 py-2.5 text-[10.5px] font-bold text-white"
            style={{ background: '#0E3B32' }}>
            <span>Additional questions</span>
            <span>Answer</span>
          </div>
          {ADDITIONAL_SECTIONS.map((sec) => (
            <div key={sec.section}>
              <div className="px-5 py-2 text-[10.5px] font-extrabold" style={{ background: '#E8F3EC', color: '#2E7D32' }}>
                {sec.section}
              </div>
              {sec.questions.map((q, i) => {
                const a = data.additional?.answers?.[q.id]
                return (
                  <div key={q.id}
                    className="doc-avoid-break grid grid-cols-[minmax(0,1fr)_170px] gap-3 items-center px-5 py-2.5"
                    style={{ borderTop: i === 0 ? 'none' : '1px solid #ECEFEA' }}>
                    <span className="text-[12px] font-medium leading-snug pr-2" style={{ color: '#333B37' }}>{q.text}</span>
                    <span className="flex justify-end">
                      {q.type === 'yes_no' ? (
                        a === 'yes' ? (
                          <span className="inline-flex items-center gap-1.5 text-[9.5px] font-bold text-white px-3 py-1 rounded-full"
                            style={{ background: '#2E7D32' }}>
                            <span className="w-[7px] h-[7px] rounded-full bg-white" />Yes
                          </span>
                        ) : a === 'no' ? (
                          <span className="text-[9.5px] font-bold px-3 py-1 rounded-full text-white" style={{ background: '#475569' }}>No</span>
                        ) : (
                          <span className="text-[11px]" style={{ color: '#C9D2D6' }}>—</span>
                        )
                      ) : typeof a === 'string' && a.trim() ? (
                        <span className="text-[11px] font-bold px-3 py-1.5 rounded-lg w-full"
                          style={{ background: '#FFFFFF', border: '1px solid #CCCCCC', borderLeft: '3.5px solid #2E7D32', color: '#333B37' }}>
                          {a}
                        </span>
                      ) : (
                        <span className="text-[11px]" style={{ color: '#C9D2D6' }}>—</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* ─── Candidate attestation ─────────────────────────────── */}
          <div className="doc-avoid-break rounded-xl px-5 py-4" style={{ background: '#EDF5EF', borderLeft: '4px solid #4CAF50' }}>
            <div className="text-[13px] font-extrabold" style={{ color: '#0F3D33' }}>{ATTESTATION.heading}</div>
            <p className="text-[10px] italic mt-1 mb-3" style={{ color: '#7A8A80' }}>{ATTESTATION.intro}</p>
            <div className="space-y-2">
              {[ATTESTATION.confirm, ATTESTATION.agree].map((item) => (
                <div key={item} className="flex gap-2.5 items-start">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-[1px]" style={{ color: '#2E7D32' }} />
                  <p className="text-[11.5px] leading-relaxed m-0" style={{ color: '#333B37' }}>{item}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_0.8fr] gap-6 items-end">
              <div>
                <div className="text-[24px] leading-none pb-1.5 border-b border-[#999999]"
                  style={{ fontFamily: "'Segoe Script', 'Bradley Hand', 'Brush Script MT', 'Comic Sans MS', cursive", color: '#0F3D33' }}>
                  {data.signedName ?? data.printedName ?? name}
                </div>
                <div className="flex items-center justify-between mt-1">
                  <span className="text-[9px] font-semibold" style={{ color: '#66756E' }}>Candidate signature</span>
                  <span className="text-[9px] font-bold" style={{ color: '#2E7D32' }}>Signed electronically</span>
                </div>
              </div>
              <div>
                <div className="text-[12px] font-bold pb-1.5 border-b border-[#E0E5E2]" style={{ color: '#333B37' }}>
                  {data.printedName ?? data.signedName ?? name}
                </div>
                <div className="text-[9px] font-semibold mt-1" style={{ color: '#66756E' }}>Printed name</div>
              </div>
              <div>
                <div className="text-[12px] font-bold pb-1.5 border-b border-[#E0E5E2] tabular-nums" style={{ color: '#333B37' }}>
                  {fmtDate(data.completedAt)}
                </div>
                <div className="text-[9px] font-semibold mt-1" style={{ color: '#66756E' }}>Date</div>
              </div>
            </div>
          </div>

        {/* ─── Document footer ───────────────────────────────────── */}
        <div className="px-1 pt-1 pb-2">
          <p className="text-[10px] leading-relaxed m-0" style={{ color: '#8CA096' }}>
            Self-reported assessment. Completed once by the candidate and valid for {VALIDITY_DAYS} days.{' '}
            Access was granted to the recruiter who requested this checklist, through {CHECKLIST_BRAND.name}.
          </p>
          <p className="text-[10px] mt-1 mb-0" style={{ color: '#8CA096' }}>
            Generated {fmtDate(data.completedAt)} by <span className="font-bold" style={{ color: '#0F3D33' }}>{CHECKLIST_BRAND.name}</span>.
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Small building blocks ──────────────────────────────────────────

function MetaItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9.5px] font-bold" style={{ color: '#8CA096' }}>{label}</div>
      <div className="text-[11.5px] font-bold mt-0.5 truncate" style={{ color: '#333B37' }} title={value}>{value}</div>
    </div>
  )
}

function MixRow({ row, dot }: { row: { key: string; label: string; count: number; pct: number }; dot: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-[6px] h-[6px] rounded-full shrink-0" style={{ background: dot }} />
      <span className="text-[10.5px] font-medium flex-1 min-w-0 truncate" style={{ color: '#333B37' }}>{row.label}</span>
      <span className="text-[10.5px] font-extrabold tabular-nums" style={{ color: '#333B37' }}>{row.count}</span>
      <span className="text-[10px] font-semibold tabular-nums w-8 text-right" style={{ color: '#8CA096' }}>{row.pct}%</span>
    </div>
  )
}

// Circular numbered badge — colored ring with the number inside (reference style)
function RingBadge({ n, color }: { n: number; color: string }) {
  return (
    <span className="inline-flex items-center justify-center w-[17px] h-[17px] rounded-full shrink-0 text-[9px] font-extrabold tabular-nums"
      style={{ border: `1.5px solid ${color}`, color }}>
      {n}
    </span>
  )
}

// "Last performed" pill — navy (3m) / blue-gray (6m) / gray (6m+) / pale (N/A)
function LpPill({ value, label }: { value: string; label: string }) {
  const styles: Record<string, { bg: string; fg: string; icon: string }> = {
    '3m': { bg: '#1E3A5F', fg: '#FFFFFF', icon: '#FFFFFF' },
    '6m': { bg: '#5B7A99', fg: '#FFFFFF', icon: '#FFFFFF' },
    '6m+': { bg: '#E3E8EA', fg: '#55645C', icon: '#8CA096' },
    na: { bg: '#EEF1F2', fg: '#8CA096', icon: '#8CA096' },
  }
  const s = styles[value] ?? styles.na
  return (
    <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap"
      style={{ background: s.bg, color: s.fg }}>
      <svg width="8" height="8" viewBox="0 0 8 8" className="shrink-0">
        <circle cx="4" cy="4" r="3.1" fill="none" stroke={s.icon} strokeWidth="0.9" />
        <path d="M 4 2.2 V 4 L 5.4 4.6" fill="none" stroke={s.icon} strokeWidth="0.9" strokeLinecap="round" />
      </svg>
      {label}
    </span>
  )
}

// SVG donut chart with center text (prints identically to the PDF version)
function Donut({ segments, track, center, sub }: {
  segments: { pct: number; color: string }[]
  track: string
  center: string
  sub: string
}) {
  const size = 76, stroke = 11
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  // cumulative start offsets, computed purely before render
  const arcs = segments
    .filter((sg) => sg.pct > 0)
    .reduce<{ len: number; start: number; color: string }[]>((out, sg) => {
      const len = (circ * sg.pct) / 100
      const start = out.length > 0 ? out[out.length - 1].start + out[out.length - 1].len : 0
      out.push({ len, start, color: sg.color })
      return out
    }, [])
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {arcs.map((a, i) => (
          <circle key={i} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color} strokeWidth={stroke}
            strokeDasharray={`${a.len} ${circ - a.len}`} strokeDashoffset={-a.start}
            transform={`rotate(-90 ${size / 2} ${size / 2})`} />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
        <span className="text-[15px] font-extrabold tabular-nums leading-none" style={{ color: '#0F3D33' }}>{center}</span>
        <span className="text-[7.5px] font-semibold mt-1" style={{ color: '#66756E' }}>{sub}</span>
      </div>
    </div>
  )
}
