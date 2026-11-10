'use client'

// Superadmin → Skill checklist data: every checklist + candidate responses
// across all recruiter accounts, with search, filters, detail view and CSV export.
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { api } from '@/lib/client-api'
import type { AdminChecklistRow, AdminChecklistDetail } from '@/lib/types'
import { RatingBadge, ratingColor } from '@/components/rating'
import type { RatingValue } from '@/lib/skills'
import { ClipboardList, Download, Loader2, Search, Users2 } from 'lucide-react'

const STATUS_TABS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Completed' },
  { key: 'sent', label: 'Awaiting' },
  { key: 'draft', label: 'Draft' },
]

type Props = { version: number }

export function ChecklistsPanel({ version }: Props) {
  const [rows, setRows] = useState<AdminChecklistRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // filters
  const [status, setStatus] = useState('all')
  const [q, setQ] = useState('')

  // detail dialog
  const [openId, setOpenId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AdminChecklistDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const sp = new URLSearchParams()
      if (status !== 'all') sp.set('status', status)
      const d = await api<{ checklists: AdminChecklistRow[] }>(`/api/admin/checklists?${sp.toString()}`)
      setRows(d.checklists)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [status])

  useEffect(() => { load() }, [load, version])

  // Open detail dialog
  useEffect(() => {
    if (!openId) { setDetail(null); return }
    setDetailLoading(true)
    api<{ checklist: AdminChecklistDetail }>(`/api/admin/checklists/${openId}`)
      .then((d) => setDetail(d.checklist))
      .catch(() => setDetail(null))
      .finally(() => setDetailLoading(false))
  }, [openId])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) =>
      [r.title, r.candidateName, r.candidateEmail, r.ownerEmail, r.templateLabel]
        .some((v) => v && v.toLowerCase().includes(needle)),
    )
  }, [rows, q])

  // Per-category averages for the detail dialog (numeric only; N/A etc. excluded)
  const catStats = useMemo(() => {
    if (!detail) return []
    const ratings = (detail.ratings ?? {}) as Record<string, RatingValue>
    return detail.items.map((c) => {
      const rated = c.skills.filter((s) => s.name in ratings)
      const nums = rated.map((s) => ratings[s.name]).filter((v): v is number => typeof v === 'number')
      const avg = nums.length > 0 ? nums.reduce((a, b) => a + b, 0) / nums.length : null
      const naCount = rated.filter((s) => ratings[s.name] === 'na').length
      return { category: c.category, total: c.skills.length, rated: rated.length, avg, naCount }
    })
  }, [detail])

  return (
    <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] overflow-hidden">
      {/* Header */}
      <div className="px-6 sm:px-7 py-5 border-b border-[#eef1f6] bg-gradient-to-b from-[#fbfcfe] to-[#f5f7fb]">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-2xl bg-[#eef2ff] border border-[#c7d2fe] flex items-center justify-center text-[#4f46e5] shrink-0">
            <ClipboardList className="w-5.5 h-5.5" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-[17px] font-extrabold tracking-tight text-[#0f172a] flex items-center gap-2">
              Skill checklist data
              <span className="text-[11px] font-bold bg-[#eef2ff] text-[#4338ca] border border-[#c7d2fe] px-2 py-0.5 rounded-full">
                {rows.length} total
              </span>
            </h2>
            <p className="text-[12.5px] text-[#64748b] mt-0.5">
              Every checklist and candidate response across all recruiter accounts — click a row to see the full score sheet.
            </p>
          </div>
          <a href="/api/admin/checklists/export" download
            className="h-10 inline-flex items-center gap-2 text-[13px] font-bold px-4 rounded-xl bg-[#f1f4f9] text-[#475569] hover:bg-[#e5e9f0] transition-colors shrink-0"
            style={{ textDecoration: 'none' }}>
            <Download className="w-4 h-4" /> Export CSV
          </a>
        </div>

        {/* Filters */}
        <div className="mt-4 flex items-center gap-2.5 flex-wrap">
          <div className="inline-flex rounded-xl border border-[#e2e8f0] bg-white p-1 gap-0.5">
            {STATUS_TABS.map((t) => (
              <button key={t.key} type="button" onClick={() => setStatus(t.key)}
                className={`h-7 px-3 rounded-lg text-[12px] font-bold cursor-pointer transition-colors ${
                  status === t.key ? 'bg-[#4f46e5] text-white' : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#334155]'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search candidate or recruiter…"
              className="h-10 pl-9" />
          </div>
        </div>
      </div>

      {/* Rows */}
      {error ? (
        <div className="px-6 py-6 text-[13px] font-semibold text-[#dc2626]">{error}</div>
      ) : loading ? (
        <div className="py-14 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <div className="text-[14.5px] font-bold text-[#334155]">No checklists match</div>
          <p className="text-[12.5px] text-[#94a3b8] mt-1">Try clearing the search or switching filters.</p>
        </div>
      ) : (
        <div className="divide-y divide-[#eef1f6]">
          {filtered.map((r) => (
            <button key={r.id} type="button" onClick={() => setOpenId(r.id)}
              className="w-full text-left px-5 sm:px-6 py-3.5 flex items-center gap-3 flex-wrap hover:bg-[#f8fafc] transition-colors cursor-pointer">
              <div className="min-w-0 flex-1 basis-[240px]">
                <div className="text-[14px] font-bold text-[#0f172a] truncate">
                  {r.candidateName || r.title}
                  {r.candidateEmail && <span className="text-[#94a3b8] font-medium"> · {r.candidateEmail}</span>}
                </div>
                <div className="text-[11.5px] text-[#94a3b8] truncate flex items-center gap-1.5 mt-0.5">
                  <Users2 className="w-3.5 h-3.5 shrink-0" />
                  {r.ownerEmail}
                  {r.ownerCompany ? ` (${r.ownerCompany})` : ''}
                </div>
              </div>
              <span className="text-[10.5px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-lg bg-[#f1f5f9] border border-[#e2e8f0] text-[#475569] max-w-[260px] truncate">
                {r.templateLabel}
              </span>
              <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                r.status === 'submitted' ? 'bg-[#dcfce7] border-[#86efac] text-[#15803d]'
                  : r.status === 'sent' ? 'bg-[#eef2ff] border-[#c7d2fe] text-[#4338ca]'
                    : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]'
              }`}>
                {r.status === 'submitted' ? 'Completed' : r.status === 'sent' ? 'Awaiting' : 'Draft'}
              </span>
              <span className={`text-[15px] font-extrabold tabular-nums w-12 text-right ${
                r.avgRating != null ? ratingColor(r.avgRating) : 'text-[#c3cbd8]'
              }`}>
                {r.avgRating != null ? r.avgRating.toFixed(1) : '—'}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!openId} onOpenChange={(o) => { if (!o) setOpenId(null) }}>
        <DialogContent aria-describedby={undefined} className="max-w-[720px] max-h-[85vh] overflow-y-auto p-0 gap-0 rounded-3xl">
          {detailLoading || !detail ? (
            <>
              <DialogHeader className="px-6 pt-6">
                <DialogTitle className="sr-only">Loading checklist details</DialogTitle>
              </DialogHeader>
              <div className="py-16 flex justify-center text-[#94a3b8]">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            </>
          ) : (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 text-left border-b border-[#eef1f6]"
                style={{ background: 'radial-gradient(600px 200px at 0% 0%, rgba(99,102,241,0.3), transparent 60%), linear-gradient(135deg,#0a1628 0%, #1a2a6c 60%, #312e81 100%)' }}>
                <DialogTitle className="text-white text-[19px] font-extrabold tracking-tight leading-snug">
                  {detail.title}
                </DialogTitle>
                <DialogDescription className="text-[12.5px] text-[#a8b8d8] mt-1">
                  {detail.templateLabel}
                  {detail.candidateName ? ` · ${detail.candidateName}` : ''}
                  {detail.candidateEmail ? ` · ${detail.candidateEmail}` : ''}
                </DialogDescription>
                <div className="flex items-center gap-4 flex-wrap mt-3">
                  {detail.avgRating != null && (
                    <div className="text-center bg-white/10 border border-white/15 rounded-2xl px-4 py-2">
                      <div className="text-[9.5px] font-bold uppercase tracking-[0.7px] text-[#a8b8d8]">Average</div>
                      <div className="text-[22px] font-extrabold text-white tabular-nums leading-none mt-0.5">
                        {detail.avgRating.toFixed(1)}
                      </div>
                      <div className="text-[9.5px] text-[#a8b8d8] mt-0.5">of 4</div>
                    </div>
                  )}
                  <div className="text-[12px] text-[#a8b8d8]">
                    <div>Owner: <strong className="text-white font-bold">{detail.ownerEmail}</strong></div>
                    <div className="mt-0.5">
                      {detail.status === 'submitted'
                        ? `Completed ${detail.completedAt ? new Date(detail.completedAt).toLocaleString() : ''} via ${detail.submittedVia === 'link' ? 'candidate link' : 'manual entry'}`
                        : detail.status === 'sent' ? 'Awaiting candidate response' : 'Draft — not sent yet'}
                    </div>
                  </div>
                </div>
              </DialogHeader>

              <div className="px-6 py-5 space-y-5">
                {!detail.ratings ? (
                  <div className="text-center py-8">
                    <div className="text-[14.5px] font-bold text-[#334155]">No results yet</div>
                    <p className="text-[12.5px] text-[#94a3b8] mt-1">This checklist hasn&apos;t been filled in.</p>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                      {catStats.map((c) => (
                        <div key={c.category} className="rounded-2xl border border-[#eaeef5] bg-gradient-to-b from-[#fbfcfe] to-[#f5f7fb] px-3.5 py-2.5">
                          <div className="text-[9.5px] font-bold uppercase tracking-[0.6px] text-[#64748b] leading-snug">{c.category}</div>
                          <div className={`text-[17px] font-extrabold tabular-nums mt-0.5 ${c.avg != null ? ratingColor(c.avg) : 'text-[#94a3b8]'}`}>
                            {c.avg != null ? c.avg.toFixed(1) : '—'}
                            <span className="text-[10.5px] font-semibold text-[#94a3b8] ml-1">/ 4</span>
                          </div>
                          <div className="text-[10px] text-[#94a3b8] mt-0.5">{c.rated} of {c.total} skills{c.naCount > 0 ? ` · ${c.naCount} N/A` : ''}</div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-[#eef1f6] divide-y divide-[#eef1f6] overflow-hidden">
                      {detail.items.map((c) => (
                        <div key={c.category} className="p-4">
                          <div className="font-bold text-[12px] text-[#334155] uppercase tracking-wide mb-2.5">{c.category}</div>
                          <div className="grid gap-1.5">
                            {c.skills.map((s) => (
                              <div key={s.name} className="flex items-center justify-between gap-3 flex-wrap">
                                <span className="text-[13px] text-[#0f172a] font-medium">{s.name}</span>
                                <RatingBadge value={((detail.ratings ?? {}) as Record<string, RatingValue>)[s.name] ?? null} questionType={s.questionType} />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
