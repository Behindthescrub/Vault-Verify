'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import { RatingPills } from '@/components/rating'
import {
  CHECKLIST_BRAND, VALIDITY_DAYS, ADDITIONAL_SECTIONS, ATTESTATION,
  LAST_PERFORMED_OPTIONS, SCALE_LEGEND,
  type RatingValue, type SnapshotCategory, type LastPerformedValue, type AdditionalSection,
} from '@/lib/skills-shared'
import { CheckCircle2, ClipboardCheck, Loader2, PartyPopper, PenLine } from 'lucide-react'

type PublicData = {
  checklist: {
    title: string
    templateLabel: string
    candidateName: string | null
    candidateEmail: string | null
    alreadySubmitted: boolean
    items: SnapshotCategory[]
    additionalSections: AdditionalSection[]
  }
}

type LastPerformedPickerProps = {
  value: LastPerformedValue | null
  onChange: (v: LastPerformedValue) => void
  disabled?: boolean
}

// Segmented "Last performed" control (Within 3 / 6 / 6+ months / N/A).
function LastPerformedPicker({ value, onChange, disabled = false }: LastPerformedPickerProps) {
  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label="Last performed">
      {LAST_PERFORMED_OPTIONS.map((o) => {
        const selected = value === o.value
        const tone = selected && o.value !== 'na'
          ? 'bg-[#E9F5EC] border-[#9DDBB6] text-[#1E6B3C]'
          : selected ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#475569]' : ''
        return (
          <button key={o.value} type="button" role="radio" aria-checked={selected} disabled={disabled}
            onClick={() => onChange(o.value)}
            title={o.label}
            className={`h-7 px-2.5 rounded-lg border text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap ${
              disabled ? 'opacity-60 cursor-not-allowed' : ''
            } ${
              selected ? tone : 'bg-white border-[#dfe5ee] text-[#64748b] hover:border-[#b8c2d4] hover:text-[#334155]'
            } ${o.value === 'na' && !selected ? 'text-[#94a3b8]' : ''}`}>
            {o.value === 'na' ? 'N/A' : o.label.replace('Within ', '').replace(' ago', '')}
          </button>
        )
      })}
    </div>
  )
}

