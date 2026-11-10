'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import type { ChecklistDetail } from '@/lib/types'
import { RatingPills, ScaleLegend } from '@/components/rating'
import {
  ADDITIONAL_SECTIONS, LAST_PERFORMED_OPTIONS,
  type RatingValue, type LastPerformedValue,
} from '@/lib/skills'
import { ArrowLeft, Check, Loader2, UserPen } from 'lucide-react'

type Props = {
  id: string
  onBack: () => void
  onSaved: () => void
}

// Recruiter-side manual entry: the recruiter records the candidate's
// self-reported ratings (from a phone call, text, paper copy, etc.).
// Last performed, experience and additional questions are optional extras
// so the checklist document is as complete as the recruiter knows.
export function ManualEntry({ id, onBack, onSaved }: Props) {
  const [data, setData] = useState<ChecklistDetail | null>(null)
  const [ratings, setRatings] = useState<Record<string, RatingValue>>({})
  const [lastPerformed, setLastPerformed] = useState<Record<string, LastPerformedValue>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ checklist: ChecklistDetail }>(`/api/checklists/${id}`)
      .then((d) => {
        setData(d.checklist)
        setRatings((d.checklist.ratings as Record<string, RatingValue>) ?? {})
        setLastPerformed((d.checklist.lastPerformed as Record<string, LastPerformedValue>) ?? {})
        setAnswers(d.checklist.additional?.answers ?? {})
        setExperienceYears(d.checklist.additional?.experienceYears != null ? String(d.checklist.additional.experienceYears) : '')
        setCandidateName(d.checklist.candidateName ?? '')
        setCandidateEmail(d.checklist.candidateEmail ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [id])

  const allSkills = useMemo(
    () => (data ? data.items.flatMap((c) => c.skills.map((s) => s.name)) : []),
    [data],
  )
  const answeredCount = allSkills.filter((s) => ratings[s] !== undefined && ratings[s] !== '').length
  const progress = allSkills.length > 0 ? Math.round((answeredCount / allSkills.length) * 100) : 0

  function setRating(skill: string, v: RatingValue) {
    setRatings((r) => ({ ...r, [skill]: v }))
    if (v === 'na') setLastPerformed((lp) => ({ ...lp, [skill]: 'na' }))
  }

  async function save() {
    setBusy(true)
    setError('')
    try {
      const years = experienceYears.trim() === '' ? null : Math.round(Number(experienceYears) * 10) / 10
      await api(`/api/checklists/${id}/responses`, {
        method: 'POST',
        body: JSON.stringify({
          ratings,
          lastPerformed,
          additional: { experienceYears: Number.isFinite(years) ? years : null, answers },
          candidateName: candidateName.trim() || undefined,
          candidateEmail: candidateEmail.trim() || undefined,
        }),
      })
      onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (error && !data) {
    return (
      <div className="max-w-[1100px] mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</Button>
        <div className="text-[13px] font-semibold text-[#E5484D] bg-[#FDEEEE] border-l-[3px] border-[#E5484D] rounded-md px-3.5 py-2.5">{error}</div>
      </div>
    )
  }
  if (!data) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="max-w-[900px] mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-4 gap-1.5 h-9 text-[13px]"><ArrowLeft className="w-4 h-4" /> Back</Button>

      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="px-6 sm:px-8 py-5 text-white" style={{ background: 'linear-gradient(135deg,#0A2B23 0%, #0E3B32 60%, #124F41 100%)' }}>
          <h1 className="text-[19px] font-extrabold tracking-tight flex items-center gap-2.5 m-0">
            <UserPen className="w-5 h-5" /> Manual entry — {data.title}
          </h1>
          <p className="text-[12.5px] text-[#A8CFB8] m-0 mt-0.5">
            Record the candidate&apos;s self-reported ratings. Everything saves to their checklist record.
          </p>
        </div>

        {/* Progress */}
        <div className="px-6 sm:px-8 py-4 border-b border-[#eef1f6] bg-[#f8fafc]">
          <div className="flex items-center justify-between text-[12px] font-bold text-[#64748b] mb-1.5">
            <span>{answeredCount} of {allSkills.length} skills answered</span>
            <span className="tabular-nums">{progress}%</span>
          </div>
          <div className="h-2 rounded-full bg-[#e2e7f0] overflow-hidden">
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7BC894,#1F7A44)' }} />
          </div>
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Candidate name</Label>
              <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Jane Doe" className="h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Candidate email (optional)</Label>
              <Input type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="jane@email.com" className="h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Experience (years, optional)</Label>
              <Input type="number" min={0} max={60} step={0.5} value={experienceYears}
                onChange={(e) => setExperienceYears(e.target.value)} placeholder="e.g. 3" className="h-11 mt-1.5" />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 sm:px-8 py-4 border-b border-[#eef1f6] space-y-2">
          <ScaleLegend compact />
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
            <span className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-[#334155]">Last performed (optional)</span>
            {LAST_PERFORMED_OPTIONS.map((o) => (
              <span key={o.value} className="text-[12px] text-[#475569] font-medium">{o.label}</span>
            ))}
          </div>
        </div>

        {/* Skills */}
        <div className="px-6 sm:px-8 py-6 space-y-5">
          {data.items.map((c) => (
            <div key={c.category}>
              <div className="font-bold text-[12.5px] text-[#334155] uppercase tracking-wide mb-2.5">{c.category}</div>
              <div className="grid gap-1">
                {c.skills.map((s) => {
                  const isRating = s.questionType === 'rating_1_4'
                  return (
                    <div key={s.name} className="py-2 border-b border-[#f1f5f9] last:border-b-0">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[13.5px] text-[#0f172a] font-medium min-w-0 flex-1">{s.name}</span>
                        <RatingPills
                          value={ratings[s.name] ?? null}
                          onChange={(v) => setRating(s.name, v)}
                          hasNa={s.hasNaOption}
                          questionType={s.questionType}
                          size="sm"
                        />
                      </div>
                      {isRating && (
                        <div className="mt-1.5 flex items-center gap-2 flex-wrap pl-0.5">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Last performed</span>
                          <div className="inline-flex gap-1" role="radiogroup" aria-label={`Last performed: ${s.name}`}>
                            {LAST_PERFORMED_OPTIONS.map((o) => {
                              const selected = lastPerformed[s.name] === o.value
                              return (
                                <button key={o.value} type="button" role="radio" aria-checked={selected}
                                  disabled={ratings[s.name] === 'na' && o.value !== 'na'}
                                  onClick={() => setLastPerformed((lp) => ({ ...lp, [s.name]: o.value }))}
                                  className={`h-6.5 px-2 rounded-lg border text-[10.5px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
                                    selected ? 'bg-[#E9F5EC] border-[#9DDBB6] text-[#1E6B3C]' : 'bg-white border-[#dfe5ee] text-[#64748b] hover:border-[#b8c2d4]'
                                  } ${ratings[s.name] === 'na' && o.value !== 'na' ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                  {o.value === 'na' ? 'N/A' : o.label.replace('Within ', '').replace(' ago', '')}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Additional questions (optional in manual entry) */}
        <div className="px-6 sm:px-8 py-5 border-t border-[#eef1f6] space-y-4">
          <div>
            <div className="text-[14px] font-extrabold tracking-tight text-[#0f172a]">Additional questions <span className="text-[11.5px] font-semibold text-[#94a3b8]">(optional)</span></div>
            <p className="text-[12px] text-[#94a3b8] mt-0.5">Fill what the candidate told you — blanks show as “—” on the document.</p>
          </div>
          {ADDITIONAL_SECTIONS.map((sec) => (
            <div key={sec.section} className="rounded-2xl border border-[#eef1f6] px-4 py-3.5">
              <div className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#334155] mb-2.5">{sec.section}</div>
              <div className="space-y-3">
                {sec.questions.map((q) => (
                  <div key={q.id}>
                    {q.type === 'yes_no' ? (
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[12.5px] text-[#0f172a] font-medium min-w-0 flex-1">{q.text}</span>
                        <div className="inline-flex gap-1" role="radiogroup" aria-label={q.text}>
                          {(['yes', 'no'] as const).map((v) => {
                            const selected = answers[q.id] === v
                            return (
                              <button key={v} type="button" role="radio" aria-checked={selected}
                                onClick={() => setAnswers((a) => ({ ...a, [q.id]: selected && a[q.id] === v ? '' : v }))}
                                className={`h-7 px-3 rounded-lg border text-[11.5px] font-bold cursor-pointer transition-colors ${
                                  selected
                                    ? v === 'yes' ? 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]' : 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]'
                                    : 'bg-white border-[#d8dee9] text-[#64748b] hover:border-[#b8c2d4]'
                                }`}>
                                {v === 'yes' ? 'Yes' : 'No'}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    ) : (
                      <div>
                        <Label className="text-[11.5px] text-[#334155] font-semibold">{q.text}</Label>
                        <Input
                          value={answers[q.id] ?? ''}
                          onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                          placeholder="Type the candidate's answer…"
                          className="h-9.5 mt-1 text-[12.5px]"
                          maxLength={2000}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 sm:px-8 py-4 border-t border-[#eef1f6] bg-[#f8fafc] flex flex-wrap items-center justify-between gap-3 sticky bottom-0">
          <div className="text-[12px] text-[#94a3b8]">Unanswered skills are rejected on save — answer them all (N/A counts).</div>
          <div className="flex items-center gap-2">
            {error && <span className="text-[12.5px] font-semibold text-[#E5484D]">{error}</span>}
            <Button onClick={save} disabled={busy || answeredCount < allSkills.length} className="font-bold gap-2"
              style={{ background: 'linear-gradient(180deg,#34A853,#2E9E5B)', boxShadow: '0 4px 14px rgba(5,150,105,0.30)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save ratings
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
