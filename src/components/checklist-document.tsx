'use client'

// The VaultVerify Skills Checklist document — an exact replica of the
// reference PDF: brand header, candidate meta (email / experience /
// completed / valid-until / source), "Summary at a glance" (rating mix +
// last-performed mix), category overview, rating-scale legend, the skill
// table (Skill | Rating | Last performed), additional questions, the
// candidate attestation with electronic signature, and the document footer.
// Used by the recruiter detail view and the superadmin read-only view;
// print styles make Ctrl+P / "Download PDF" produce the same document.
import { useMemo } from 'react'
import {
  CHECKLIST_BRAND, VALIDITY_DAYS, SCALE_LEGEND, LAST_PERFORMED_OPTIONS,
  ADDITIONAL_SECTIONS, ATTESTATION, summarizeChecklist,
  lastPerformedLabel, ratingShortLabel,
  type ChecklistSummaryStats, type Ratings, type LastPerformed, type RatingValue,
} from '@/lib/skills'
import type { ChecklistDetail } from '@/lib/types'
import { BadgeCheck, CheckCircle2, ShieldCheck } from 'lucide-react'

type Props = {
  data: ChecklistDetail
  className?: string
}

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'

// Rating tone (4 green / 3 blue / 2 amber / 1 red / N/A gray)
function ratingTone(v: RatingValue): { chip: string; text: string } {
  if (v === 'na') return { chip: 'bg-[#f1f5f9] border-[#e2e8f0] text-[#475569]', text: 'text-[#64748b]' }
  if (v === 'yes') return { chip: 'bg-[#dcfce7] border-[#86efac] text-[#15803d]', text: 'text-[#15803d]' }
  if (v === 'no') return { chip: 'bg-[#fee2e2] border-[#fca5a5] text-[#b91c1c]', text: 'text-[#b91c1c]' }
  switch (v) {
    case 4: return { chip: 'bg-[#dcfce7] border-[#86efac] text-[#15803d]', text: 'text-[#15803d]' }
    case 3: return { chip: 'bg-[#dbeafe] border-[#93c5fd] text-[#1d4ed8]', text: 'text-[#1d4ed8]' }
    case 2: return { chip: 'bg-[#fef3c7] border-[#fcd34d] text-[#b45309]', text: 'text-[#b45309]' }
    case 1: return { chip: 'bg-[#fee2e2] border-[#fca5a5] text-[#b91c1c]', text: 'text-[#b91c1c]' }
    default: return { chip: 'bg-[#f1f5f9] border-[#e2e8f0] text-[#475569]', text: 'text-[#475569]' }
  }
}

// Mix-bar color per row key
function mixBarTone(key: string): string {
  switch (key) {
    case '4': return 'linear-gradient(90deg,#34d399,#059669)'
    case '3': return 'linear-gradient(90deg,#60a5fa,#2563eb)'
    case '2': return 'linear-gradient(90deg,#fbbf24,#d97706)'
    case '1': return 'linear-gradient(90deg,#f87171,#dc2626)'
    case '3m': return 'linear-gradient(90deg,#34d399,#059669)'
    case '6m': return 'linear-gradient(90deg,#60a5fa,#2563eb)'
    case '6m+': return 'linear-gradient(90deg,#fbbf24,#d97706)'
    default: return 'linear-gradient(90deg,#cbd5e1,#94a3b8)'
  }
}

function avgColor(v: number | null): string {
  if (v == null) return 'text-[#94a3b8]'
  if (v < 2) return 'text-[#dc2626]'
  if (v < 3) return 'text-[#d97706]'
  if (v < 3.5) return 'text-[#2563eb]'
  return 'text-[#059669]'
}