// Candidate-facing checklist — the VaultVerify self-assessment:
// 1–4 ratings + last performed per skill, self-reported experience,
// additional questions, and the candidate attestation with typed signature.
export function PublicFill({ token }: { token: string }) {
  const [data, setData] = useState<PublicData['checklist'] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState<{ validUntil: string | null } | null>(null)

  // form state
  const [ratings, setRatings] = useState<Record<string, RatingValue>>({})
  const [lastPerformed, setLastPerformed] = useState<Record<string, LastPerformedValue>>({})
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [experienceYears, setExperienceYears] = useState('')
  const [confirmRatings, setConfirmRatings] = useState(false)
  const [confirmTerms, setConfirmTerms] = useState(false)
  const [signedName, setSignedName] = useState('')
  const [printedName, setPrintedName] = useState('')

  useEffect(() => {
    api<PublicData>(`/api/public/checklist/${token}`)
      .then((d) => {
        setData(d.checklist)
        setName(d.checklist.candidateName ?? '')
        setEmail(d.checklist.candidateEmail ?? '')
        setSignedName(d.checklist.candidateName ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [token])

  const ratingSkills = useMemo(
    () => (data ? data.items.flatMap((c) => c.skills.filter((s) => s.questionType === 'rating_1_4').map((s) => s.name)) : []),
    [data],
  )
  const allSkills = useMemo(
    () => (data ? data.items.flatMap((c) => c.skills.map((s) => s.name)) : []),
    [data],
  )
  const answeredCount = allSkills.filter((s) => ratings[s] !== undefined && ratings[s] !== '').length
  const lpAnswered = ratingSkills.filter((s) => lastPerformed[s] !== undefined).length
  const progress = allSkills.length > 0 ? Math.round((answeredCount / allSkills.length) * 100) : 0

  const yesNoQuestions = useMemo(
    () => (data?.additionalSections ?? []).flatMap((s) => s.questions.filter((q) => q.type === 'yes_no')),
    [data],
  )
  const yesNoAnswered = yesNoQuestions.filter((q) => answers[q.id] === 'yes' || answers[q.id] === 'no').length

  function setRating(skill: string, v: RatingValue) {
    setRatings((r) => ({ ...r, [skill]: v }))
    if (v === 'na') {
      // An N/A skill wasn't performed — recency is N/A too.
      setLastPerformed((lp) => ({ ...lp, [skill]: 'na' }))
    }
  }

  async function submit() {
    setBusy(true)
    setSubmitError('')
    try {
      const years = experienceYears.trim() === '' ? null : Math.round(Number(experienceYears) * 10) / 10
      const res = await api<{ ok: boolean; validUntil: string | null }>(`/api/public/checklist/${token}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          ratings,
          lastPerformed,
          additional: { experienceYears: Number.isFinite(years) ? years : null, answers },
          candidateName: name.trim(),
          candidateEmail: email.trim() || undefined,
          signedName: signedName.trim(),
          printedName: printedName.trim() || signedName.trim(),
        }),
      })
      setDone({ validUntil: res.validUntil })
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return (
      <Shell>
        <div className="text-center py-14 px-6">
          <ClipboardCheck className="w-10 h-10 mx-auto text-[#CBE8D6] mb-3" />
          <div className="font-bold text-[15px] text-[#334155]">Checklist unavailable</div>
          <p className="text-[13px] text-[#94a3b8] mt-1.5 max-w-sm mx-auto">{error}</p>
        </div>
      </Shell>
    )
  }
  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  if (done) {
    return (
      <Shell>
        <div className="px-6 sm:px-10 py-14 text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center text-white"
            style={{ background: 'linear-gradient(135deg,#34A853,#2E9E5B)', boxShadow: '0 4px 14px rgba(5,150,105,0.30)' }}>
            <PartyPopper className="w-7 h-7" />
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f172a] mt-4">Thank you{name ? `, ${name}` : ''}!</h1>
          <p className="text-[14px] text-[#64748b] mt-2 max-w-md mx-auto leading-relaxed">
            Your <strong>{data.title}</strong> responses have been submitted to the recruiter.
          </p>
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="inline-flex items-center gap-2 bg-[#E9F5EC] border border-[#a7f3d0] text-[#2E9E5B] rounded-full px-4 py-2 text-[13px] font-bold">
              <CheckCircle2 className="w-4 h-4" /> Submitted successfully
            </div>
            {done.validUntil && (
              <p className="text-[12px] text-[#94a3b8]">
                Valid for {VALIDITY_DAYS} days — until{' '}
                {new Date(done.validUntil).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}.
              </p>
            )}
            <p className="text-[12px] text-[#94a3b8] max-w-sm mt-1">You can close this page now.</p>
          </div>
        </div>
      </Shell>
    )
  }

  if (data.alreadySubmitted) {
    return (
      <Shell>
        <div className="px-6 sm:px-10 py-14 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[#34A853] mb-3" />
          <div className="font-bold text-[15px] text-[#334155]">Already submitted</div>
          <p className="text-[13px] text-[#94a3b8] mt-1.5 max-w-sm mx-auto">
            This checklist has already been completed once. If you need to make a change, contact the recruiter who sent it to you.
          </p>
        </div>
      </Shell>
    )
  }

  const canSubmit =
    answeredCount === allSkills.length &&
    lpAnswered === ratingSkills.length &&
    yesNoAnswered === yesNoQuestions.length &&
    name.trim().length > 0 &&
    signedName.trim().length >= 2 &&
    (printedName.trim().length >= 2 || signedName.trim().length >= 2) &&
    confirmRatings &&
    confirmTerms

  const parts = data.templateLabel.split('|').map((p) => p.trim())
  const roleLine = parts.length === 3 ? [parts[1], parts[2]].filter(Boolean).join(' ') : data.title

  return (
    <Shell>
      {/* VaultVerify header */}
      <div className="px-6 sm:px-10 pt-7 pb-6 text-white"
        style={{ background: 'radial-gradient(600px 200px at 0% 0%, rgba(46,158,91,0.35), transparent 60%), linear-gradient(135deg,#0A2B23 0%, #0E3B32 60%, #124F41 100%)' }}>
        <div className="flex items-center gap-2.5 pb-4 border-b border-white/10">
          <img src="/vaultverify-logo-128.png" alt="VaultVerify logo" width={34} height={34} className="rounded-lg shrink-0" />
          <div>
            <div className="text-[15px] font-extrabold tracking-tight leading-none">{CHECKLIST_BRAND.name}</div>
            <div className="text-[10px] text-[#A8CFB8] mt-1">{CHECKLIST_BRAND.tagline}</div>
          </div>
        </div>
        <h1 className="text-[22px] font-extrabold tracking-tight m-0 mt-4">Skills Checklist</h1>
        <p className="text-[12px] text-[#A8CFB8] m-0 mt-0.5">Self-assessed — not independently verified</p>
        <p className="text-[13px] font-bold text-white m-0 mt-3">
          {roleLine} <span className="text-[#A8CFB8] font-medium">· {allSkills.length} skills</span>
        </p>
      </div>

      {/* Progress + candidate info */}
      <div className="px-6 sm:px-10 py-4 border-b border-[#eef1f6] bg-[#f8fafc]">
        <div className="flex items-center justify-between text-[12px] font-bold text-[#64748b] mb-1.5">
          <span>{answeredCount} of {allSkills.length} answered{ratingSkills.length > 0 ? ` · last performed ${lpAnswered}/${ratingSkills.length}` : ''}</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#e2e7f0] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#7BC894,#1F7A44)' }} />
        </div>
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Your name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="h-11 mt-1.5" maxLength={120} />
          </div>
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Your email</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="h-11 mt-1.5" maxLength={200} />
          </div>
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Experience (years)</Label>
            <Input type="number" min={0} max={60} step={0.5} value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)} placeholder="e.g. 3" className="h-11 mt-1.5" />
          </div>
        </div>
      </div>

      {/* Legends */}
      <div className="px-6 sm:px-10 py-4 border-b border-[#eef1f6] space-y-2.5">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-[#334155]">Rating scale — be honest, it&apos;s your safety on the line</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          {SCALE_LEGEND.map((l) => (
            <span key={l.value} className="text-[12px] text-[#475569] font-medium">
              <b className="inline-flex items-center justify-center w-5 h-5 rounded-md border text-[11px] mr-1.5 tabular-nums bg-[#f1f5f9] border-[#e2e8f0]">{l.value}</b>
              {l.label}
            </span>
          ))}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-[#334155] w-full sm:w-auto">Last performed</span>
          {LAST_PERFORMED_OPTIONS.map((o) => (
            <span key={o.value} className="text-[12px] text-[#475569] font-medium">{o.label}</span>
          ))}
        </div>
      </div>

      {/* Skills */}
      <div className="px-6 sm:px-10 py-6 space-y-6">
        {data.items.map((c) => (
          <div key={c.category}>
            <div className="font-bold text-[12.5px] text-[#334155] uppercase tracking-wide mb-2.5">{c.category}</div>
            <div className="grid gap-1">
              {c.skills.map((s) => {
                const isRating = s.questionType === 'rating_1_4'
                const rating = ratings[s.name] ?? null
                return (
                  <div key={s.name} className="py-2.5 border-b border-[#f1f5f9] last:border-b-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[13.5px] text-[#0f172a] font-medium min-w-0 flex-1">{s.name}</span>
                      <RatingPills
                        value={rating}
                        onChange={(v) => setRating(s.name, v)}
                        hasNa={s.hasNaOption}
                        questionType={s.questionType}
                      />
                    </div>
                    {isRating && (
                      <div className="mt-2 flex items-center gap-2 flex-wrap pl-0.5">
                        <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#94a3b8]">Last performed</span>
                        <LastPerformedPicker
                          value={lastPerformed[s.name] ?? null}
                          disabled={rating === 'na'}
                          onChange={(v) => setLastPerformed((lp) => ({ ...lp, [s.name]: v }))}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Additional questions */}
      <div className="px-6 sm:px-10 py-6 border-t border-[#eef1f6] space-y-5">
        <div>
          <div className="text-[15px] font-extrabold tracking-tight text-[#0f172a]">Additional questions</div>
          <p className="text-[12px] text-[#94a3b8] mt-0.5">A few availability and experience notes for the recruiter.</p>
        </div>
        {(data.additionalSections ?? []).map((sec) => (
          <div key={sec.section} className="rounded-2xl border border-[#eef1f6] px-4 sm:px-5 py-4">
            <div className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#334155] mb-3">{sec.section}</div>
            <div className="space-y-3.5">
              {sec.questions.map((q) => (
                <div key={q.id}>
                  {q.type === 'yes_no' ? (
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <span className="text-[13px] text-[#0f172a] font-medium min-w-0 flex-1">{q.text}</span>
                      <div className="inline-flex gap-1" role="radiogroup" aria-label={q.text}>
                        {(['yes', 'no'] as const).map((v) => {
                          const selected = answers[q.id] === v
                          const tone = v === 'yes'
                            ? 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]'
                            : 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]'
                          return (
                            <button key={v} type="button" role="radio" aria-checked={selected}
                              onClick={() => setAnswers((a) => ({ ...a, [q.id]: v }))}
                              className={`h-8 px-3.5 rounded-lg border text-[12.5px] font-bold cursor-pointer transition-colors ${
                                selected ? tone : 'bg-white border-[#d8dee9] text-[#64748b] hover:border-[#b8c2d4] hover:text-[#334155]'
                              }`}>
                              {v === 'yes' ? 'Yes' : 'No'}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <Label className="text-[12px] text-[#334155] font-semibold">{q.text}</Label>
                      <Input
                        value={answers[q.id] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                        placeholder="Type your answer…"
                        className="h-10 mt-1.5 text-[13px]"
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

      {/* Attestation + submit */}
      <div className="px-6 sm:px-10 py-5 border-t border-[#eef1f6] bg-[#f8fafc] space-y-4">
        <div className="rounded-2xl border border-[#eef1f6] bg-white px-4 sm:px-5 py-4">
          <div className="text-[11px] font-extrabold uppercase tracking-[0.7px] text-[#334155]">{ATTESTATION.heading}</div>
          <p className="text-[11.5px] italic text-[#94a3b8] mt-1">{ATTESTATION.intro}</p>
          <label className="flex gap-2.5 items-start mt-3 cursor-pointer">
            <input type="checkbox" checked={confirmRatings} onChange={(e) => setConfirmRatings(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1F7A44] cursor-pointer" />
            <span className="text-[12.5px] text-[#475569] leading-relaxed">{ATTESTATION.confirm}</span>
          </label>
          <label className="flex gap-2.5 items-start mt-2.5 cursor-pointer">
            <input type="checkbox" checked={confirmTerms} onChange={(e) => setConfirmTerms(e.target.checked)}
              className="mt-0.5 w-4 h-4 accent-[#1F7A44] cursor-pointer" />
            <span className="text-[12.5px] text-[#475569] leading-relaxed">{ATTESTATION.agree}</span>
          </label>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155] flex items-center gap-1.5">
                <PenLine className="w-3.5 h-3.5 text-[#1F7A44]" /> Signature — type your full legal name
              </Label>
              <Input
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
                placeholder="e.g. Jane A. Doe"
                className="h-12 mt-1.5 text-[15px]"
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
                maxLength={120}
              />
              <p className="text-[10.5px] text-[#94a3b8] mt-1">Signed electronically when you submit.</p>
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Printed name</Label>
              <Input
                value={printedName}
                onChange={(e) => setPrintedName(e.target.value)}
                placeholder={signedName || 'Your printed name'}
                className="h-12 mt-1.5 text-[14px] font-semibold"
                maxLength={120}
              />
              <p className="text-[10.5px] text-[#94a3b8] mt-1">Defaults to your signature if left blank.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-[#94a3b8]">
            Completed once — you can&apos;t change answers after submitting. Valid {VALIDITY_DAYS} days.
          </div>
          <div className="flex items-center gap-2.5">
            {submitError && <span className="text-[12.5px] font-semibold text-[#E5484D] max-w-[240px] text-right">{submitError}</span>}
            <Button onClick={submit} disabled={busy || !canSubmit} className="h-11 px-6 font-bold"
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)', boxShadow: '0 4px 14px rgba(31,122,68,0.30)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Submit checklist
            </Button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full py-7 px-4"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(31,122,68,0.10), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(26,42,108,0.08), transparent 60%), linear-gradient(180deg,#f6f8fc 0%, #eef2f9 100%)',
      }}>
      <div className="max-w-[850px] mx-auto rounded-3xl overflow-hidden border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08),0_30px_80px_-20px_rgba(31,122,68,0.18)]">
        {children}
      </div>
      <p className="text-center text-[11.5px] text-[#94a3b8] mt-5">Powered by {CHECKLIST_BRAND.name}</p>
    </div>
  )
}
