'use client'

// Superadmin → Keys & access: shared GSA Per Diem API key + superadmin credentials.
import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import type { PlatformSettingsView } from '@/lib/types'
import { KeyRound, Loader2, Save, ShieldCheck } from 'lucide-react'

export function KeysPanel({ onCredentialsChanged }: { onCredentialsChanged: () => void }) {
  const [settings, setSettings] = useState<PlatformSettingsView | null>(null)
  const [loading, setLoading] = useState(true)

  const [gsaKey, setGsaKey] = useState('')
  const [saveMsg, setSaveMsg] = useState('')
  const [saveError, setSaveError] = useState('')
  const [busy, setBusy] = useState(false)

  // credentials
  const [currentPass, setCurrentPass] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newPass, setNewPass] = useState('')

  const refresh = useCallback(async () => {
    try {
      const s = await api<{ settings: PlatformSettingsView }>('/api/admin/settings')
      setSettings(s.settings)
    } catch { /* handled by empty renders */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function saveKey() {
    setBusy(true); setSaveMsg(''); setSaveError('')
    try {
      const data = await api<{ settings: PlatformSettingsView }>('/api/admin/settings', {
        method: 'PUT',
        body: JSON.stringify({ gsaApiKey: gsaKey.trim() || undefined }),
      })
      setSettings(data.settings)
      setGsaKey('')
      setSaveMsg('GSA key saved.')
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
      onCredentialsChanged() // refresh users/overview panels
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  if (loading) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-5">
      {(saveMsg || saveError) && (
        <div className={`text-[13px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
          saveMsg ? 'text-[#2E9E5B] bg-[#E9F5EC] border-[#34A853]' : 'text-[#E5484D] bg-[#FDEEEE] border-[#E5484D]'
        }`}>{saveMsg || saveError}</div>
      )}

      {/* GSA */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-1 flex items-center gap-2">
          <KeyRound className="w-4 h-4 text-[#1F7A44]" /> GSA Per Diem API key (shared)
        </h2>
        <p className="text-[12px] text-[#94a3b8] mb-3.5">
          Used by the calculator&apos;s live GSA fetch. Get a free key at
          <a href="https://api.data.gov/sign-up/" target="_blank" rel="noreferrer" className="text-[#1F7A44] font-bold ml-1">api.data.gov</a>.
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
          <Button onClick={saveKey} disabled={busy} className="font-bold gap-2 h-11 mt-6 self-start"
            style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save GSA key
          </Button>
        </div>
      </div>

      {/* Credentials */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-[#1F7A44]" /> Superadmin credentials
        </h2>
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
          style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Update credentials
        </Button>
      </div>
    </div>
  )
}
