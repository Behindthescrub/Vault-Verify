'use client'

import { Button } from '@/components/ui/button'
import type { AppUser } from '@/lib/types'
import { Calculator, CheckSquare, ExternalLink, LogOut, Settings2, ShieldCheck } from 'lucide-react'

export type Tab = 'checklists' | 'calculator' | 'settings'

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: 'checklists', label: 'Checklists', icon: <CheckSquare className="w-4 h-4" /> },
  { key: 'calculator', label: 'Calculator', icon: <Calculator className="w-4 h-4" /> },
  { key: 'settings', label: 'Settings', icon: <Settings2 className="w-4 h-4" /> },
]

export function TopBar({ user, tab, onTab, onLogout }: {
  user: AppUser
  tab: Tab
  onTab: (t: Tab) => void
  onLogout: () => void
}) {
  return (
    <header className="sticky top-0 z-40"
      style={{ background: 'linear-gradient(135deg,#0a1628 0%, #1a2a6c 60%, #312e81 100%)' }}>
      <div className="max-w-[1100px] mx-auto px-4 sm:px-6">
        <div className="h-14 flex items-center gap-3">
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center text-white">
              <Calculator className="w-4.5 h-4.5" />
            </div>
            <span className="text-white font-extrabold text-[15px] tracking-tight hidden sm:block">Recruiter tool</span>
          </div>

          <nav className="flex-1 flex items-center gap-1 overflow-x-auto no-scrollbar" aria-label="Main navigation">
            {TABS.map((t) => (
              <button key={t.key} onClick={() => onTab(t.key)}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`h-9 px-3.5 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-colors shrink-0 ${
                  tab === t.key
                    ? 'bg-[#4f46e5] text-white shadow-[0_0_0_3px_rgba(79,70,229,0.25)]'
                    : 'text-[#cbd5e1] hover:text-white hover:bg-white/10'
                }`}>
                {t.icon}{t.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            {user.role === 'superadmin' && (
              <a href="/superadmin" title="Open the superadmin console"
                className="h-9 px-3 rounded-xl text-[13px] font-bold inline-flex items-center gap-1.5 bg-[#4f46e5]/30 border border-[#818cf8]/40 text-[#c7d2fe] hover:bg-[#4f46e5]/50 hover:text-white transition-colors">
                <ShieldCheck className="w-4 h-4" /> Superadmin <ExternalLink className="w-3.5 h-3.5 opacity-70" />
              </a>
            )}
            <span className="text-[12px] text-[#a8b8d8] font-medium hidden md:block max-w-[180px] truncate">
              {user.email}
            </span>
            <Button variant="ghost" onClick={onLogout} title="Log out"
              className="h-9 px-2.5 text-[#cbd5e1] hover:bg-white/10 hover:text-white">
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </header>
  )
}

export function Footer() {
  return (
    <footer className="mt-auto">
      <div className="max-w-[1100px] mx-auto px-4 py-6 text-center text-[11.5px] text-[#94a3b8]">
        Recruiter tool · skills checklists &amp; bill-to-pay calculator
      </div>
    </footer>
  )
}