export function ChecklistDocument({ data, className = '' }: Props) {
  const ratings = (data.ratings ?? {}) as Ratings
  const lastPerformed = (data.lastPerformed ?? null) as LastPerformed | null
  const hasLastPerformed = !!lastPerformed && Object.keys(lastPerformed).length > 0

  const stats: ChecklistSummaryStats = useMemo(
    () => summarizeChecklist(data.items, ratings, lastPerformed),
    [data.items, ratings, lastPerformed],
  )

  // "Nursing | RN | ICU" → { profession, jobTitle, specialty }
  const parts = data.templateLabel.split('|').map((p) => p.trim())
  const profession = parts.length === 3 ? parts[0] : ''
  const jobTitle = parts.length === 3 ? parts[1] : ''
  const specialty = parts.length === 3 ? parts[2] : ''
  const roleLine = [jobTitle, specialty].filter(Boolean).join(' ')
  const docTitle = `${data.candidateName ?? 'Candidate'}${jobTitle ? `, ${jobTitle}` : ''}${specialty ? ` (${specialty})` : ''}`

  const isManual = data.submittedVia === 'manual'
  const source = isManual ? 'Entered by recruiter' : data.submittedVia === 'link' ? 'Requested by a recruiter' : '—'
  const experience = data.additional?.experienceYears
  const expired = data.validUntil ? new Date(data.validUntil) < new Date() : false

  const initial = (data.candidateName ?? '?').trim().charAt(0).toUpperCase()

  return (
    <div id="checklist-doc" className={`bg-white rounded-3xl border border-[#eef1f6] shadow-[0_12px_40px_rgba(15,23,42,0.08)] ${className}`}>
      <style>{`
        @media print {
          @page { size: A4; margin: 12mm 12mm 16mm }
          body { background: #fff !important }
          .no-print { display: none !important }
          #checklist-doc { box-shadow: none !important; border: none !important; border-radius: 0 !important; margin: 0 !important; max-width: 100% !important }
          .print-break-before { page-break-before: always }
          .doc-avoid-break { break-inside: avoid; page-break-inside: avoid }
          .print-page-footer { display: flex !important }
        }
        .print-page-footer { display: none }
      `}</style>

      {/* Fixed page footer (print only) */}
      <div className="print-page-footer" aria-hidden>
        <span>{CHECKLIST_BRAND.name} Skills Checklist: {docTitle}</span>
      </div>

      {/* ─── Page 1 ─────────────────────────────────────────────── */}
      <div className="px-7 sm:px-10 pt-8 pb-7">

        {/* Brand */}
        <div className="flex items-center justify-between gap-4 pb-5 border-b border-[#eef1f6]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0"
              style={{ background: 'linear-gradient(135deg,#0a1628,#312e81)' }}>
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div>
              <div className="text-[17px] font-extrabold tracking-tight text-[#0f172a] leading-none">{CHECKLIST_BRAND.name}</div>
              <div className="text-[10.5px] text-[#94a3b8] mt-1">{CHECKLIST_BRAND.tagline}</div>
            </div>
          </div>
        </div>

        {/* Title + candidate */}
        <div className="mt-6">
          <h1 className="text-[26px] font-extrabold tracking-tight text-[#0f172a] m-0">Skills Checklist</h1>
          <p className="text-[12.5px] text-[#94a3b8] mt-1 mb-4">Self-assessed — not independently verified</p>

          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-white text-[17px] font-extrabold shrink-0"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)' }}>
              {initial}
            </div>
            <div className="min-w-0">
              <div className="text-[19px] font-extrabold tracking-tight text-[#0f172a] leading-tight truncate">{data.candidateName ?? 'Candidate'}</div>
              <div className="text-[13px] text-[#64748b] font-medium">{roleLine || data.title}</div>
            </div>
          </div>
        </div>

        {/* Meta */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-3.5 rounded-2xl border border-[#eef1f6] bg-[#f8fafc] px-5 py-4">
          <MetaItem label="Email" value={data.candidateEmail ?? '—'} />
          <MetaItem label="Self-reported experience" value={experience != null ? `${experience} yr(s)` : '—'} />
          <MetaItem label="Completed" value={fmtDate(data.completedAt)} />
          <MetaItem label="Valid until" value={
            data.validUntil
              ? `${fmtDate(data.validUntil)} (${VALIDITY_DAYS} days)${expired ? ' — expired' : ''}`
              : '—'
          } />
          <MetaItem label="Source" value={source} />
          <MetaItem label="Skills" value={`${stats.skillsAssessed}`} />
        </div>

        {/* Summary at a glance */}
        <Section title="Summary at a glance" className="mt-6">
          <div className="flex items-stretch gap-4 flex-wrap">
            <div className="flex gap-6 flex-wrap">
              <div className="min-w-[110px]">
                <div className="text-[28px] font-extrabold tabular-nums leading-none text-[#0f172a]">{stats.skillsAssessed}</div>
                <div className="text-[11px] font-semibold text-[#94a3b8] mt-1.5 leading-snug">skills assessed</div>
              </div>
              <div className="min-w-[110px]">
                <div className={`text-[28px] font-extrabold tabular-nums leading-none ${avgColor(stats.avg)}`}>
                  {stats.avg != null ? stats.avg.toFixed(1) : '—'}
                </div>
                <div className="text-[11px] font-semibold text-[#94a3b8] mt-1.5 leading-snug">avg of 4</div>
              </div>
              {hasLastPerformed && (
                <div className="min-w-[110px]">
                  <div className="text-[28px] font-extrabold tabular-nums leading-none text-[#059669]">{stats.recentPct}%</div>
                  <div className="text-[11px] font-semibold text-[#94a3b8] mt-1.5 leading-snug">recent</div>
                </div>
              )}
            </div>
          </div>

          <div className="mt-5 grid sm:grid-cols-2 gap-x-8 gap-y-5">
            <div>
              <div className="text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-2.5">Rating mix</div>
              <div className="space-y-2">
                {stats.ratingMix.map((m) => <MixBar key={m.key} row={m} />)}
              </div>
            </div>
            {hasLastPerformed && (
              <div>
                <div className="text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-2.5">Last performed</div>
                <div className="space-y-2">
                  {stats.lastPerformedMix.map((m) => <MixBar key={m.key} row={m} />)}
                </div>
              </div>
            )}
          </div>
        </Section>

        {/* Category overview */}
        <Section title="Category overview" subtitle="Average rating and recent activity by category" className="mt-6">
          <div className="divide-y divide-[#eef1f6]">
            {stats.categories.filter((c) => c.total > 0).map((c) => (
              <div key={c.category} className="doc-avoid-break py-2.5 flex items-center gap-3 flex-wrap">
                <div className="flex-1 min-w-[180px] text-[13px] font-bold text-[#0f172a]">{c.category}</div>
                <div className={`text-[16px] font-extrabold tabular-nums w-10 text-right ${avgColor(c.avg)}`}>
                  {c.avg != null ? c.avg.toFixed(1) : '—'}
                </div>
                <span className="text-[11px] font-bold text-[#15803d] bg-[#dcfce7] border border-[#86efac] rounded-full px-2.5 py-1 tabular-nums">
                  {c.proficient} of {c.total} Proficient
                </span>
                {hasLastPerformed && (
                  <span className="text-[11px] font-bold text-[#1d4ed8] bg-[#dbeafe] border border-[#93c5fd] rounded-full px-2.5 py-1 tabular-nums">
                    {c.recent} of {c.total} recent
                  </span>
                )}
              </div>
            ))}
          </div>
          {hasLastPerformed && (
            <p className="text-[11px] italic text-[#94a3b8] mt-3">Recent means last performed within 3 months.</p>
          )}
        </Section>

        {/* Rating scale legend */}
        <Section title="Rating scale" className="mt-6">
          <div className="flex flex-wrap gap-x-5 gap-y-2">
            {SCALE_LEGEND.map((l) => (
              <span key={l.value} className="text-[12px] text-[#475569] font-medium">
                <b className={`inline-flex items-center justify-center w-5 h-5 rounded-md border text-[11px] mr-1.5 tabular-nums ${ratingTone(l.value).chip}`}>{l.value}</b>
                {l.label}
              </span>
            ))}
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2.5">
            <span className="text-[10.5px] font-extrabold uppercase tracking-[0.6px] text-[#94a3b8] self-center">Last performed</span>
            {LAST_PERFORMED_OPTIONS.map((o) => (
              <span key={o.value} className="text-[12px] text-[#475569] font-medium">{o.label}</span>
            ))}
          </div>
        </Section>

        {/* Skill table */}
        <div className="mt-6">
          <div className="grid grid-cols-[1fr_150px_140px] gap-3 pb-2 border-b-2 border-[#e2e8f0] text-[10px] font-extrabold uppercase tracking-[0.7px] text-[#94a3b8]">
            <span>Skill</span>
            <span className="text-center">Rating</span>
            <span>Last performed</span>
          </div>
          {data.items.map((c) => (
            <div key={c.category} className="doc-avoid-break">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#334155] bg-[#f8fafc] border-y border-[#eef1f6] px-3 py-2 mt-1.5">
                {c.category}
              </div>
              {c.skills.map((s) => {
                const v = ratings[s.name] as RatingValue | undefined
                const lp = lastPerformed?.[s.name]
                const tone = ratingTone(v ?? 'na')
                return (
                  <div key={s.name} className="doc-avoid-break grid grid-cols-[1fr_150px_140px] gap-3 items-center px-3 py-2 border-b border-[#f1f5f9]">
                    <span className="text-[13px] text-[#0f172a] font-medium leading-snug">{s.name}</span>
                    <span className="text-center">
                      {v == null ? <span className="text-[#c3cbd8]">—</span>
                        : s.questionType === 'rating_1_4' && typeof v === 'number' ? (
                          <span className={`inline-flex items-center gap-1.5 text-[12px] font-extrabold tabular-nums px-2.5 py-0.5 rounded-md border ${tone.chip}`}>
                            {v} {ratingShortLabel(v)}
                          </span>
                        ) : v === 'na' ? (
                          <span className="text-[12px] font-extrabold text-[#475569] px-2.5 py-0.5 rounded-md border bg-[#f1f5f9] border-[#e2e8f0]">N/A</span>
                        ) : s.questionType === 'yes_no' ? (
                          <span className={`text-[12px] font-extrabold px-2.5 py-0.5 rounded-md border ${tone.chip}`}>{v === 'yes' ? 'Yes' : 'No'}</span>
                        ) : (
                          <span className="text-[12px] text-[#334155] font-medium line-clamp-2">{String(v)}</span>
                        )}
                    </span>
                    <span className={`text-[12px] font-semibold ${s.questionType === 'rating_1_4' ? 'text-[#475569]' : 'text-[#c3cbd8]'}`}>
                      {s.questionType === 'rating_1_4' ? lastPerformedLabel(lp) : ''}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ─── Page 2 ─────────────────────────────────────────────── */}
      <div className="print-break-before px-7 sm:px-10 py-8 border-t border-[#eef1f6]">

        {/* Additional questions */}
        <Section title="Additional questions">
          <div className="grid grid-cols-[1fr_170px] gap-3 pb-2 border-b-2 border-[#e2e8f0] text-[10px] font-extrabold uppercase tracking-[0.7px] text-[#94a3b8]">
            <span>Question</span>
            <span className="text-center">Answer</span>
          </div>
          {ADDITIONAL_SECTIONS.map((sec) => (
            <div key={sec.section} className="doc-avoid-break">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#334155] bg-[#f8fafc] border-y border-[#eef1f6] px-3 py-2 mt-1.5">
                {sec.section}
              </div>
              {sec.questions.map((q) => {
                const a = data.additional?.answers?.[q.id]
                return (
                  <div key={q.id} className="doc-avoid-break grid grid-cols-[1fr_170px] gap-3 items-center px-3 py-2.5 border-b border-[#f1f5f9]">
                    <span className="text-[13px] text-[#0f172a] font-medium leading-snug pr-2">{q.text}</span>
                    <span className="text-center">
                      {q.type === 'yes_no' ? (
                        a === 'yes' || a === 'no' ? (
                          <span className={`text-[12px] font-extrabold px-3 py-0.5 rounded-md border ${ratingTone(a).chip}`}>{a === 'yes' ? 'Yes' : 'No'}</span>
                        ) : <span className="text-[#c3cbd8] text-[12px] font-bold">—</span>
                      ) : (
                        <span className="text-[12px] text-[#334155] font-medium leading-snug block">{typeof a === 'string' && a.trim() ? a : '—'}</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </Section>

        {/* Candidate attestation / manual-entry note */}
        {isManual ? (
          <div className="mt-7 rounded-2xl border border-[#eef1f6] bg-[#f8fafc] px-5 py-5">
            <div className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#334155]">
              <BadgeCheck className="w-4 h-4 text-[#4f46e5]" /> Recruiter-entered record
            </div>
            <p className="text-[12.5px] text-[#64748b] leading-relaxed mt-2">
              This checklist was entered manually by the recruiter, based on the candidate&apos;s self-reported answers
              (phone call, text or paper copy). No candidate attestation was captured.
            </p>
          </div>
        ) : (
          <div className="mt-7 rounded-2xl border border-[#eef1f6] px-5 py-5">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#334155]">{ATTESTATION.heading}</div>
            <p className="text-[12px] italic text-[#94a3b8] mt-1.5">{ATTESTATION.intro}</p>
            <div className="mt-3 space-y-2">
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-[#475569] leading-relaxed m-0">{ATTESTATION.confirm}</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <CheckCircle2 className="w-4 h-4 text-[#059669] shrink-0 mt-0.5" />
                <p className="text-[12.5px] text-[#475569] leading-relaxed m-0">{ATTESTATION.agree}</p>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_auto] gap-6 items-end">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.7px] text-[#94a3b8]">Candidate signature</div>
                <div className="text-[10.5px] italic text-[#94a3b8] mt-0.5">Signed electronically</div>
                <div className="mt-1.5 pb-1 border-b border-[#cbd5e1] text-[24px] leading-none"
                  style={{ fontFamily: "'Segoe Script', 'Bradley Hand', 'Brush Script MT', 'Comic Sans MS', cursive" }}>
                  {data.signedName ?? data.printedName ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.7px] text-[#94a3b8]">Printed name</div>
                <div className="mt-1.5 pb-1 border-b border-[#eef1f6] text-[13.5px] font-bold text-[#0f172a]">
                  {data.printedName ?? data.signedName ?? '—'}
                </div>
              </div>
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[0.7px] text-[#94a3b8]">Date</div>
                <div className="mt-1.5 pb-1 border-b border-[#eef1f6] text-[13.5px] font-bold text-[#0f172a] tabular-nums whitespace-nowrap">
                  {fmtDate(data.completedAt)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Document footer */}
        <div className="mt-7 pt-4 border-t border-[#eef1f6]">
          <p className="text-[11px] text-[#94a3b8] leading-relaxed m-0">
            Self-reported assessment. Completed once by the candidate and valid for {VALIDITY_DAYS} days.
            {isManual
              ? ' Entered manually by the recruiter.'
              : ` Accessed by the candidate from their ${CHECKLIST_BRAND.name} link.`}
          </p>
          <p className="text-[11px] text-[#94a3b8] mt-1 m-0">
            Generated {fmtDate(data.completedAt)} by {CHECKLIST_BRAND.name}.
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
      <div className="text-[9.5px] font-extrabold uppercase tracking-[0.6px] text-[#94a3b8]">{label}</div>
      <div className="text-[13px] font-bold text-[#0f172a] mt-0.5 truncate" title={value}>{value}</div>
    </div>
  )
}

function Section({ title, subtitle, className = '', children }: {
  title: string
  subtitle?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={`doc-avoid-break ${className}`}>
      <div className="flex items-baseline gap-2.5 flex-wrap">
        <h2 className="text-[11px] font-extrabold uppercase tracking-[0.8px] text-[#0f172a] m-0">{title}</h2>
        {subtitle && <span className="text-[11px] text-[#94a3b8]">{subtitle}</span>}
      </div>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function MixBar({ row }: { row: { key: string; label: string; count: number; pct: number } }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="text-[11.5px] font-semibold text-[#64748b] w-[110px] shrink-0 truncate">{row.label}</span>
      <div className="flex-1 h-2 rounded-full bg-[#f1f5f9] overflow-hidden min-w-[80px]">
        <div className="h-full rounded-full transition-all" style={{ width: `${row.pct}%`, background: mixBarTone(row.key) }} />
      </div>
      <span className="text-[11.5px] font-extrabold text-[#334155] tabular-nums w-5 text-right shrink-0">{row.count}</span>
      <span className="text-[11px] font-semibold text-[#94a3b8] tabular-nums w-8 text-right shrink-0">{row.pct}%</span>
    </div>
  )
}
