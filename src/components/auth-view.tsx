'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import type { AppUser } from '@/lib/types'
import { Calculator, CheckSquare, Loader2, Mail, ShieldCheck, Sparkles } from 'lucide-react'

type Props = {
  onAuthed: (user: AppUser) => void
}

export function AuthView({ onAuthed }: Props) {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [company, setCompany] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const path = mode === 'login' ? '/api/auth/login' : '/api/auth/signup'
      const body = mode === 'login'
        ? { email, password }
        : { email, password, name: name || undefined, company: company || undefined }
      const data = await api<{ user: AppUser }>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      })
      onAuthed(data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center px-4 py-10"
      style={{
        background:
          'radial-gradient(1200px 600px at 10% -10%, rgba(79,70,229,0.10), transparent 60%), radial-gradient(1000px 500px at 100% 0%, rgba(26,42,108,0.08), transparent 60%), linear-gradient(180deg,#f6f8fc 0%, #eef2f9 100%)',
      }}
    >
      <div className="w-full max-w-4xl grid md:grid-cols-2 rounded-3xl overflow-hidden border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08),0_30px_80px_-20px_rgba(79,70,229,0.18)]">
        {/* Brand panel */}
        <div className="hidden md:flex flex-col justify-between p-8 relative text-white"
          style={{ background: 'radial-gradient(600px 200px at 0% 0%, rgba(99,102,241,0.35), transparent 60%), linear-gradient(135deg,#0a1628 0%, #1a2a6c 60%, #312e81 100%)' }}
        >
          <div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center backdrop-blur">
                <Calculator className="w-6 h-6" />
              </div>
              <div>
                <div className="text-xl font-extrabold tracking-tight">Recruiter tool</div>
                <div className="text-[13px] font-medium text-[#a8b8d8]">Healthcare staffing, simplified</div>
              </div>
            </div>
            <div className="mt-10 space-y-5">
              <Feature icon={<CheckSquare className="w-4 h-4" />} title="Skills checklists"
                text="Send RN / LPN / CNA / PT / OT / RT checklists to candidates by email, or enter their ratings yourself." />
              <Feature icon={<Calculator className="w-4 h-4" />} title="Bill-to-Pay calculator"
                text="Margin, overtime, traveler stipend splits and GSA per-diem — every run saved and reloadable." />
              <Feature icon={<Mail className="w-4 h-4" />} title="Brevo email"
                text="Checklist invitations sent straight from the app. API key managed by the superadmin." />
            </div>
          </div>
          <div className="text-[12px] text-[#8ea0c8] flex items-center gap-2">
            <ShieldCheck className="w-3.5 h-3.5" /> Your data, your account — passwords hashed, sessions secured.
          </div>
        </div>

        {/* Form panel */}
        <div className="p-8 sm:p-10">
          <div className="md:hidden flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white"
              style={{ background: 'linear-gradient(135deg,#6366f1,#4338ca)' }}>
              <Calculator className="w-5 h-5" />
            </div>
            <div className="text-lg font-extrabold">Recruiter tool</div>
          </div>

          <h1 className="text-[22px] font-extrabold tracking-tight text-[#0f172a]">
            {mode === 'login' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-[13px] text-[#64748b] mt-1 mb-6">
            {mode === 'login' ? 'Log in to your checklists and calculator.' : 'Free account — takes 20 seconds.'}
          </p>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'signup' && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-[10.5px] uppercase tracking-wider text-[#334155] font-bold">Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" className="h-11" autoComplete="name" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-[10.5px] uppercase tracking-wider text-[#334155] font-bold">Company</Label>
                    <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Acme Staffing" className="h-11" />
                  </div>
                </div>
              </>
            )}
            <div className="space-y-1.5">
              <Label className="text-[10.5px] uppercase tracking-wider text-[#334155] font-bold">Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className="h-11" autoComplete="email" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10.5px] uppercase tracking-wider text-[#334155] font-bold">Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={mode === 'signup' ? 8 : 1} className="h-11" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
            </div>

            {error && (
              <div className="text-[13px] font-semibold text-[#dc2626] bg-[#fef2f2] border-l-[3px] border-[#dc2626] rounded-md px-3 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy}
              className="w-full h-11 text-[14px] font-bold"
              style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)', boxShadow: '0 4px 14px rgba(79,70,229,0.30)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'login' ? <Sparkles className="w-4 h-4" /> : null}
              {mode === 'login' ? 'Log in' : 'Create account'}
            </Button>
          </form>

          <button onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
            className="mt-5 text-[13px] font-semibold text-[#4f46e5] hover:text-[#4338ca] cursor-pointer">
            {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
          </button>

          {mode === 'login' && (
            <div className="mt-6 pt-5 border-t border-[#eef1f6] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#4f46e5] shrink-0" />
              <span className="text-[12px] text-[#64748b]">Platform administrator?</span>
              <a href="/superadmin"
                className="text-[12px] font-bold text-[#4f46e5] hover:text-[#4338ca] inline-flex items-center gap-1">
                Superadmin console →
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Feature({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3.5">
      <div className="w-8 h-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 text-[#c7d2fe]">
        {icon}
      </div>
      <div>
        <div className="font-bold text-[14px]">{title}</div>
        <div className="text-[12.5px] text-[#a8b8d8] leading-relaxed mt-0.5">{text}</div>
      </div>
    </div>
  )
}
