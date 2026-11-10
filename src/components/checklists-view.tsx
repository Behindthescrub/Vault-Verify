'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/client-api'
import type { ChecklistSummary } from '@/lib/types'
import type { SnapshotCategory, SnapshotSkill } from '@/lib/skills-shared'
import { CheckSquare, ChevronRight, ClipboardCheck, Copy, Eye, Link2, Loader2, Mail, Plus, Search, Send, Trash2, UserPen } from 'lucide-react'

type TemplateRow = {
  id: string
  profession: string
  jobTitle: string
  specialty: string
  name: string
  skillCount: number
  categoryCount: number
}
type Grouped = Record<string, Record<string, TemplateRow[]>>

type Props = {
  onOpenDetail: (id: string) => void
  onManualEntry: (id: string) => void
}

export function ChecklistsView({ onOpenDetail, onManualEntry }: Props) {
  const [items, setItems] = useState<ChecklistSummary[]>([])
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [grouped, setGrouped] = useState<Grouped>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ checklists: ChecklistSummary[] }>('/api/checklists')
      setItems(data.checklists)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load checklists')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
    api<{ templates: TemplateRow[]; grouped: Grouped }>('/api/templates')
      .then((d) => { setTemplates(d.templates); setGrouped(d.grouped) })
      .catch(() => {})
  }, [refresh])

  // ─── New checklist wizard state ──────────────────────────────────
  const [newOpen, setNewOpen] = useState(false)
  const [step, setStep] = useState<'pick' | 'customize'>('pick')
  const [title, setTitle] = useState('')
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [selProfession, setSelProfession] = useState('')
  const [selJobTitle, setSelJobTitle] = useState('')
  const [selTemplate, setSelTemplate] = useState<TemplateRow | null>(null)
  const [templateItems, setTemplateItems] = useState<SnapshotCategory[]>([])
  const [pickerSearch, setPickerSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [loadingSkills, setLoadingSkills] = useState(false)

  // ─── Invite dialog state ─────────────────────────────────────────
  const [inviteFor, setInviteFor] = useState<ChecklistSummary | null>(null)
  const [inviteTo, setInviteTo] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; text: string; link?: string } | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  const professions = useMemo(() => Object.keys(grouped).sort(), [grouped])
  const jobTitles = useMemo(
    () => (selProfession && grouped[selProfession] ? Object.keys(grouped[selProfession]).sort() : []),
    [grouped, selProfession],
  )
  const specialties = useMemo(
    () => (selProfession && selJobTitle && grouped[selProfession]?.[selJobTitle] ? grouped[selProfession][selJobTitle] : []),
    [grouped, selProfession, selJobTitle],
  )

  // Flat search across all templates
  const searchResults = useMemo(() => {
    const q = pickerSearch.trim().toLowerCase()
    if (!q) return null
    return templates.filter((t) =>
      `${t.profession} ${t.jobTitle} ${t.specialty}`.toLowerCase().includes(q),
    ).slice(0, 40)
  }, [templates, pickerSearch])

  function openNew() {
    setNewOpen(true)
    setStep('pick')
    setTitle('')
    setCandidateName('')
    setCandidateEmail('')
    setSelProfession(professions[0] ?? '')
    setSelJobTitle('')
    setSelTemplate(null)
    setTemplateItems([])
    setPickerSearch('')
    setCreateError('')
  }

  function chooseProfession(p: string) {
    setSelProfession(p)
    setSelJobTitle('')
    setSelTemplate(null)
    setPickerSearch('')
  }

  function chooseJobTitle(j: string) {
    setSelJobTitle(j)
    setSelTemplate(null)
  }

  async function pickTemplate(t: TemplateRow) {
    setLoadingSkills(true)
    setSelTemplate(t)
    try {
      const d = await api<{ template: unknown; skills: { skillName: string; category: string; questionType: string; hasNaOption: boolean; sortOrder: number }[] }>(
        `/api/templates?templateId=${t.id}`,
      )
      // Group by category in sort order
      const byCat = new Map<string, SnapshotSkill[]>()
      for (const s of d.skills) {
        if (!byCat.has(s.category)) byCat.set(s.category, [])
        byCat.get(s.category)!.push({ name: s.skillName, questionType: s.questionType, hasNaOption: s.hasNaOption })
      }
      const its: SnapshotCategory[] = [...byCat.entries()].map(([category, skills]) => ({ category, skills }))
      setTemplateItems(its)
      if (!title) setTitle(`${t.jobTitle} — ${t.specialty}${candidateName.trim() ? ` — ${candidateName.trim()}` : ''}`)
      setStep('customize')
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to load template skills')
    } finally {
      setLoadingSkills(false)
    }
  }

  function toggleSkill(cat: string, name: string) {
    setTemplateItems((its) =>
      its.map((c) =>
        c.category === cat
          ? { ...c, skills: c.skills.filter((s) => s.name !== name) }
          : c
      ).filter((c) => c.skills.length > 0),
    )
  }

  async function createChecklist() {
    if (!selTemplate) return
    const finalItems = templateItems
      .map((c) => ({ category: c.category, skills: c.skills.map((s) => ({ name: s.name, questionType: s.questionType, hasNaOption: s.hasNaOption })) }))
      .filter((c) => c.skills.length > 0)
    if (finalItems.length === 0) {
      setCreateError('Keep at least one skill')
      return
    }
    setCreating(true)
    setCreateError('')
    try {
      await api('/api/checklists', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || `${selTemplate.jobTitle} — ${selTemplate.specialty}`,
          templateId: selTemplate.id,
          candidateName: candidateName.trim() || undefined,
          candidateEmail: candidateEmail.trim() || undefined,
          items: finalItems,
        }),
      })
      setNewOpen(false)
      await refresh()
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : 'Failed to create')
    } finally {
      setCreating(false)
    }
  }

  async function deleteChecklist(id: string) {
    if (!confirm('Delete this checklist and its results? This cannot be undone.')) return
    try {
      await api(`/api/checklists/${id}`, { method: 'DELETE' })
      await refresh()
    } catch { /* surfaced by refresh */ }
  }

  function openInvite(c: ChecklistSummary) {
    setInviteFor(c)
    setInviteTo(c.candidateEmail ?? '')
    setInviteMsg('')
    setInviteResult(null)
  }

  async function sendInvite() {
    if (!inviteFor || !inviteTo.includes('@')) {
      setInviteResult({ ok: false, text: 'Enter a valid email address' })
      return
    }
    setInviteBusy(true)
    setInviteResult(null)
    try {
      const data = await api<{ emailStatus: string; link: string }>(`/api/checklists/${inviteFor.id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ toEmail: inviteTo, message: inviteMsg || undefined }),
      })
      setInviteResult({
        ok: true,
        text:
          data.emailStatus === 'test-mode'
            ? 'Logged in test mode — no real email was sent (email sending is enabled by the platform administrator). The link below still works — you can copy and send it yourself.'
            : 'Invitation sent.',
        link: data.link,
      })
      await refresh()
    } catch (e) {
      setInviteResult({ ok: false, text: e instanceof Error ? e.message : 'Send failed' })
    } finally {
      setInviteBusy(false)
    }
  }

  async function copyLink(c: ChecklistSummary) {
    try {
      const d = await api<{ checklist: { token: string } }>(`/api/checklists/${c.id}`)
      const link = `${window.location.origin}/?c=${d.checklist.token}`
      await navigator.clipboard.writeText(link)
      setCopied(c.id)
      setTimeout(() => setCopied(null), 1800)
    } catch { /* ignore */ }
  }

  const stats = useMemo(() => ({
    total: items.length,
    sent: items.filter((i) => i.status === 'sent').length,
    submitted: items.filter((i) => i.status === 'submitted').length,
  }), [items])

  const selCount = templateItems.reduce((n, c) => n + c.skills.length, 0)

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f172a] flex items-center gap-2.5">
            <ClipboardCheck className="w-6 h-6 text-[#1F7A44]" /> Skills Checklists
          </h1>
          <p className="text-[13px] text-[#64748b] mt-1">
            {stats.total} total · {stats.sent} awaiting candidate · {stats.submitted} completed
          </p>
        </div>
        <Button onClick={openNew} className="h-11 font-bold gap-2"
          style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)', boxShadow: '0 4px 14px rgba(31,122,68,0.30)' }}>
          <Plus className="w-4 h-4" /> New checklist
        </Button>
      </div>

      {error && (
        <div className="mb-4 text-[13px] font-semibold text-[#E5484D] bg-[#FDEEEE] border-l-[3px] border-[#E5484D] rounded-md px-3.5 py-2.5">{error}</div>
      )}

      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <CheckSquare className="w-10 h-10 mx-auto text-[#CBE8D6] mb-3" />
            <div className="font-bold text-[15px] text-[#334155]">No checklists yet</div>
            <p className="text-[13px] text-[#94a3b8] mt-1 max-w-sm mx-auto">
              Create your first checklist from {templates.length} ready-made profession templates, then email it to a candidate.
            </p>
            <Button onClick={openNew} className="mt-4 font-bold gap-2 h-10"
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
              <Plus className="w-4 h-4" /> Create one now
            </Button>
          </div>
        ) : (
          <div className="divide-y divide-[#eef1f6]">
            {items.map((c) => (
              <div key={c.id} className="px-4 sm:px-6 py-4 flex flex-wrap items-center gap-3 hover:bg-[#f8fafc] transition-colors">
                <div className="min-w-0 flex-1 cursor-pointer" onClick={() => onOpenDetail(c.id)}>
                  <div className="font-bold text-[14px] text-[#0f172a] truncate">{c.title}</div>
                  <div className="text-[12px] text-[#94a3b8] mt-0.5 flex flex-wrap gap-x-2">
                    <span className="font-semibold text-[#64748b]">{c.templateLabel}</span>
                    <span>· {c.skillCount} skills</span>
                    {c.candidateName && <span>· {c.candidateName}</span>}
                    {c.candidateEmail && <span className="hidden sm:inline">· {c.candidateEmail}</span>}
                    <span>· {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {c.status === 'submitted' && c.avgRating != null && (
                    <span className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full border bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]">
                      avg {c.avgRating.toFixed(1)}/4
                    </span>
                  )}
                  <StatusChip status={c.status} />
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => copyLink(c)}>
                    {copied === c.id ? <Copy className="w-3.5 h-3.5 text-[#2E9E5B]" /> : <Link2 className="w-3.5 h-3.5" />}
                    {copied === c.id ? 'Copied' : 'Link'}
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => openInvite(c)}>
                    <Mail className="w-3.5 h-3.5" /> Invite
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => onManualEntry(c.id)}>
                    <UserPen className="w-3.5 h-3.5" /> Manual
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => onOpenDetail(c.id)}>
                    <Eye className="w-3.5 h-3.5" /> View
                  </Button>
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-[#E5484D] hover:bg-[#FDEEEE] hover:text-[#C13A3E]"
                    onClick={() => deleteChecklist(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== New checklist dialog ===== */}
      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) setStep('pick') }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{step === 'pick' ? 'New skills checklist' : 'Customize skills'}</DialogTitle>
            <DialogDescription>
              {step === 'pick'
                ? `Pick a template — ${templates.length} profession templates available (Profession → Job Title → Specialty).`
                : 'Remove skills you don\u2019t need. Everything left goes to the candidate.'}
            </DialogDescription>
          </DialogHeader>

          {step === 'pick' ? (
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 text-[#94a3b8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <Input value={pickerSearch} onChange={(e) => setPickerSearch(e.target.value)}
                  placeholder="Search all templates — e.g. “ICU”, “Physical Therapy”, “Endoscopy”…" className="h-11 pl-9" />
              </div>

              {searchResults ? (
                /* Search results */
                <div className="space-y-2 max-h-[46vh] overflow-y-auto">
                  {searchResults.length === 0 && (
                    <div className="text-[13px] text-[#94a3b8] py-4 text-center">No templates match “{pickerSearch}”.</div>
                  )}
                  {searchResults.map((t) => (
                    <button key={t.id} type="button" onClick={() => pickTemplate(t)}
                      className="w-full text-left rounded-2xl border border-[#eaeef5] bg-white p-3.5 hover:border-[#CBE8D6] hover:bg-[#f8fafc] cursor-pointer transition-colors flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-[13.5px] text-[#0f172a] truncate">
                          <span className="text-[#1F7A44]">{t.jobTitle}</span> · {t.specialty}
                        </div>
                        <div className="text-[11.5px] text-[#94a3b8] mt-0.5">{t.profession} · {t.categoryCount} categories · {t.skillCount} skills</div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-[#c3cbd8] shrink-0" />
                    </button>
                  ))}
                </div>
              ) : (
                /* Cascade picker */
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Profession */}
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#334155] mb-1.5">1 · Profession</div>
                    <div className="rounded-2xl border border-[#eaeef5] divide-y divide-[#eaeef5] overflow-hidden max-h-[38vh] overflow-y-auto">
                      {professions.map((p) => (
                        <button key={p} type="button" onClick={() => chooseProfession(p)}
                          className={`w-full text-left px-3.5 py-2.5 text-[13px] font-bold cursor-pointer transition-colors ${
                            selProfession === p ? 'bg-[#E9F5EC] text-[#3730a3]' : 'bg-white text-[#334155] hover:bg-[#f8fafc]'
                          }`}>
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Job title */}
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#334155] mb-1.5">2 · Job title</div>
                    <div className="rounded-2xl border border-[#eaeef5] divide-y divide-[#eaeef5] overflow-hidden max-h-[38vh] overflow-y-auto">
                      {jobTitles.length === 0 && <div className="px-3.5 py-2.5 text-[12px] text-[#94a3b8]">Pick a profession first</div>}
                      {jobTitles.map((j) => (
                        <button key={j} type="button" onClick={() => chooseJobTitle(j)}
                          className={`w-full text-left px-3.5 py-2.5 text-[13px] font-bold cursor-pointer transition-colors ${
                            selJobTitle === j ? 'bg-[#E9F5EC] text-[#3730a3]' : 'bg-white text-[#334155] hover:bg-[#f8fafc]'
                          }`}>
                          {j}
                        </button>
                      ))}
                    </div>
                  </div>
                  {/* Specialty */}
                  <div>
                    <div className="text-[10.5px] font-bold uppercase tracking-wider text-[#334155] mb-1.5">3 · Specialty</div>
                    <div className="rounded-2xl border border-[#eaeef5] divide-y divide-[#eaeef5] overflow-hidden max-h-[38vh] overflow-y-auto">
                      {specialties.length === 0 && <div className="px-3.5 py-2.5 text-[12px] text-[#94a3b8]">Pick a job title first</div>}
                      {specialties.map((t) => (
                        <button key={t.id} type="button" onClick={() => pickTemplate(t)} disabled={loadingSkills}
                          className="w-full text-left px-3.5 py-2.5 cursor-pointer transition-colors bg-white hover:bg-[#f8fafc] disabled:opacity-50">
                          <div className="text-[13px] font-bold text-[#334155]">{t.specialty}</div>
                          <div className="text-[11px] text-[#94a3b8] mt-0.5">{t.categoryCount} categories · {t.skillCount} skills</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {loadingSkills && <div className="flex items-center gap-2 text-[13px] text-[#64748b]"><Loader2 className="w-4 h-4 animate-spin" /> Loading skills…</div>}
              {createError && <div className="text-[13px] font-semibold text-[#E5484D]">{createError}</div>}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Candidate name (optional)</Label>
                  <Input value={candidateName} onChange={(e) => setCandidateName(e.target.value)} placeholder="Jane Doe" className="h-11 mt-1.5" />
                </div>
                <div>
                  <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Candidate email (optional)</Label>
                  <Input type="email" value={candidateEmail} onChange={(e) => setCandidateEmail(e.target.value)} placeholder="jane@email.com" className="h-11 mt-1.5" />
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {selTemplate && (
                <div className="flex items-center gap-2 text-[12.5px] text-[#64748b] flex-wrap">
                  <span className="font-bold text-[#1F7A44]">{selTemplate.profession}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-bold text-[#334155]">{selTemplate.jobTitle}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                  <span className="font-bold text-[#334155]">{selTemplate.specialty}</span>
                  <span className="ml-auto">{selCount} skills selected</span>
                </div>
              )}
              <div>
                <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Checklist title</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. ICU RN — John Doe" className="h-11 mt-1.5" maxLength={160} />
              </div>
              <div className="max-h-[46vh] overflow-y-auto rounded-2xl border border-[#eef1f6] divide-y divide-[#eef1f6]">
                {templateItems.map((c) => (
                  <div key={c.category} className="p-3.5">
                    <div className="font-bold text-[12.5px] text-[#334155] uppercase tracking-wide mb-2 flex items-center justify-between">
                      <span>{c.category}</span>
                      <button type="button" className="text-[11px] font-bold text-[#E5484D] cursor-pointer"
                        onClick={() => setTemplateItems((its) => its.filter((x) => x.category !== c.category))}>
                        Remove category
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.skills.map((s) => (
                        <button key={s.name} type="button" onClick={() => toggleSkill(c.category, s.name)}
                          title="Click to remove this skill"
                          className="text-[12px] font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors bg-[#E9F5EC] border-[#CBE8D6] text-[#3730a3] hover:bg-[#FDEEEE] hover:border-[#F3B8BA] hover:text-[#C13A3E]">
                          {s.name}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {createError && <div className="text-[13px] font-semibold text-[#E5484D]">{createError}</div>}
              <DialogFooter className="flex !justify-between sm:!justify-between gap-2">
                <Button variant="ghost" onClick={() => setStep('pick')}>Back</Button>
                <Button onClick={createChecklist} disabled={creating || selCount === 0} className="font-bold gap-2"
                  style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create checklist ({selCount} skills)
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ===== Invite dialog ===== */}
      <Dialog open={!!inviteFor} onOpenChange={(o) => { if (!o) setInviteFor(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-[#1F7A44]" /> Email this checklist</DialogTitle>
            <DialogDescription>
              The candidate receives a link they can open on any device — no account needed.
              {inviteFor && (
                <span className="block mt-1 font-semibold text-[#334155]">{inviteFor.title}</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Send to</Label>
              <Input type="email" value={inviteTo} onChange={(e) => setInviteTo(e.target.value)} placeholder="candidate@email.com" className="h-11 mt-1.5" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Personal message (optional)</Label>
              <textarea value={inviteMsg} onChange={(e) => setInviteMsg(e.target.value)} rows={3} maxLength={2000}
                placeholder="Hi Jane — please complete this checklist at your convenience. It takes about 10 minutes."
                className="w-full mt-1.5 rounded-xl border border-[#d8dee9] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#1F7A44] focus:ring-4 focus:ring-[rgba(31,122,68,0.12)] resize-none" />
            </div>
            {inviteResult && (
              <div className={`rounded-[10px] border-l-[3px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                inviteResult.ok ? 'border-[#34A853] text-[#2E9E5B] bg-[#E9F5EC]' : 'border-[#E5484D] text-[#E5484D] bg-[#FDEEEE]'
              }`}>
                {inviteResult.text}
                {inviteResult.link && (
                  <div className="mt-2 flex items-center gap-2">
                    <code className="text-[11px] bg-white border border-[#e2e7f0] rounded-lg px-2 py-1.5 break-all flex-1 text-[#334155]">{inviteResult.link}</code>
                    <Button variant="ghost" size="sm" className="h-9 shrink-0" onClick={() => navigator.clipboard.writeText(inviteResult.link!).then(() => setCopied(inviteFor!.id)).catch(() => {})}>
                      <Copy className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setInviteFor(null)}>Close</Button>
            <Button onClick={sendInvite} disabled={inviteBusy} className="font-bold gap-2"
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
              {inviteBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send invitation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusChip({ status }: { status: ChecklistSummary['status'] }) {
  const map: Record<ChecklistSummary['status'], { text: string; cls: string }> = {
    draft: { text: 'Draft', cls: 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]' },
    sent: { text: 'Awaiting candidate', cls: 'bg-[#E9F5EC] border-[#CBE8D6] text-[#1E6B3C]' },
    submitted: { text: 'Completed', cls: 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]' },
  }
  const m = map[status] ?? map.draft
  return (
    <span className={`text-[10.5px] font-bold tracking-[0.4px] uppercase px-2 py-1 rounded-full border ${m.cls}`}>
      {m.text}
    </span>
  )
}
