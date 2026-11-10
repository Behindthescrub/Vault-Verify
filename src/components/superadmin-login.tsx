'use client'

// Dedicated login for the /superadmin console — username + password.
// Distinct dark "console" look so it's clearly separate from the recruiter login.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import type { AppUser } from '@/lib/types'
import { Loader2, LockKeyhole, ShieldCheck } from 'lucide-react'

type Props = {
  onSuccess: (user: AppUser) => void
}

export function SuperadminLogin({ onSuccess }: Props) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const data = await api<{ user: AppUser }>('/api/auth/admin-login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      })
      onSuccess(data.user)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-4 py-10"
      style={{
        background:
          'radial-gradient(1100px 520px at 12% -8%, rgba(99,102,241,0.30), transparent 55%), radial-gradient(900px 460px at 100% 0%, rgba(56,189,248,0.12), transparent 55%), linear-gradient(160deg,#0a1628 0%, #101d3f 45%, #1a2a6c 100%)',
      }}
    >
      <div className="w-full max-w-[420px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.6)] px-7 sm:px-9 py-8">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/15 flex items-center justify-center text-[#c7d2fe]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <div className="text-[19px] font-extrabold tracking-tight text-white">Superadmin console</div>
              <div className="text-[12.5px] font-medium text-[#a8b8d8]">Recruiter tool · platform administration</div>
            </div>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sa-username" className="text-[10.5px] uppercase tracking-wider text-[#cbd5e1] font-bold">
                Username or email
              </Label>
              <Input id="sa-username" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="admin" required autoFocus autoComplete="username"
                className="h-11 bg-white/[0.07] border-white/15 text-white placeholder:text-[#64748b] focus-visible:ring-[#818cf8]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-password" className="text-[10.5px] uppercase tracking-wider text-[#cbd5e1] font-bold">
                Password
              </Label>
              <Input id="sa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                className="h-11 bg-white/[0.07] border-white/15 text-white placeholder:text-[#64748b] focus-visible:ring-[#818cf8]" />
            </div>

            {error && (
              <div className="text-[13px] font-semibold text-[#fca5a5] bg-[#7f1d1d]/40 border-l-[3px] border-[#ef4444] rounded-md px-3 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full h-11 text-[14px] font-bold gap-2"
              style={{ background: 'linear-gradient(180deg,#6366f1,#4338ca)', boxShadow: '0 4px 16px rgba(79,70,229,0.45)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
              Sign in to console
            </Button>
          </form>

          <p className="mt-6 text-[11.5px] leading-relaxed text-[#8ea0c8]">
            Authorized platform administrators only. Credentials are set at seed time
            (<code className="bg-white/10 rounded px-1 py-0.5">SUPERADMIN_EMAIL</code> /{' '}
            <code className="bg-white/10 rounded px-1 py-0.5">SUPERADMIN_PASSWORD</code>) and can be
            changed under <span className="text-[#c7d2fe] font-bold">Keys &amp; access</span>.
          </p>
        </div>

        <div className="mt-5 text-center">
          <a href="/" className="text-[12.5px] font-semibold text-[#a8b8d8] hover:text-white transition-colors">
            ← Back to Recruiter tool
          </a>
        </div>
      </div>
    </div>
  )
}
