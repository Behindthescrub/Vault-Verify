'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/client-api'
import type { ChecklistDetail } from '@/lib/types'
import { RatingBadge, ratingColor } from '@/components/rating'
import { ArrowLeft, ClipboardCheck, Loader2, Link2, Copy, Mail, UserPen, Clock4 } from 'lucide-react'

type Props = {
  id: string
  onBack: () => void
  onManualEntry: (id: string) => void
}

export function ChecklistDetail({ id, onBack, onManualEntry }: Props) {
  const [data, setData] = useState<ChecklistDetail | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    api<{ checklist: ChecklistDetail }>(`/api/checklists/${id}`)
      .then((d) => setData(d.checklist))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [id])

  if (error) {
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

  const link = typeof window !== 'undefined' ? `${window.location.origin}/?c=${data.token}` : ''

  function copyLink() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  // Per-category averages
  const catStats = data.items.map((c) => {
    const rated = c.skills.filter((s) => data.ratings && s in data.ratings)
    const avg = rated.length > 0 ? rated.reduce((n, s) => n + (data.ratings![s] ?? 0), 0) / rated.length : null
    return { category: c.category, total: c.skills.length, rated: rated.length, avg }
  })

  return (
    <div className="max-w-[1100px] mx-auto">
      <Button variant="ghost" onClick={onBack} className="mb-4 gap-1.5 h-9 text-[13px]"><ArrowLeft className="w-4 h-4" /> All checklists</Button>

      {/* Header card */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] overflow-hidden">
        <div className="px-6 sm:px-8 py-6 text-white flex items-center gap-4 flex-wrap"
          style={{ background: 'radial-gradient(600px 200px at 0% 0%, rgba(99,102,241,0.35), transparent 60%), linear-gradient(135deg,#0a1628 0%, #1a2a6c 60%, #312e81 100%)' }}>
          <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h1 className="text-[20px] font-extrabold tracking-tight m-0">{data.title}</h1>
            <p className="text-[12.5px] text-[#a8b8d8] m-0 mt-0.5">
              {data.templateLabel}
              {data.candidateName ? ` · ${data.candidateName}` : ''}
              {data.candidateEmail ? ` · ${data.candidateEmail}` : ''}
            </p>
          </div>
          {data.ratings && (
            <div className="text-center bg-white/10 border border-white/15 rounded-2xl px-4 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#a8b8d8]">Average</div>
              <div className="text-[24px] font-extrabold tabular-nums leading-none mt-1">{data.avgRating?.toFixed(1)}</div>
              <div className="text-[10.5px] text-[#a8b8d8] mt-0.5">of 5</div>
            </div>
          )}
        </div>

        {/* Status / meta strip */}
        <div className="px-6 sm:px-8 py-3.5 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-[#eef1f6] bg-[#f8fafc] text-[12.5px] text-[#64748b]">
          <span className="flex items-center gap-1.5">
            <span className={`font-bold uppercase tracking-wide text-[11px] px-2 py-0.5 rounded-full border ${
              data.status === 'submitted' ? 'bg-[#dcfce7] border-[#86efac] text-[#15803d]'
                : data.status === 'sent' ? 'bg-[#eef2ff] border-[#c7d2fe] text-[#4338ca]'
                : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]'
            }`}>{data.status === 'submitted' ? 'Completed' : data.status === 'sent' ? 'Awaiting candidate' : 'Draft'}</span>
            {data.submittedVia && <span>via {data.submittedVia === 'link' ? 'candidate link' : 'manual entry'}</span>}
          </span>
          {data.completedAt && (
            <span className="flex items-center gap-1.5"><Clock4 className="w-3.5 h-3.5" /> completed {new Date(data.completedAt).toLocaleString()}</span>
          )}
          {data.inviteSentAt && (
            <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> invited {new Date(data.inviteSentAt).toLocaleDateString()}</span>
          )}
        </div>

        {/* Actions */}
        <div className="px-6 sm:px-8 py-4 flex flex-wrap gap-2 border-b border-[#eef1f6]">
          <Button variant="ghost" className="h-10 gap-1.5 text-[13px]" onClick={copyLink}>
            {copied ? <Copy className="w-4 h-4 text-[#059669]" /> : <Link2 className="w-4 h-4" />}
            {copied ? 'Link copied' : 'Copy candidate link'}
          </Button>
          <a href={`mailto:${data.candidateEmail ?? ''}`} className="h-10 inline-flex items-center gap-1.5 text-[13px] font-bold px-4 rounded-xl bg-[#f1f4f9] text-[#475569] hover:bg-[#e5e9f0] transition-colors"
            style={{ textDecoration: 'none' }}>
            <Mail className="w-4 h-4" /> Email candidate
          </a>
          {!data.ratings && (
            <Button variant="ghost" className="h-10 gap-1.5 text-[13px]" onClick={() => onManualEntry(data.id)}>
              <UserPen className="w-4 h-4" /> Enter ratings manually
            </Button>
          )}
        </div>

        {/* Results / empty state */}
        {!data.ratings ? (
          <div className="px-6 sm:px-8 py-12 text-center">
            <div className="text-[15px] font-bold text-[#334155]">No results yet</div>
            <p className="text-[13px] text-[#94a3b8] mt-1.5 max-w-md mx-auto leading-relaxed">
              Copy the candidate link above (or send it from the checklist list) — the candidate fills it in on their device.
              Prefer entering their answers yourself? Use “Enter ratings manually”.
            </p>
          </div>
        ) : (
          <div className="px-6 sm:px-8 py-6 space-y-5">
            {/* Category averages */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {catStats.map((c) => (
                <div key={c.category} className="rounded-2xl border border-[#eaeef5] bg-gradient-to-b from-[#fbfcfe] to-[#f5f7fb] px-4 py-3">
                  <div className="text-[10px] font-bold uppercase tracking-[0.7px] text-[#64748b] leading-snug">{c.category}</div>
                  <div className={`text-[19px] font-extrabold tabular-nums mt-1 ${c.avg != null ? ratingColor(c.avg) : 'text-[#94a3b8]'}`}>
                    {c.avg != null ? c.avg.toFixed(1) : '—'}
                    <span className="text-[11px] font-semibold text-[#94a3b8] ml-1">/ 5</span>
                  </div>
                  <div className="text-[10.5px] text-[#94a3b8] mt-0.5">{c.rated} of {c.total} skills</div>
                </div>
              ))}
            </div>

            {/* Skill-by-skill */}
            <div className="rounded-2xl border border-[#eef1f6] divide-y divide-[#eef1f6] overflow-hidden">
              {data.items.map((c) => (
                <div key={c.category} className="p-4 sm:p-5">
                  <div className="font-bold text-[12.5px] text-[#334155] uppercase tracking-wide mb-3">{c.category}</div>
                  <div className="grid gap-2">
                    {c.skills.map((s) => (
                      <div key={s} className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="text-[13.5px] text-[#0f172a] font-medium">{s}</span>
                        <RatingBadge value={data.ratings?.[s] ?? null} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
