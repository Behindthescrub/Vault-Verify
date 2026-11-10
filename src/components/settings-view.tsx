'use client'

import { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { api } from '@/lib/client-api'
import type { AppUser, UserSettings } from '@/lib/types'
import { Briefcase, Check, Image as ImageIcon, Loader2, Settings2 } from 'lucide-react'

type Props = {
  user: AppUser
  settings: UserSettings
  onSettingsChange: (s: UserSettings) => void
}

const LOGO_LIMIT = 256 * 1024 // 256 KB

export function SettingsView({ user, settings, onSettingsChange }: Props) {
  const [companyName, setCompanyName] = useState(settings.companyName ?? '')
  const [logoUrl, setLogoUrl] = useState<string | null>(settings.companyLogoUrl)
  const [gsaKey, setGsaKey] = useState(settings.gsaApiKey ?? '')
  const [onboarding, setOnboarding] = useState(settings.defaultOnboardingPct ?? 22)
  const [minW2, setMinW2] = useState(settings.minW2 ?? 15)
  const [otDefault, setOtDefault] = useState(settings.otEnabled ?? false)
  const [busy, setBusy] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function onLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > LOGO_LIMIT) {
      setError('Logo too large — pick an image under 256 KB.')
      return
    }
    const reader = new FileReader()
    reader.onload = (ev) => setLogoUrl(String(ev.target?.result))
    reader.readAsDataURL(file)
  }

  async function save() {
    setBusy(true)
    setError('')
    setSavedMsg('')
    try {
      const payload = {
        companyName: companyName.trim() || null,
        companyLogoUrl: logoUrl,
        gsaApiKey: gsaKey.trim() || null,
        defaultOnboardingPct: onboarding,
        minW2,
        otEnabled: otDefault,
      }
      const data = await api<{ settings: UserSettings }>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      onSettingsChange(data.settings)
      setSavedMsg('Settings saved.')
      setTimeout(() => setSavedMsg(''), 3000)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-[720px] mx-auto">
      <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f172a] flex items-center gap-2.5 mb-1">
        <Settings2 className="w-6 h-6 text-[#1F7A44]" /> Settings
      </h1>
      <p className="text-[13px] text-[#64748b] mb-5">Your account and the defaults your calculator starts with.</p>

      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] divide-y divide-[#eef1f6]">
        {/* Account */}
        <div className="px-6 sm:px-7 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5">Account</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Email</Label>
              <Input value={user.email} disabled className="h-11 mt-1.5 bg-[#f8fafc]" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Role</Label>
              <Input value={user.role === 'superadmin' ? 'Superadmin' : 'Recruiter'} disabled className="h-11 mt-1.5 bg-[#f8fafc]" />
            </div>
          </div>
        </div>

        {/* Calculator defaults */}
        <div className="px-6 sm:px-7 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-1">Calculator defaults</h2>
          <p className="text-[12px] text-[#94a3b8] mb-3.5">These pre-fill every new calculation. They can still be changed per run.</p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Company name</Label>
              <Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Your staffing company" className="h-11 mt-1.5" maxLength={160} />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">GSA API key (personal, optional)</Label>
              <Input type="password" value={gsaKey} onChange={(e) => setGsaKey(e.target.value)} placeholder="Overrides the platform key" className="h-11 mt-1.5" autoComplete="off" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Default onboarding (%)</Label>
              <Input type="number" value={onboarding} min={0} max={100} step={0.01} onChange={(e) => setOnboarding(Number(e.target.value) || 0)} className="h-11 mt-1.5" />
              <p className="text-[11px] text-[#94a3b8] mt-1.5">Payroll burden, drug/background test, tools — the all-in overhead.</p>
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Minimum W2 pay ($/hr)</Label>
              <Input type="number" value={minW2} min={0} step={0.01} onChange={(e) => setMinW2(Number(e.target.value) || 0)} className="h-11 mt-1.5" />
              <p className="text-[11px] text-[#94a3b8] mt-1.5">Hard floor for W2 hourly — the calculator shifts stipend money into W2 to keep it.</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5 mt-4 rounded-2xl border border-[#e2e8f0] bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] px-4 py-3.5">
            <Switch checked={otDefault} onCheckedChange={setOtDefault} />
            <div className="flex-1">
              <strong className="block text-[14px] font-bold text-[#0f172a]">Overtime on by default</strong>
              <span className="block text-[12px] text-[#64748b] mt-0.5">Remembered between sessions, just like the original tool.</span>
            </div>
          </div>
        </div>

        {/* Logo */}
        <div className="px-6 sm:px-7 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5">Calculator branding</h2>
          <div className="flex items-center gap-5 flex-wrap">
            <div className="w-16 h-16 rounded-2xl border border-[#d8dee9] bg-[#f8fafc] flex items-center justify-center overflow-hidden">
              {logoUrl ? (
                <img src={logoUrl} alt="Company logo preview" className="w-full h-full object-cover" />
              ) : (
                <Briefcase className="w-7 h-7 text-[#94a3b8]" />
              )}
            </div>
            <div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onLogoFile} />
              <Button variant="outline" className="h-10 gap-2 text-[13px]" onClick={() => fileRef.current?.click()}>
                <ImageIcon className="w-4 h-4" /> Upload logo (≤ 256 KB)
              </Button>
              {logoUrl && (
                <Button variant="ghost" className="h-10 ml-2 text-[13px] text-[#E5484D]" onClick={() => setLogoUrl(null)}>Remove</Button>
              )}
              <p className="text-[11.5px] text-[#94a3b8] mt-2">Shown in the calculator header instead of the default icon.</p>
            </div>
          </div>
        </div>

        {/* Save */}
        <div className="px-6 sm:px-7 py-4 bg-[#f8fafc] flex items-center justify-between gap-3">
          <div>
            {error && <span className="text-[12.5px] font-semibold text-[#E5484D]">{error}</span>}
            {savedMsg && <span className="text-[12.5px] font-semibold text-[#2E9E5B]">{savedMsg}</span>}
          </div>
          <Button onClick={save} disabled={busy} className="font-bold gap-2 h-11"
            style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Save settings
          </Button>
        </div>
      </div>
    </div>
  )
}
