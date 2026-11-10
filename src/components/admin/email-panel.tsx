'use client'

// Superadmin → Email: Brevo transactional settings, the full branded SMTP
// template library (live preview + per-template test send + reset), send log.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import { api } from '@/lib/client-api'
import { renderTemplate } from '@/lib/template-render'
import type { EmailTemplateView, PlatformSettingsView } from '@/lib/types'
import {
  AlertTriangle, BadgeCheck, Eye, History, Loader2, Mail, MailOpen, Mails, Monitor, RotateCcw, RefreshCw, Save, Send, Smartphone,
} from 'lucide-react'

type EmailLog = {
  id: string; toEmail: string; subject: string; purpose: string; status: string; error: string | null; providerMessageId: string | null; createdAt: string
}

type BrevoStatus = {
  authenticated: boolean
  reason?: string
  error?: string
  testMode: boolean
  senderEmail: string
  senderName: string
  senderDomain: string
  account?: { email: string; name?: string; company?: string; planType?: string; planCredits?: number }
  senders: { email: string; name: string; active: boolean }[]
  senderVerified?: boolean
  senderFreeMail?: boolean
}

export function EmailPanel() {
  const [settings, setSettings] = useState<PlatformSettingsView | null>(null)
  const [adminEmail, setAdminEmail] = useState('')
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [templates, setTemplates] = useState<EmailTemplateView[]>([])
  const [loading, setLoading] = useState(true)
  const [brevoStatus, setBrevoStatus] = useState<BrevoStatus | null>(null)
  const [statusBusy, setStatusBusy] = useState(false)

  // form state — Brevo settings
  const [brevoKey, setBrevoKey] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [testMode, setTestMode] = useState(true)
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  // test email (Brevo settings card)
  const [testTo, setTestTo] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  // template editor dialog
  const [editing, setEditing] = useState<EmailTemplateView | null>(null)
  const [tplSubject, setTplSubject] = useState('')
  const [tplHtml, setTplHtml] = useState('')
  const [tplActive, setTplActive] = useState(true)
  const [device, setDevice] = useState<'desktop' | 'mobile'>('desktop')
  const [tplTestTo, setTplTestTo] = useState('')
  const [tplBusy, setTplBusy] = useState(false)
  const [tplMsg, setTplMsg] = useState('')
  const [tplError, setTplError] = useState('')
  const [tplTestBusy, setTplTestBusy] = useState(false)
  const [tplTestResult, setTplTestResult] = useState<{ ok: boolean; text: string } | null>(null)
  const htmlRef = useRef<HTMLTextAreaElement>(null)

  const refreshBrevoStatus = useCallback(async () => {
    setStatusBusy(true)
    try {
      setBrevoStatus(await api<BrevoStatus>('/api/admin/email-status'))
    } catch { setBrevoStatus(null) } finally { setStatusBusy(false) }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [s, l, t] = await Promise.all([
        api<{ settings: PlatformSettingsView; adminEmail: string }>('/api/admin/settings'),
        api<{ logs: EmailLog[] }>('/api/admin/email-logs'),
        api<{ templates: EmailTemplateView[] }>('/api/admin/email-templates'),
      ])
      setSettings(s.settings)
      setAdminEmail(s.adminEmail)
      setSenderEmail(s.settings.brevoSenderEmail)
      setSenderName(s.settings.brevoSenderName)
      setTestMode(s.settings.emailTestMode)
      setTestTo(s.adminEmail)
      setLogs(l.logs)
      setTemplates(t.templates)
    } catch { /* handled by empty renders */ } finally {
      setLoading(false)
    }
    refreshBrevoStatus()
  }, [refreshBrevoStatus])

  useEffect(() => { refresh() }, [refresh])

  async function saveBrevo() {
    setBusy(true); setSaveMsg(''); setSaveError('')
    try {
      const data = await api<{ settings: PlatformSettingsView }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          brevoApiKey: brevoKey.trim() || undefined,
          brevoSenderEmail: senderEmail.trim() || undefined,
          brevoSenderName: senderName.trim() || undefined,
          emailTestMode: testMode,
        }),
      })
      setSettings(data.settings)
      setBrevoKey('')
      setSaveMsg('Brevo settings saved.')
      setTimeout(() => setSaveMsg(''), 3000)
      refreshBrevoStatus()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setTestBusy(true); setTestResult(null)
    try {
      const data = await api<{ emailStatus: string; sentTo: string; messageId?: string }>('/api/admin/test-email', {
        method: 'POST',
        body: JSON.stringify({ to: testTo }),
      })
      setTestResult({
        ok: true,
        text: data.emailStatus === 'test-mode'
          ? `Logged in test mode — no real email sent to ${data.sentTo}. Add a Brevo API key and disable test mode to send for real.`
          : `Sent to ${data.sentTo} — accepted by Brevo${data.messageId ? ` (id ${data.messageId.slice(0, 26)}…)` : ''}. If it hasn't arrived in a few minutes, check the spam folder — see the deliverability note above.`,
      })
      refresh()
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : 'Test email failed' })
    } finally {
      setTestBusy(false)
    }
  }

  // ─── Template actions ──────────────────────────────────────────────

  function openTemplate(t: EmailTemplateView) {
    setEditing(t)
    setTplSubject(t.subject)
    setTplHtml(t.bodyHtml)
    setTplActive(t.isActive)
    setTplTestTo(adminEmail)
    setTplMsg(''); setTplError(''); setTplTestResult(null)
  }

  async function saveTemplate() {
    if (!editing) return
    setTplBusy(true); setTplMsg(''); setTplError('')
    try {
      const data = await api<{ template: EmailTemplateView }>('/api/admin/email-templates', {
        method: 'PUT',
        body: JSON.stringify({
          key: editing.key,
          subject: tplSubject,
          bodyHtml: tplHtml,
          isActive: tplActive,
        }),
      })
      setTemplates((list) => list.map((t) => (t.key === data.template.key ? data.template : t)))
      setTplMsg('Template saved — this exact HTML now goes out to recipients.')
      setTimeout(() => setTplMsg(''), 4000)
    } catch (e) {
      setTplError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setTplBusy(false)
    }
  }

  async function resetTemplate() {
    if (!editing) return
    setTplBusy(true); setTplMsg(''); setTplError('')
    try {
      await api('/api/admin/email-templates/reset', {
        method: 'POST',
        body: JSON.stringify({ key: editing.key }),
      })
      const data = await api<{ templates: EmailTemplateView[] }>('/api/admin/email-templates')
      setTemplates(data.templates)
      const reverted = data.templates.find((t) => t.key === editing.key)
      if (reverted) {
        setTplSubject(reverted.subject)
        setTplHtml(reverted.bodyHtml)
        setTplActive(reverted.isActive)
      }
      setTplMsg('Reverted to the built-in VaultVerify default.')
      setTimeout(() => setTplMsg(''), 4000)
    } catch (e) {
      setTplError(e instanceof Error ? e.message : 'Reset failed')
    } finally {
      setTplBusy(false)
    }
  }

  async function resetAllTemplates() {
    setTplBusy(true)
    try {
      await api('/api/admin/email-templates/reset', {
        method: 'POST',
        body: JSON.stringify({ all: true }),
      })
      await refresh()
    } catch { /* list refresh shows the truth */ } finally {
      setTplBusy(false)
    }
  }

  async function sendTemplateTest() {
    if (!editing) return
    setTplTestBusy(true); setTplTestResult(null)
    try {
      const data = await api<{ emailStatus: string; sentTo: string; messageId?: string }>('/api/admin/test-email', {
        method: 'POST',
        body: JSON.stringify({ to: tplTestTo || adminEmail, templateKey: editing.key }),
      })
      setTplTestResult({
        ok: true,
        text: data.emailStatus === 'test-mode'
          ? `Logged in test mode — no real email sent to ${data.sentTo}.`
          : `Sent this template to ${data.sentTo} — accepted by Brevo${data.messageId ? ` (id ${data.messageId.slice(0, 26)}…)` : ''}. Not in the inbox? Check the spam folder.`,
      })
      refresh()
    } catch (e) {
      setTplTestResult({ ok: false, text: e instanceof Error ? e.message : 'Test send failed' })
    } finally {
      setTplTestBusy(false)
    }
  }

  async function toggleTemplate(t: EmailTemplateView, active: boolean) {
    // quick-toggle from the list (automated templates only)
    try {
      const data = await api<{ template: EmailTemplateView }>('/api/admin/email-templates', {
        method: 'PUT',
        body: JSON.stringify({ key: t.key, subject: t.subject, bodyHtml: t.bodyHtml, isActive: active }),
      })
      setTemplates((list) => list.map((x) => (x.key === data.template.key ? data.template : x)))
    } catch { /* keep old state on failure */ }
  }

  // Live preview: sample vars + the CURRENT Brevo sender identity.
  const previewVars = useMemo(() => {
    if (!editing) return {}
    return {
      ...editing.sampleVars,
      sender_name: settings?.brevoSenderName || 'VaultVerify',
      sender_email: settings?.brevoSenderEmail || '',
      valid_days: '30',
      mode: settings?.emailTestMode ? 'TEST MODE (logged, not delivered)' : 'LIVE',
      sent_at: new Date().toLocaleString(),
    }
  }, [editing, settings?.brevoSenderName, settings?.brevoSenderEmail, settings?.emailTestMode])

  const previewHtml = useMemo(() => renderTemplate(tplHtml, previewVars), [tplHtml, previewVars])
  const previewSubject = useMemo(() => renderTemplate(tplSubject, previewVars), [tplSubject, previewVars])

  function insertVar(v: string) {
    const el = htmlRef.current
    if (!el) return
    const token = `{{${v}}}`
    const start = el.selectionStart ?? tplHtml.length
    const end = el.selectionEnd ?? start
    const next = tplHtml.slice(0, start) + token + tplHtml.slice(end)
    setTplHtml(next)
    requestAnimationFrame(() => {
      el.focus()
      el.selectionStart = el.selectionEnd = start + token.length
    })
  }

  if (loading) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {/* ─── Brevo settings ─────────────────────────────────────────── */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] divide-y divide-[#eef1f6]">
        <div className="px-6 sm:px-7 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#1F7A44]" /> Brevo transactional email
          </h2>
          <p className="text-[12px] text-[#94a3b8] mb-3.5">
            All templates below are delivered through Brevo. Generate an <strong>API v3 key</strong> (starts with <code>xkeysib-</code>) at
            <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" className="text-[#1F7A44] font-bold ml-1">app.brevo.com → SMTP &amp; API → API keys</a>.
            SMTP keys (<code>xsmtpsib-…</code>) only work on the SMTP relay, not with this API — the REST endpoint is what the app uses (it also works on Vercel serverless).
            {settings?.brevoApiKeySet && (
              <span className="block mt-1">Current key: <code className="bg-[#f1f5f9] rounded px-1.5 py-0.5">{settings.brevoApiKeyMasked}</code></span>
            )}
          </p>

          <BrevoAccountStrip status={brevoStatus} busy={statusBusy} onRefresh={refreshBrevoStatus} />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Brevo API key</Label>
              <Input type="password" value={brevoKey} onChange={(e) => setBrevoKey(e.target.value)}
                placeholder={settings?.brevoApiKeySet ? 'Saved — enter a new key to replace' : 'xkeysib-…'} className="h-11 mt-1.5" autoComplete="off" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Sender email</Label>
              <Input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="myzipvault@gmail.com" className="h-11 mt-1.5" />
              <p className="text-[11px] text-[#94a3b8] mt-1.5">Must be added &amp; verified as a sender in Brevo (Senders &amp; IP). Stamps every template footer.</p>
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Sender name</Label>
              <Input value={senderName} onChange={(e) => setSenderName(e.target.value)} className="h-11 mt-1.5" maxLength={120} />
            </div>
            <div className="flex items-center gap-3.5 self-end rounded-2xl border border-[#e2e8f0] bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] px-4 py-3">
              <Switch checked={testMode} onCheckedChange={setTestMode} />
              <div className="flex-1">
                <strong className="block text-[13.5px] font-bold text-[#0f172a]">Test mode</strong>
                <span className="block text-[11.5px] text-[#64748b] mt-0.5 leading-snug">Log sends without delivering. Turn off once your key works.</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mt-4">
            <Button onClick={saveBrevo} disabled={busy} className="font-bold gap-2 h-11"
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Brevo settings
            </Button>
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)}
                placeholder={adminEmail ? `Send test to ${adminEmail}` : 'Send test to'} className="h-11" />
              <Button variant="outline" onClick={sendTest} disabled={testBusy} className="h-11 gap-2 font-bold shrink-0">
                {testBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test email
              </Button>
            </div>
          </div>

          {(saveMsg || saveError) && (
            <div className={`mt-3 text-[12.5px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
              saveMsg ? 'text-[#2E9E5B] bg-[#E9F5EC] border-[#34A853]' : 'text-[#E5484D] bg-[#FDEEEE] border-[#E5484D]'
            }`}>{saveMsg || saveError}</div>
          )}
          {testResult && (
            <div className={`mt-3 text-[12.5px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
              testResult.ok ? 'text-[#2E9E5B] bg-[#E9F5EC] border-[#34A853]' : 'text-[#E5484D] bg-[#FDEEEE] border-[#E5484D]'
            }`}>{testResult.text}</div>
          )}
        </div>
      </div>

      {/* ─── Email templates ───────────────────────────────────────── */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] divide-y divide-[#eef1f6]">
        <div className="px-6 sm:px-7 py-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-1 flex items-center gap-2">
                <Mails className="w-4 h-4 text-[#1F7A44]" /> SMTP email templates ({templates.length})
              </h2>
              <p className="text-[12px] text-[#94a3b8] max-w-[560px]">
                Every email the platform sends, fully branded — click any template to edit its subject &amp; HTML,
                preview it live, send yourself a test, or reset it to the VaultVerify default.
              </p>
            </div>
            <Button variant="outline" onClick={resetAllTemplates} disabled={tplBusy} className="h-10 gap-2 text-[12.5px] font-bold shrink-0">
              <RotateCcw className="w-4 h-4" /> Reset all to defaults
            </Button>
          </div>

          <div className="mt-4 divide-y divide-[#eef1f6] rounded-2xl border border-[#eef1f6] overflow-hidden">
            {templates.map((t) => (
              <div key={t.key} className="px-4 py-3.5 flex items-center gap-4 flex-wrap bg-[#fbfdfc] hover:bg-[#f4f9f6] transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[13.5px] font-bold text-[#0f172a]">{t.name}</span>
                    <span className={`text-[9.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                      t.automated ? 'bg-[#E9F5EC] border-[#CBE8D6] text-[#1E6B3C]' : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]'
                    }`}>{t.automated ? 'Automated' : 'On demand'}</span>
                    {!t.isActive && (
                      <span className="text-[9.5px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-[#FDEEEE] border-[#F3B8BA] text-[#C13A3E]">Off</span>
                    )}
                  </div>
                  <div className="text-[11.5px] text-[#94a3b8] mt-1 truncate max-w-[520px]">{t.description}</div>
                  <div className="text-[11.5px] text-[#334155] mt-0.5 truncate max-w-[520px]">
                    <span className="text-[#94a3b8]">Subject:</span> <code className="bg-[#f1f5f9] rounded px-1 py-0.5">{t.subject}</code>
                  </div>
                </div>
                <div className="flex items-center gap-3 ml-auto shrink-0">
                  {t.automated && (
                    <Switch checked={t.isActive} onCheckedChange={(v) => toggleTemplate(t, v)} />
                  )}
                  <Button variant="outline" className="h-9 gap-2 text-[12.5px] font-bold" onClick={() => openTemplate(t)}>
                    <Eye className="w-4 h-4" /> Preview &amp; edit
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Send log ──────────────────────────────────────────────── */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)]">
        <div className="px-6 sm:px-7 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
            <History className="w-4 h-4 text-[#1F7A44]" /> Send log (last 50)
          </h2>
          <div className="rounded-2xl border border-[#eef1f6] max-h-72 overflow-y-auto divide-y divide-[#eef1f6]">
            {logs.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-[#94a3b8]">No emails logged yet.</div>}
            {logs.map((l) => (
              <div key={l.id} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                  l.status === 'sent' ? 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]'
                    : l.status === 'test-mode' ? 'bg-[#E9F5EC] border-[#CBE8D6] text-[#1E6B3C]'
                      : 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]'
                }`}>{l.status}</span>
                <span className="text-[10px] font-bold uppercase tracking-wide text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] px-1.5 py-0.5 rounded-full">{l.purpose}</span>
                <span className="text-[13px] font-semibold text-[#334155] truncate max-w-[220px]">{l.toEmail}</span>
                <span className="text-[12px] text-[#94a3b8] flex-1 truncate">{l.subject}{l.error ? ` — ${l.error}` : ''}</span>
                {l.providerMessageId && (
                  <code title={l.providerMessageId} className="text-[10px] font-mono text-[#94a3b8] bg-[#f8fafc] border border-[#eef1f6] rounded px-1.5 py-0.5 truncate max-w-[190px]">
                    {l.providerMessageId.length > 26 ? l.providerMessageId.slice(0, 26) + '…' : l.providerMessageId}
                  </code>
                )}
                <span className="text-[11px] text-[#94a3b8]">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── Template editor + live preview dialog ──────────────────── */}
      <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-[1120px] w-[95vw] max-h-[92vh] overflow-y-auto p-0 gap-0">
          {editing && (
            <>
              <DialogHeader className="px-6 sm:px-7 pt-6 pb-4 border-b border-[#eef1f6]">
                <DialogTitle className="flex items-center gap-2.5 text-[17px] font-extrabold text-[#0f172a]">
                  <MailOpen className="w-5 h-5 text-[#1F7A44]" /> {editing.name}
                </DialogTitle>
                <DialogDescription className="text-[12.5px] text-[#64748b]">{editing.description}</DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
                {/* Edit column */}
                <div className="px-6 sm:px-7 py-5 border-b lg:border-b-0 lg:border-r border-[#eef1f6]">
                  <div className="flex items-center justify-between mb-3.5">
                    <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Subject</Label>
                    <span className="text-[11px] text-[#94a3b8]">Placeholders: <code className="bg-[#f1f5f9] rounded px-1 py-0.5">{'{{var}}'}</code></span>
                  </div>
                  <Input value={tplSubject} onChange={(e) => setTplSubject(e.target.value)} className="h-11 font-medium" maxLength={300} />

                  <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155] block mt-4 mb-2">HTML body</Label>
                  <Textarea
                    ref={htmlRef}
                    value={tplHtml}
                    onChange={(e) => setTplHtml(e.target.value)}
                    className="font-mono text-[11.5px] leading-relaxed min-h-[300px] max-h-[560px]"
                    spellCheck={false}
                  />

                  <p className="text-[11px] text-[#94a3b8] mt-2">Click a variable to insert it at the cursor:</p>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {Object.keys(editing.sampleVars).map((v) => (
                      <button key={v} type="button" onClick={() => insertVar(v)}
                        className="text-[10.5px] font-mono bg-[#EDF6F1] border border-[#CBE8D6] text-[#1E6B3C] rounded-full px-2 py-0.5 hover:bg-[#DFF2E3] transition-colors"
                        title={`Insert {{${v}}}`}>
                        {'{{' + v + '}}'}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3.5 mt-4 rounded-2xl border border-[#e2e8f0] bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] px-4 py-3">
                    <Switch checked={tplActive} onCheckedChange={setTplActive} />
                    <div className="flex-1">
                      <strong className="block text-[13.5px] font-bold text-[#0f172a]">
                        {editing.automated ? 'Template enabled' : 'Always sent'}
                      </strong>
                      <span className="block text-[11.5px] text-[#64748b] mt-0.5 leading-snug">
                        {editing.automated
                          ? 'Automated emails only go out while this is on.'
                          : 'This template is sent on demand (recruiter/superadmin action), so it always fires.'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Preview column */}
                <div className="px-6 sm:px-7 py-5 bg-[#f8fafc]">
                  <div className="flex items-center justify-between mb-3.5 gap-3 flex-wrap">
                    <div>
                      <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Live preview</Label>
                      <p className="text-[11px] text-[#94a3b8] mt-1 truncate max-w-[340px]">
                        <strong className="text-[#334155]">Subject:</strong> {previewSubject || '—'}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 rounded-full border border-[#e2e8f0] bg-white p-1">
                      <button type="button" onClick={() => setDevice('desktop')}
                        className={`flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 transition-colors ${device === 'desktop' ? 'bg-[#EDF6F1] text-[#1E6B3C]' : 'text-[#64748b] hover:bg-[#f1f5f9]'}`}>
                        <Monitor className="w-3.5 h-3.5" /> Desktop
                      </button>
                      <button type="button" onClick={() => setDevice('mobile')}
                        className={`flex items-center gap-1.5 text-[11px] font-bold rounded-full px-2.5 py-1 transition-colors ${device === 'mobile' ? 'bg-[#EDF6F1] text-[#1E6B3C]' : 'text-[#64748b] hover:bg-[#f1f5f9]'}`}>
                        <Smartphone className="w-3.5 h-3.5" /> Mobile
                      </button>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-[#e2e8f0] bg-white overflow-hidden flex justify-center">
                    <iframe
                      title="Email template preview"
                      srcDoc={previewHtml}
                      sandbox=""
                      className="border-0 bg-white"
                      style={{ width: device === 'mobile' ? '375px' : '100%', maxWidth: '100%', height: '520px' }}
                    />
                  </div>
                  <p className="text-[11px] text-[#94a3b8] mt-2">
                    Rendered with sample data and your current sender ({settings?.brevoSenderName || 'VaultVerify'}). Exactly what a test send delivers.
                  </p>
                </div>
              </div>

              <DialogFooter className="px-6 sm:px-7 py-4 border-t border-[#eef1f6] bg-[#f8fafc] flex-col sm:flex-col gap-3 items-stretch">
                {(tplMsg || tplError) && (
                  <div className={`text-[12.5px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
                    tplMsg ? 'text-[#2E9E5B] bg-[#E9F5EC] border-[#34A853]' : 'text-[#E5484D] bg-[#FDEEEE] border-[#E5484D]'
                  }`}>{tplMsg || tplError}</div>
                )}
                {tplTestResult && (
                  <div className={`text-[12.5px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
                    tplTestResult.ok ? 'text-[#2E9E5B] bg-[#E9F5EC] border-[#34A853]' : 'text-[#E5484D] bg-[#FDEEEE] border-[#E5484D]'
                  }`}>{tplTestResult.text}</div>
                )}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2 flex-1 min-w-[240px]">
                    <Input type="email" value={tplTestTo} onChange={(e) => setTplTestTo(e.target.value)}
                      placeholder={adminEmail ? `Send test to ${adminEmail}` : 'Send test to'} className="h-11 bg-white" />
                    <Button variant="outline" onClick={sendTemplateTest} disabled={tplTestBusy} className="h-11 gap-2 font-bold shrink-0 bg-white">
                      {tplTestBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test
                    </Button>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button variant="ghost" onClick={resetTemplate} disabled={tplBusy} className="h-11 gap-2 text-[13px] font-bold text-[#E5484D] hover:bg-[#FDEEEE]">
                      <RotateCcw className="w-4 h-4" /> Reset to default
                    </Button>
                    <Button onClick={saveTemplate} disabled={tplBusy} className="font-bold gap-2 h-11"
                      style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
                      {tplBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save template
                    </Button>
                  </div>
                </div>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Connected Brevo account strip ────────────────────────────────────
// Live truth from the Brevo API: which account the saved key belongs to
// (the one being charged), its plan/quota, and whether the configured
// sender actually verifies. Kills the "credits not deducted / which
// dashboard am I looking at" confusion at a glance.
const FREE_MAIL = ['gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com', 'icloud.com', 'me.com', 'proton.me', 'protonmail.com']

function BrevoAccountStrip({ status, busy, onRefresh }: { status: BrevoStatus | null; busy: boolean; onRefresh: () => void }) {
  if (!status) return null

  if (!status.authenticated) {
    const noKey = status.reason === 'no-key'
    return (
      <div className={`rounded-2xl border px-4 py-3 text-[12.5px] font-semibold flex items-center gap-2.5 ${
        noKey ? 'bg-[#f8fafc] border-[#e2e8f0] text-[#64748b]' : 'bg-[#FDEEEE] border-[#F3B8BA] text-[#C13A3E]'
      }`}>
        <AlertTriangle className="w-4 h-4 shrink-0" />
        <span className="flex-1">
          {noKey
            ? 'No Brevo API key saved yet — every send stays in test mode (logged, never delivered).'
            : `Brevo rejected the saved key: ${status.error ?? 'unknown error'} — paste a valid xkeysib-… key below and save.`}
        </span>
        <button type="button" onClick={onRefresh} disabled={busy}
          className="text-[#64748b] hover:bg-white rounded-lg p-1.5 transition-colors shrink-0" title="Re-check Brevo">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>
    )
  }

  const a = status.account
  const ownDomain = a?.email?.split('@')[1]?.toLowerCase()
  const suggestDomain = ownDomain && !FREE_MAIL.includes(ownDomain) ? ownDomain : null

  return (
    <div className="rounded-2xl border border-[#CBE8D6] bg-[#F6FBF8] overflow-hidden divide-y divide-[#E3F2E9]">
      <div className="px-4 py-3 flex items-center gap-2.5 flex-wrap">
        <BadgeCheck className="w-4 h-4 text-[#1E6B3C] shrink-0" />
        <span className="text-[13px] font-bold text-[#0f172a]">
          Connected Brevo account: <span className="text-[#1E6B3C]">{a?.email ?? 'unknown'}</span>
        </span>
        {a?.planCredits != null && (
          <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border bg-[#E9F5EC] border-[#CBE8D6] text-[#1E6B3C]">
            {a.planType} · {a.planCredits} emails/day
          </span>
        )}
        <button type="button" onClick={onRefresh} disabled={busy}
          className="ml-auto text-[#1E6B3C] hover:bg-[#E9F5EC] rounded-lg p-1.5 transition-colors shrink-0" title="Re-check the Brevo account">
          <RefreshCw className={`w-4 h-4 ${busy ? 'animate-spin' : ''}`} />
        </button>
      </div>
      {a?.planType === 'free' && (
        <div className="px-4 py-2.5 text-[11.5px] text-[#64748b] leading-relaxed">
          Free plan: sends draw from a <strong>300/day quota that resets every 24h</strong> — there is no prepaid credit balance to deduct.
          To see usage, log into Brevo with <strong>{a.email}</strong> (not another Brevo login) and check <strong>Transactional → Real-time</strong>.
        </div>
      )}
      <div className="px-4 py-3 flex items-center gap-2.5 flex-wrap">
        {status.senderVerified ? (
          <>
            <BadgeCheck className="w-4 h-4 text-[#1E6B3C] shrink-0" />
            <span className="text-[12.5px] text-[#334155]">
              Sender <code className="bg-white border border-[#e2e8f0] rounded px-1 py-0.5">{status.senderEmail}</code> is verified &amp; active on this account — Brevo accepts emails from it.
            </span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0" />
            <span className="text-[12.5px] text-[#92400E]">
              Sender <code className="bg-white border border-[#F3D9A4] rounded px-1 py-0.5">{status.senderEmail}</code> is <strong>not</strong> an active verified sender on this account —{' '}
              <a href="https://app.brevo.com/senders" target="_blank" rel="noreferrer" className="font-bold underline">add &amp; verify it in Brevo</a> or sends will be rejected.
            </span>
          </>
        )}
      </div>
      {status.senderFreeMail && (
        <div className="px-4 py-3 flex items-start gap-2.5 bg-[#FFF9E6]">
          <AlertTriangle className="w-4 h-4 text-[#B45309] shrink-0 mt-0.5" />
          <span className="text-[12px] text-[#92400E] leading-relaxed">
            <strong>Deliverability warning:</strong> {status.senderDomain} is a free-mail domain. Brevo cannot publish SPF/DKIM records for it, so inbox providers often sort these emails into <strong>spam</strong> — that is most likely where the earlier test emails ended up.
            For reliable delivery, verify a sender on a domain you own{suggestDomain ? <> (e.g. <code className="bg-white border border-[#F3D9A4] rounded px-1 py-0.5">no-reply@{suggestDomain}</code>)</> : null} in Brevo with its SPF/DKIM records, then switch the sender above. Until then, check the spam folder when testing.
          </span>
        </div>
      )}
    </div>
  )
}
