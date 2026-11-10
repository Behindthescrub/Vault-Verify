'use client'

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import { RatingPills, ScaleLegend } from '@/components/rating'
import type { RatingValue, SnapshotCategory } from '@/lib/skills'
import { CheckCircle2, ClipboardCheck, Loader2, PartyPopper, PenLine } from 'lucide-react'

type PublicData = {
  checklist: {
    title: string
    templateLabel: string
    candidateName: string | null
    alreadySubmitted: boolean
    items: SnapshotCategory[]
  }
}

// Candidate-facing checklist page — opened via /?c=<token>, no account needed.
// 1–4 proficiency scale (MyZipVault) + N/A where offered + typed signature on submit.
export function PublicFill({ token }: { token: string }) {
  const [data, setData] = useState<PublicData['checklist'] | null>(null)
  const [error, setError] = useState('')
  const [ratings, setRatings] = useState<Record<string, RatingValue>>({})
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [signedName, setSignedName] = useState('')
  const [busy, setBusy] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [done, setDone] = useState<{ avg: number | null } | null>(null)

  useEffect(() => {
    api<PublicData>(`/api/public/checklist/${token}`)
      .then((d) => {
        setData(d.checklist)
        setName(d.checklist.candidateName ?? '')
        setSignedName(d.checklist.candidateName ?? '')
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [token])

  const allSkills = useMemo(
    () => (data ? data.items.flatMap((c) => c.skills.map((s) => s.name)) : []),
    [data],
  )
  const answeredCount = allSkills.filter((s) => ratings[s] !== undefined && ratings[s] !== '').length
  const progress = allSkills.length > 0 ? Math.round((answeredCount / allSkills.length) * 100) : 0

  async function submit() {
    setBusy(true)
    setSubmitError('')
    try {
      const res = await api<{ ok: boolean; avgRating: number | null }>(`/api/public/checklist/${token}/submit`, {
        method: 'POST',
        body: JSON.stringify({
          ratings,
          candidateName: name.trim(),
          candidateEmail: email.trim() || undefined,
          signedName: signedName.trim(),
        }),
      })
      setDone({ avg: res.avgRating })
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
          <ClipboardCheck className="w-10 h-10 mx-auto text-[#c7d2fe] mb-3" />
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
            style={{ background: 'linear-gradient(135deg,#10b981,#059669)', boxShadow: '0 4px 14px rgba(5,150,105,0.30)' }}>
            <PartyPopper className="w-7 h-7" />
          </div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f172a] mt-4">Thank you{name ? `, ${name}` : ''}!</h1>
          <p className="text-[14px] text-[#64748b] mt-2 max-w-md mx-auto leading-relaxed">
            Your <strong>{data.title}</strong> responses have been submitted to the recruiter.
            You can close this page now.
          </p>
          <div className="inline-flex items-center gap-2 mt-5 bg-[#ecfdf5] border border-[#a7f3d0] text-[#059669] rounded-full px-4 py-2 text-[13px] font-bold">
            <CheckCircle2 className="w-4 h-4" /> Submitted successfully
          </div>
        </div>
      </Shell>
    )
  }

  if (data.alreadySubmitted) {
    return (
      <Shell>
        <div className="px-6 sm:px-10 py-14 text-center">
          <CheckCircle2 className="w-10 h-10 mx-auto text-[#10b981] mb-3" />
          <div className="font-bold text-[15px] text-[#334155]">Already submitted</div>
          <p className="text-[13px] text-[#94a3b8] mt-1.5 max-w-sm mx-auto">
            This checklist has already been completed. If you need to make a change, contact the recruiter who sent it to you.
          </p>
        </div>
      </Shell>
    )
  }

  const canSubmit =
    answeredCount === allSkills.length &&
    name.trim().length > 0 &&
    signedName.trim().length >= 2

  return (
    <Shell>
      {/* Header */}
      <div className="px-6 sm:px-10 pt-7 pb-6 text-white" style={{ background: 'radial-gradient(600px 200px at 0% 0%, rgba(99,102,241,0.35), transparent 60%), linear-gradient(135deg,#0a1628 0%, #1a2a6c 60%, #312e81 100%)' }}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-[20px] font-extrabold tracking-tight m-0">{data.title}</h1>
            <p className="text-[12.5px] text-[#a8b8d8] m-0 mt-0.5">{data.templateLabel} · {allSkills.length} skills</p>
          </div>
        </div>
      </div>

      {/* Progress + identity */}
      <div className="px-6 sm:px-10 py-4 border-b border-[#eef1f6] bg-[#f8fafc]">
        <div className="flex items-center justify-between text-[12px] font-bold text-[#64748b] mb-1.5">
          <span>{answeredCount} of {allSkills.length} answered</span>
          <span className="tabular-nums">{progress}%</span>
        </div>
        <div className="h-2 rounded-full bg-[#e2e7f0] overflow-hidden">
          <div className="h-full rounded-full transition-all" style={{ width: `${progress}%`, background: 'linear-gradient(90deg,#818cf8,#4f46e5)' }} />
        </div>
        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Your name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your full name" className="h-11 mt-1.5" maxLength={120} />
          </div>
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Your email (optional)</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@email.com" className="h-11 mt-1.5" />
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="px-6 sm:px-10 py-4 border-b border-[#eef1f6]">
        <div className="text-[10.5px] font-bold uppercase tracking-[0.6px] text-[#334155] mb-2">Proficiency scale — be honest, it&apos;s your safety on the line</div>
        <ScaleLegend />
      </div>

      {/* Skills */}
      <div className="px-6 sm:px-10 py-6 space-y-5">
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
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Signature + submit */}
      <div className="px-6 sm:px-10 py-5 border-t border-[#eef1f6] bg-[#f8fafc] space-y-4">
        <div className="rounded-2xl border border-dashed border-[#c7d2fe] bg-[#f8faff] px-4 py-4">
          <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155] flex items-center gap-1.5">
            <PenLine className="w-3.5 h-3.5 text-[#4f46e5]" /> Digital signature — type your full legal name
          </Label>
          <Input
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder="e.g. Jane A. Doe"
            className="h-12 mt-2 text-[15px] italic"
            style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            maxLength={120}
          />
          <p className="text-[11.5px] text-[#94a3b8] mt-1.5 leading-relaxed">
            By typing your name and submitting, you certify the ratings above are your own honest self-assessment.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-[12px] text-[#94a3b8]">You can&apos;t change answers after submitting.</div>
          <div className="flex items-center gap-2.5">
            {submitError && <span className="text-[12.5px] font-semibold text-[#dc2626] max-w-[240px] text-right">{submitError}</span>}
            <Button onClick={submit} disabled={busy || !canSubmit} className="h-11 px-6 font-bold"
              style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)', boxShadow: '0 4px 14px rgba(79,70,229,0.30)' }}>
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
          'radial-gradient(1200px 600px at 10% -10%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(26,42,108,0.08), transparent 60%), linear-gradient(180deg,#f6f8fc 0%, #eef2f9 100%)',
      }}>
      <div className="max-w-[850px] mx-auto rounded-3xl overflow-hidden border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08),0_30px_80px_-20px_rgba(79,70,229,0.18)]">
        {children}
      </div>
      <p className="text-center text-[11.5px] text-[#94a3b8] mt-5">Powered by Recruiter tool</p>
    </div>
  )
}
