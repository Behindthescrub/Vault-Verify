'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import type { ChecklistDetail } from '@/lib/types'
import { RatingPills, ScaleLegend } from '@/components/rating'
import type { RatingValue } from '@/lib/skills'
import { ArrowLeft, Check, Loader2, UserPen } from 'lucide-react'

type Props = {
  id: string
  onBack: () => void
  onSaved: () => void
}

// Recruiter-side manual entry: the recruiter records the candidate's
// self-reported ratings (from a phone call, text, paper copy, etc.).
export function ManualEntry({ id, onBack, onSaved }: Props) {
  const [data, setData] = useState<ChecklistDetail | null>(null)
  const [ratings, setRatings] = useState<Record<string, RatingValue>>({})
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ checklist: ChecklistDetail }>(`/api/checklists/${id}`)
      .then((d) => {
        setData(d.checklist)
        setRatings((d.checklist.ratings as Record<string, RatingValue>) ?? {})
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

  async function save() {
    setBusy(true)
    setError('')
    try {
      await api(`/api/checklists/${id}/responses`, {
        method: 'POST',
        body: JSON.stringify({
          ratings,
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
        <div className="text-[13px] font-semibold text-[#dc2626] bg-[#fef2f2] border-l-[3px] border-[#dc2626] rounded-md px-3.5 py-2.5">{error}</div>
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
        <div className="px-6 sm:px-8 py-5 text-white" style={{ background: 'linear-gradient(135deg,#0a1628 0%, #1a2a6c 60%, #312e81 100%)' }}>
          <h1 className="text-[19px] font-extrabold tracking-tight flex items-center gap-2.5 m-0">
            <UserPen className="w-5 h-5" /> Manual entry — {data.title}
          </h1>
          <p className="text-[12.5px] text-[#a8b8d8] m-0 mt-0.5">
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
            <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#818cf8,#4f46e5)' }} />
          </div>
          <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Candidate name</Label>
              <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Jane Doe" className="h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Candidate email (optional)</Label>
              <Input type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="jane@email.com" className="h-11 mt-1.5" />
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="px-6 sm:px-8 py-4 border-b border-[#eef1f6]">
          <ScaleLegend compact />
        </div>

        {/* Skills */}
        <div className="px-6 sm:px-8 py-6 space-y-5">
          {data.items.map((c) => (
            <div key={c.category}>
              <div className="font-bold text-[12.5px] text-[#334155] uppercase tracking-wide mb-2.5">{c.category}</div>
              <div className="grid gap-1.5">
                {c.skills.map((s) => (
                  <div key={s.name} className="flex items-center justify-between gap-3 flex-wrap py-2 border-b border-[#f1f5f9] last:border-b-0">
                    <span className="text-[13.5px] text-[#0f172a] font-medium min-w-0 flex-1">{s.name}</span>
                    <RatingPills
                      value={ratings[s.name] ?? null}
                      onChange={(v) => setRatings((r) => ({ ...r, [s.name]: v }))}
                      hasNa={s.hasNaOption}
                      questionType={s.questionType}
                      size="sm"
                    />
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
            {error && <span className="text-[12.5px] font-semibold text-[#dc2626]">{error}</span>}
            <Button onClick={save} disabled={busy || answeredCount < allSkills.length} className="font-bold gap-2"
              style={{ background: 'linear-gradient(180deg,#10b981,#059669)', boxShadow: '0 4px 14px rgba(5,150,105,0.30)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Save ratings
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
