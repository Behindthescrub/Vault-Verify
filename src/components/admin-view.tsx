'use client'

// Superadmin shell — one account owns all platform data:
// checklist data, accounts & auth sessions, calculator runs, email settings & logs, API keys.
import { useState } from 'react'
import { OverviewPanel } from '@/components/admin/overview-panel'
import { ChecklistsPanel } from '@/components/admin/checklists-panel'
import { UsersPanel } from '@/components/admin/users-panel'
import { EmailPanel } from '@/components/admin/email-panel'
import { KeysPanel } from '@/components/admin/keys-panel'
import { SkillsPanel } from '@/components/admin/skills-panel'
import { ShieldCheck } from 'lucide-react'

type AdminTab = 'overview' | 'skills' | 'data' | 'users' | 'email' | 'keys'

const TABS: { key: AdminTab; label: string }[] = [
  { key: 'overview', label: 'Overview' },
  { key: 'skills', label: 'Skills data' },
  { key: 'data', label: 'Checklist data' },
  { key: 'users', label: 'Users & auth' },
  { key: 'email', label: 'Email' },
  { key: 'keys', label: 'Keys & access' },
]

export function AdminView() {
  const [tab, setTab] = useState<AdminTab>('overview')
  // Bump to re-fetch panels after cross-panel changes (e.g. admin email update)
  const [version, setVersion] = useState(0)
  const bump = () => setVersion((v) => v + 1)

  return (
    <div className="max-w-[1100px] mx-auto space-y-5">
      <div>
        <h1 className="text-[24px] font-extrabold tracking-tight text-[#0f172a] flex items-center gap-2.5">
          <ShieldCheck className="w-6 h-6 text-[#1F7A44]" /> Superadmin
        </h1>
        <p className="text-[13px] text-[#64748b] mt-1">
          Platform-wide data &amp; configuration — skills library, every checklist, account, session and calculator run on Recruiter tool.
        </p>
      </div>

      {/* Section tabs */}
      <div className="inline-flex rounded-2xl border border-[#e2e8f0] bg-white p-1 gap-0.5 shadow-[0_6px_20px_rgba(15,23,42,0.05)] flex-wrap">
        {TABS.map((t) => (
          <button key={t.key} type="button" onClick={() => setTab(t.key)}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`h-9 px-3.5 rounded-xl text-[13px] font-bold cursor-pointer transition-colors ${
              tab === t.key
                ? 'bg-[#1F7A44] text-white shadow-[0_0_0_3px_rgba(31,122,68,0.2)]'
                : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#334155]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewPanel version={version} />}
      {tab === 'skills' && <SkillsPanel />}
      {tab === 'data' && <ChecklistsPanel version={version} />}
      {tab === 'users' && <UsersPanel version={version} />}
      {tab === 'email' && <EmailPanel />}
      {tab === 'keys' && <KeysPanel onCredentialsChanged={bump} />}
    </div>
  )
}
