'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/client-api'
import type { PlatformSettingsView } from '@/lib/types'
import { Loader2, Mail, Save, Send, ShieldCheck, Users, History, KeyRound } from 'lucide-react'

type AdminUser = {
  id: string; email: string; name: string | null; company: string | null; role: string
  createdAt: string; checklistCount: number; calculationCount: number
}
type EmailLog = {
  id: string; toEmail: string; subject: string; purpose: string; status: string; error: string | null; createdAt: string
}

export function AdminView() {
  const [settings, setSettings] = useState<PlatformSettingsView | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [logs, setLogs] = useState<EmailLog[]>([])
  const [loading, setLoading] = useState(true)

  // form state
  const [brevoKey, setBrevoKey] = useState('')
  const [senderEmail, setSenderEmail] = useState('')
  const [senderName, setSenderName] = useState('')
  const [testMode, setTestMode] = useState(true)
  const [gsaKey, setGsaKey] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  // test email
  const [testTo, setTestTo] = useState('')
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  // credentials
  const [currentPass, setCurrentPass] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPass, setNewPass] = useState('')

  const refresh = useCallback(async () => {
    try {
      const [s, u, l] = await Promise.all([
        api<{ settings: PlatformSettingsView; adminEmail: string }>('/api/admin/settings'),
        api<{ users: AdminUser[] }>('/api/admin/users'),
        api<{ logs: EmailLog[] }>('/api/admin/email-logs'),
      ])
      setSettings(s.settings)
      setSenderEmail(s.settings.brevoSenderEmail)
      setSenderName(s.settings.brevoSenderName)
      setTestMode(s.settings.emailTestMode)
      setTestTo(s.adminEmail)
      setUsers(u.users)
      setLogs(l.logs)
    } catch { /* handled by empty renders */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function save(keyPart: 'brevo' | 'gsa') {
    setBusy(true); setSaveMsg(''); setSaveError('')
    try {
      const payload =
        keyPart === 'brevo'
          ? {
              brevoApiKey: brevoKey.trim() || undefined,
              brevoSenderEmail: senderEmail.trim() || undefined,
              brevoSenderName: senderName.trim() || undefined,
              emailTestMode: testMode,
            }
          : { gsaApiKey: gsaKey.trim() || undefined }
      const data = await api<{ settings: PlatformSettingsView }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      setSettings(data.settings)
      setBrevoKey(''); setGsaKey('')
      setSaveMsg(keyPart === 'brevo' ? 'Brevo settings saved.' : 'GSA key saved.')
      setTimeout(() => setSaveMsg(''), 3000)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function saveCredentials() {
    setBusy(true); setSaveMsg(''); setSaveError('')
    try {
      await api('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({
          newAdminEmail: newEmail.trim() || undefined,
          newAdminPassword: newPass || undefined,
          currentPassword: currentPass,
        }),
      })
      setCurrentPass(''); setNewEmail(''); setNewPass('')
      setSaveMsg('Admin credentials updated.')
      setTimeout(() => setSaveMsg(''), 3000)
      refresh()
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setTestBusy(true); setTestResult(null)
    try {
      const data = await api<{ emailStatus: string; sentTo: string }>('/api/admin/test-email', {
        method: 'POST',
        body: JSON.stringify({ to: testTo }),
      })
      setTestResult({
        ok: true,
        text: data.emailStatus === 'test-mode'
          ? `Logged in test mode — no real email sent to ${data.sentTo}. Add a Brevo API key and disable test mode to send for real.`
          : `Test email sent to ${data.sentTo}.`,
      })
      refresh()
    } catch (e) {
      setTestResult({ ok: false, text: e instanceof Error ? e.message : 'Test email failed' })
    } finally {
      setTestBusy(false)
    }
  }

  if (loading) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="max-w-[900px] mx-auto space-y-5">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f172a] flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-[#4f46e5]" /> Superadmin
        </h1>
        <p className="text-[13px] text-[#64748b] mt-1">Platform-wide configuration: Brevo email, GSA key, users, and the send log.</p>
      </div>

      {(saveMsg || saveError) && (
        <div className={`text-[13px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
          saveMsg ? 'text-[#059669] bg-[#ecfdf5] border-[#10b981]' : 'text-[#dc2626] bg-[#fef2f2] border-[#dc2626]'
        }`}>{saveMsg || saveError}</div>
      )}

      {/* ===== Brevo ===== */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] divide-y divide-[#eef1f6]">
        <div className="px-6 sm:px-7 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-1 flex items-center gap-2">
            <Mail className="w-4 h-4 text-[#4f46e5]" /> Brevo transactional email
          </h2>
          <p className="text-[12px] text-[#94a3b8] mb-3.5">
            Checklist invitations are sent through Brevo. Get your API v3 key at
            <a href="https://app.brevo.com/settings/keys/api" target="_blank" rel="noreferrer" className="text-[#4f46e5] font-bold ml-1">app.brevo.com → SMTP &amp; API keys</a>.
            {settings?.brevoApiKeySet && (
              <span className="block mt-1">Current key: <code className="bg-[#f1f5f9] rounded px-1.5 py-0.5">{settings.brevoApiKeyMasked}</code></span>
            )}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Brevo API key</Label>
              <Input type="password" value={brevoKey} onChange={(e) => setBrevoKey(e.target.value)}
                placeholder={settings?.brevoApiKeySet ? 'Saved — enter a new key to replace' : 'xkeysib-…'} className="h-11 mt-1.5" autoComplete="off" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Sender email</Label>
              <Input type="email" value={senderEmail} onChange={(e) => setSenderEmail(e.target.value)}
                placeholder="no-reply@yourdomain.com" className="h-11 mt-1.5" />
              <p className="text-[11px] text-[#94a3b8] mt-1.5">Must be a domain verified in Brevo.</p>
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
            <Button onClick={() => save('brevo')} disabled={busy} className="font-bold gap-2 h-11"
              style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save Brevo settings
            </Button>
            <div className="flex items-center gap-2 flex-1 min-w-[240px]">
              <Input type="email" value={testTo} onChange={(e) => setTestTo(e.target.value)} placeholder="Send test to" className="h-11" />
              <Button variant="outline" onClick={sendTest} disabled={testBusy} className="h-11 gap-2 font-bold shrink-0">
                {testBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send test email
              </Button>
            </div>
          </div>
          {testResult && (
            <div className={`mt-3 text-[12.5px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
              testResult.ok ? 'text-[#059669] bg-[#ecfdf5] border-[#10b981]' : 'text-[#dc2626] bg-[#fef2f2] border-[#dc2626]'
            }`}>{testResult.text}</div>
          )}
        </div>

        {/* Email log */}
        <div className="px-6 sm:px-7 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
            <History className="w-4 h-4 text-[#4f46e5]" /> Send log (last 50)
          </h2>
          <div className="rounded-2xl border border-[#eef1f6] max-h-72 overflow-y-auto divide-y divide-[#eef1f6]">
            {logs.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-[#94a3b8]">No emails logged yet.</div>}
            {logs.map((l) => (
              <div key={l.id} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full border ${
                  l.status === 'sent' ? 'bg-[#dcfce7] border-[#86efac] text-[#15803d]'
                    : l.status === 'test-mode' ? 'bg-[#eef2ff] border-[#c7d2fe] text-[#4338ca]'
                    : 'bg-[#fee2e2] border-[#fca5a5] text-[#b91c1c]'
                }`}>{l.status}</span>
                <span className="text-[13px] font-semibold text-[#334155] truncate max-w-[220px]">{l.toEmail}</span>
                <span className="text-[12px] text-[#94a3b8] flex-1 truncate">{l.subject}{l.error ? ` — ${l.error}` : ''}</span>
                <span className="text-[11px] text-[#94a3b8]">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ===== GSA ===== */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-1 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#4f46e5]" /> GSA Per Diem API key (shared)
        </h2>
        <p className="text-[12px] text-[#94a3b8] mb-3.5">
          Used by the calculator&apos;s live GSA fetch. Get a free key at
          <a href="https://api.data.gov/sign-up/" target="_blank" rel="noreferrer" className="text-[#4f46e5] font-bold ml-1">api.data.gov</a>.
          {settings?.gsaApiKeySet && (
            <span className="block mt-1">Current key: <code className="bg-[#f1f5f9] rounded px-1.5 py-0.5">{settings.gsaApiKeyMasked}</code></span>
          )}
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex-1 min-w-[240px]">
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">GSA API key</Label>
            <Input type="password" value={gsaKey} onChange={(e) => setGsaKey(e.target.value)}
              placeholder={settings?.gsaApiKeySet ? 'Saved — enter a new key to replace' : 'DEMO_KEY…'} className="h-11 mt-1.5" autoComplete="off" />
          </div>
          <Button onClick={() => save('gsa')} disabled={busy} className="font-bold gap-2 h-11 mt-6 self-start"
            style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save GSA key
          </Button>
        </div>
      </div>

      {/* ===== Users ===== */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#4f46e5]" /> Users ({users.length})
        </h2>
        <div className="rounded-2xl border border-[#eef1f6] max-h-72 overflow-y-auto divide-y divide-[#eef1f6]">
          {users.map((u) => (
            <div key={u.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-[#0f172a] truncate">{u.email}</div>
                <div className="text-[11.5px] text-[#94a3b8]">
                  {u.role === 'superadmin' ? 'superadmin' : u.company || 'no company'} · {u.checklistCount} checklists · {u.calculationCount} saved runs · joined {new Date(u.createdAt).toLocaleDateString()}
                </div>
              </div>
              {u.role === 'superadmin' && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[#0a1628] text-white">admin</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ===== Admin credentials ===== */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5">Superadmin credentials</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Current password</Label>
            <Input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} className="h-11 mt-1.5" autoComplete="current-password" />
          </div>
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">New email (optional)</Label>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@yourdomain.com" className="h-11 mt-1.5" />
          </div>
          <div>
            <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">New password (optional)</Label>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} placeholder="Min 8 characters" className="h-11 mt-1.5" autoComplete="new-password" />
          </div>
        </div>
        <Button onClick={saveCredentials} disabled={busy || !currentPass} className="font-bold gap-2 h-11 mt-4"
          style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Update credentials
        </Button>
      </div>
    </div>
  )
}
