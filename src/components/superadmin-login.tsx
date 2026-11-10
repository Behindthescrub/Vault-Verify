'use client'

// Dedicated login for the /console page — username + password.
// Distinct dark "console" look so it's clearly separate from the recruiter login.
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api } from '@/lib/client-api'
import type { AppUser } from '@/lib/types'
import { Loader2, LockKeyhole } from 'lucide-react'

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
          'radial-gradient(1100px 520px at 12% -8%, rgba(46,158,91,0.30), transparent 55%), radial-gradient(900px 460px at 100% 0%, rgba(56,189,248,0.12), transparent 55%), linear-gradient(160deg,#0A2B23 0%, #101d3f 45%, #0E3B32 100%)',
      }}
    >
      <div className="w-full max-w-[420px]">
        <div className="rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl shadow-[0_30px_90px_-20px_rgba(0,0,0,0.6)] px-7 sm:px-9 py-8">
          <div className="flex items-center gap-3.5">
            <img src="/vaultverify-logo-128.png" alt="VaultVerify logo" width={46} height={46} className="rounded-2xl shrink-0" />
            <div>
              <div className="text-[19px] font-extrabold tracking-tight text-white">Admin console</div>
              <div className="text-[12.5px] font-medium text-[#A8CFB8]">VaultVerify · platform administration</div>
            </div>
          </div>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sa-username" className="text-[10.5px] uppercase tracking-wider text-[#cbd5e1] font-bold">
                Username or email
              </Label>
              <Input id="sa-username" value={username} onChange={(e) => setUsername(e.target.value)}
                placeholder="admin" required autoFocus autoComplete="username"
                className="h-11 bg-white/[0.07] border-white/15 text-white placeholder:text-[#64748b] focus-visible:ring-[#7BC894]" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sa-password" className="text-[10.5px] uppercase tracking-wider text-[#cbd5e1] font-bold">
                Password
              </Label>
              <Input id="sa-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••" required autoComplete="current-password"
                className="h-11 bg-white/[0.07] border-white/15 text-white placeholder:text-[#64748b] focus-visible:ring-[#7BC894]" />
            </div>

            {error && (
              <div className="text-[13px] font-semibold text-[#F3B8BA] bg-[#7f1d1d]/40 border-l-[3px] border-[#ef4444] rounded-md px-3 py-2.5">
                {error}
              </div>
            )}

            <Button type="submit" disabled={busy} className="w-full h-11 text-[14px] font-bold gap-2"
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)', boxShadow: '0 4px 16px rgba(31,122,68,0.45)' }}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LockKeyhole className="w-4 h-4" />}
              Sign in to console
            </Button>
          </form>

          <p className="mt-6 text-[11.5px] leading-relaxed text-[#7FA893]">
            Authorized platform administrators only. Access credentials are managed
            by the platform owner and can be changed under <span className="text-[#CBE8D6] font-bold">Keys &amp; access</span>.
          </p>
        </div>

        <div className="mt-5 text-center">
          <a href="/" className="text-[12.5px] font-semibold text-[#A8CFB8] hover:text-white transition-colors">
            ← Back to VaultVerify
          </a>
        </div>
      </div>
    </div>
  )
}
