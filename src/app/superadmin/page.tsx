'use client'

// /superadmin — the platform administration console.
// Own URL, own username+password login (superadmin accounts only).
// Everything downstream (APIs under /api/admin/*) is guarded server-side.
import { useCallback, useEffect, useState } from 'react'
import { SuperadminLogin } from '@/components/superadmin-login'
import { AdminView } from '@/components/admin-view'
import { api } from '@/lib/client-api'
import type { AppUser } from '@/lib/types'
import { Calculator, ExternalLink, LogOut, ShieldCheck } from 'lucide-react'

export default function SuperadminPage() {
  const [booted, setBooted] = useState(false)
  const [user, setUser] = useState<AppUser | null>(null)

  useEffect(() => {
    api<{ user: AppUser | null }>('/api/auth/me')
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setBooted(true))
  }, [])

  const onLogout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
  }, [])

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(160deg,#0A2B23 0%, #0E3B32 100%)' }}>
        <div className="w-6 h-6 border-2 border-[#CBE8D6]/40 border-t-[#7BC894] rounded-full animate-spin" />
      </div>
    )
  }

  // 1) Not signed in → dedicated console login (username + password)
  if (!user) {
    return <SuperadminLogin onSuccess={(u) => setUser(u)} />
  }

  // 2) Signed in as a regular recruiter → no access to the console
  if (user.role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4"
        style={{ background: 'linear-gradient(160deg,#0A2B23 0%, #0E3B32 100%)' }}>
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-white/[0.06] backdrop-blur-xl px-8 py-9 text-center">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#7f1d1d]/50 border border-[#ef4444]/30 flex items-center justify-center text-[#F3B8BA]">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="mt-5 text-[20px] font-extrabold text-white">Access restricted</h1>
          <p className="mt-2 text-[13px] text-[#A8CFB8] leading-relaxed">
            You are signed in as <span className="text-white font-semibold">{user.email}</span>, which is not a
            superadmin account. This console is reserved for platform administrators.
          </p>
          <div className="mt-7 flex flex-col sm:flex-row gap-2.5 justify-center">
            <a href="/"
              className="h-11 px-5 inline-flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold text-white bg-[#1F7A44] hover:bg-[#1E6B3C] transition-colors">
              <Calculator className="w-4 h-4" /> Recruiter tool
            </a>
            <button onClick={onLogout}
              className="h-11 px-5 inline-flex items-center justify-center gap-2 rounded-xl text-[13.5px] font-bold text-[#cbd5e1] bg-white/[0.07] border border-white/15 hover:bg-white/[0.12] cursor-pointer transition-colors">
              <LogOut className="w-4 h-4" /> Log out
            </button>
          </div>
        </div>
      </div>
    )
  }

  // 3) Superadmin → console shell with all admin panels
  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg,#f6f8fc, #eef2f9)' }}>
      <header className="sticky top-0 z-40"
        style={{ background: 'linear-gradient(135deg,#0A2B23 0%, #0E3B32 60%, #124F41 100%)' }}>
        <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
          <div className="h-14 flex items-center gap-3">
            <div className="flex items-center gap-2.5 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-[#1F7A44]/40 border border-[#7BC894]/40 flex items-center justify-center text-[#CBE8D6]">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <span className="text-white font-extrabold text-[15px] tracking-tight">
                Superadmin <span className="hidden sm:inline text-[#A8CFB8] font-bold">· Recruiter tool</span>
              </span>
            </div>

            <div className="flex-1" />

            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[12px] text-[#A8CFB8] font-medium hidden md:block max-w-[200px] truncate">
                {user.email}
              </span>
              <a href="/" title="Open the recruiter app"
                className="h-9 px-3 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 text-[#cbd5e1] hover:text-white hover:bg-white/10 transition-colors">
                <Calculator className="w-4 h-4" /> <span className="hidden sm:inline">Recruiter app</span>
                <ExternalLink className="w-3.5 h-3.5 opacity-60" />
              </a>
              <button onClick={onLogout} title="Log out"
                className="h-9 px-2.5 rounded-xl text-[#cbd5e1] hover:text-white hover:bg-white/10 transition-colors cursor-pointer inline-flex items-center">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 w-full px-4 sm:px-6 py-7">
        <AdminView />
      </main>

      <footer className="mt-auto">
        <div className="max-w-[1100px] mx-auto px-4 py-6 text-center text-[11.5px] text-[#94a3b8]">
          Recruiter tool superadmin console · /superadmin
        </div>
      </footer>
    </div>
  )
}
