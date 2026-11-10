'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api } from '@/lib/client-api'
import { TEMPLATES, getTemplate } from '@/lib/templates'
import type { ChecklistSummary } from '@/lib/types'
import { CheckSquare, ClipboardCheck, Copy, Eye, Link2, Loader2, Mail, Plus, Send, Trash2, UserPen, Users2 } from 'lucide-react'

type TemplateSummary = { key: string; label: string; description: string; categories: number; skills: number }
type WizardItems = { category: string; skills: { skill: string; kept: boolean }[] }[]

type Props = {
  onOpenDetail: (id: string) => void
  onManualEntry: (id: string) => void
}

export function ChecklistsView({ onOpenDetail, onManualEntry }: Props) {
  const [items, setItems] = useState<ChecklistSummary[]>([])
  const [templates, setTemplates] = useState<TemplateSummary[]>([])
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
    api<{ templates: TemplateSummary[] }>('/api/templates')
      .then((d) => setTemplates(d.templates))
      .catch(() => {})
  }, [refresh])

  // New checklist dialog state
  const [newOpen, setNewOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<'pick' | 'customize'>('pick')
  const [title, setTitle] = useState('')
  const [templateKey, setTemplateKey] = useState<string>('')
  const [candidateName, setCandidateName] = useState('')
  const [candidateEmail, setCandidateEmail] = useState('')
  const [wizardItems, setWizardItems] = useState<WizardItems>([])
  const [customSkill, setCustomSkill] = useState<Record<string, string>>({})
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Invite dialog state
  const [inviteFor, setInviteFor] = useState<ChecklistSummary | null>(null)
  const [inviteTo, setInviteTo] = useState('')
  const [inviteMsg, setInviteMsg] = useState('')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [inviteResult, setInviteResult] = useState<{ ok: boolean; text: string; link?: string } | null>(null)

  const [copied, setCopied] = useState<string | null>(null)

  function openNew() {
    setNewOpen(true)
    setWizardStep('pick')
    setTitle('')
    setTemplateKey('')
    setCandidateName('')
    setCandidateEmail('')
    setWizardItems([])
    setCustomSkill({})
    setCreateError('')
  }

  function pickTemplate(key: string) {
    const t = getTemplate(key)
    if (!t) return
    setTemplateKey(key)
    if (!title) setTitle(t.label.split('— ')[1] ?? t.label)
    setWizardItems(t.items.map((c) => ({ category: c.category, skills: c.skills.map((s) => ({ skill: s, kept: true })) })))
    setWizardStep('customize')
  }

  function toggleSkill(cat: string, skill: string) {
    setWizardItems((its) =>
      its.map((c) =>
        c.category === cat
          ? { ...c, skills: c.skills.map((s) => (s.skill === skill ? { ...s, kept: !s.kept } : s)) }
          : c
      )
    )
  }

  function addCustomSkill(cat: string) {
    const v = (customSkill[cat] ?? '').trim()
    if (!v) return
    setWizardItems((its) => its.map((c) => (c.category === cat ? { ...c, skills: [...c.skills, { skill: v, kept: true }] } : c)))
    setCustomSkill((m) => ({ ...m, [cat]: '' }))
  }

  async function createChecklist() {
    const finalItems = wizardItems
      .map((c) => ({ category: c.category, skills: c.skills.filter((s) => s.kept).map((s) => s.skill) }))
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
          title: title.trim() || 'Skills Checklist',
          templateKey,
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
            ? 'Logged in test mode (no real email sent — add a Brevo API key and turn off test mode in Superadmin → Platform). The link below still works — you can copy and send it yourself.'
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

  return (
    <div className="max-w-[1100px] mx-auto">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f172a] flex items-center gap-2.5">
            <ClipboardCheck className="w-6 h-6 text-[#4f46e5]" /> Skills Checklists
          </h1>
          <p className="text-[13px] text-[#64748b] mt-1">
            {stats.total} total · {stats.sent} awaiting candidate · {stats.submitted} completed
          </p>
        </div>
        <Button onClick={openNew} className="h-11 font-bold gap-2"
          style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)', boxShadow: '0 4px 14px rgba(79,70,229,0.30)' }}>
          <Plus className="w-4 h-4" /> New checklist
        </Button>
      </div>

      {error && (
        <div className="mb-4 text-[13px] font-semibold text-[#dc2626] bg-[#fef2f2] border-l-[3px] border-[#dc2626] rounded-md px-3.5 py-2.5">{error}</div>
      )}

      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] overflow-hidden">
        {loading ? (
          <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : items.length === 0 ? (
          <div className="py-16 px-6 text-center">
            <CheckSquare className="w-10 h-10 mx-auto text-[#c7d2fe] mb-3" />
            <div className="font-bold text-[15px] text-[#334155]">No checklists yet</div>
            <p className="text-[13px] text-[#94a3b8] mt-1 max-w-sm mx-auto">
              Create your first checklist from a ready-made RN / LPN / CNA / PT / OT / RT template, then email it to a candidate.
            </p>
            <Button onClick={openNew} className="mt-4 font-bold gap-2 h-10"
              style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)' }}>
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
                    <span className="uppercase tracking-wide">{c.templateKey}</span>
                    <span>· {c.skillCount} skills</span>
                    {c.candidateName && <span>· {c.candidateName}</span>}
                    {c.candidateEmail && <span className="hidden sm:inline">· {c.candidateEmail}</span>}
                    <span>· {new Date(c.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {c.status === 'submitted' && c.avgRating != null && (
                    <span className="text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full border bg-[#dcfce7] border-[#86efac] text-[#15803d]">
                      avg {c.avgRating.toFixed(1)}
                    </span>
                  )}
                  <StatusChip status={c.status} />
                  <Button variant="ghost" size="sm" className="h-9 gap-1.5" onClick={() => copyLink(c)}>
                    {copied === c.id ? <Copy className="w-3.5 h-3.5 text-[#059669]" /> : <Link2 className="w-3.5 h-3.5" />}
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
                  <Button variant="ghost" size="sm" className="h-9 text-[#dc2626] hover:bg-[#fef2f2] hover:text-[#b91c1c]"
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
      <Dialog open={newOpen} onOpenChange={(o) => { setNewOpen(o); if (!o) setWizardStep('pick') }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{wizardStep === 'pick' ? 'New skills checklist' : 'Customize skills'}</DialogTitle>
            <DialogDescription>
              {wizardStep === 'pick'
                ? 'Pick a template — you can trim or add skills on the next step.'
                : 'Uncheck skills you don\u2019t need, or add your own. Everything left checked goes to the candidate.'}
            </DialogDescription>
          </DialogHeader>

          {wizardStep === 'pick' ? (
            <div className="space-y-4">
              <div>
                <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Checklist title (optional)</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. RN Med-Surg — John Doe" className="h-11 mt-1.5" maxLength={160} />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                {templates.map((t) => (
                  <button key={t.key} type="button" onClick={() => pickTemplate(t.key)}
                    className="text-left rounded-2xl border border-[#eaeef5] bg-white p-4 hover:border-[#c7d2fe] hover:bg-[#f8fafc] cursor-pointer transition-colors">
                    <div className="font-bold text-[13.5px] text-[#0f172a]">{t.label}</div>
                    <div className="text-[11.5px] text-[#94a3b8] mt-1 leading-relaxed">{t.description}</div>
                    <div className="text-[11px] text-[#4f46e5] font-bold mt-2">{t.categories} categories · {t.skills} skills</div>
                  </button>
                ))}
              </div>
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
              <div className="flex items-center gap-2 text-[12.5px] text-[#64748b]">
                <Users2 className="w-3.5 h-3.5" />
                {wizardItems.reduce((n, c) => n + c.skills.filter((s) => s.kept).length, 0)} skills selected ·{' '}
                {wizardItems.filter((c) => c.skills.some((s) => s.kept)).length} categories
                <button type="button" className="ml-auto text-[12.5px] font-bold text-[#4f46e5] cursor-pointer"
                  onClick={() => setWizardItems((its) => its.map((c) => ({ ...c, skills: c.skills.map((s) => ({ ...s, kept: false })) })))}>
                  Clear all
                </button>
              </div>
              <div className="max-h-[46vh] overflow-y-auto rounded-2xl border border-[#eef1f6] divide-y divide-[#eef1f6]">
                {wizardItems.map((c) => (
                  <div key={c.category} className="p-3.5">
                    <div className="font-bold text-[12.5px] text-[#334155] uppercase tracking-wide mb-2">{c.category}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {c.skills.map((s) => (
                        <label key={s.skill} className={`text-[12px] font-medium px-2.5 py-1.5 rounded-lg border cursor-pointer transition-colors flex items-center gap-1.5 ${
                          s.kept ? 'bg-[#eef2ff] border-[#c7d2fe] text-[#3730a3]' : 'bg-white border-[#e2e7f0] text-[#94a3b8]'
                        }`}>
                          <input type="checkbox" checked={s.kept} onChange={() => toggleSkill(c.category, s.skill)} className="accent-[#4f46e5]" />
                          {s.skill}
                        </label>
                      ))}
                    </div>
                    <div className="flex gap-2 mt-2">
                      <Input value={customSkill[c.category] ?? ''} onChange={(e) => setCustomSkill((m) => ({ ...m, [c.category]: e.target.value }))}
                        placeholder="Add a custom skill to this category" className="h-9 text-[13px]" onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustomSkill(c.category) } }} />
                      <Button type="button" variant="outline" className="h-9 px-3 text-[12.5px]" onClick={() => addCustomSkill(c.category)}>Add</Button>
                    </div>
                  </div>
                ))}
              </div>
              {createError && <div className="text-[13px] font-semibold text-[#dc2626]">{createError}</div>}
              <DialogFooter className="flex !justify-between sm:!justify-between gap-2">
                <Button variant="ghost" onClick={() => setWizardStep('pick')}>Back</Button>
                <Button onClick={createChecklist} disabled={creating} className="font-bold gap-2"
                  style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)' }}>
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Create checklist
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
            <DialogTitle className="flex items-center gap-2"><Send className="w-4 h-4 text-[#4f46e5]" /> Email this checklist</DialogTitle>
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
                className="w-full mt-1.5 rounded-xl border border-[#d8dee9] px-3.5 py-2.5 text-[14px] outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[rgba(79,70,229,0.12)] resize-none" />
            </div>
            {inviteResult && (
              <div className={`rounded-[10px] border-l-[3px] px-3.5 py-2.5 text-[13px] leading-relaxed ${
                inviteResult.ok ? 'border-[#10b981] text-[#059669] bg-[#ecfdf5]' : 'border-[#dc2626] text-[#dc2626] bg-[#fef2f2]'
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
              style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)' }}>
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
    sent: { text: 'Awaiting candidate', cls: 'bg-[#eef2ff] border-[#c7d2fe] text-[#4338ca]' },
    submitted: { text: 'Completed', cls: 'bg-[#dcfce7] border-[#86efac] text-[#15803d]' },
  }
  const m = map[status] ?? map.draft
  return (
    <span className={`text-[10.5px] font-bold tracking-[0.4px] uppercase px-2 py-1 rounded-full border ${m.cls}`}>
      {m.text}
    </span>
  )
}
