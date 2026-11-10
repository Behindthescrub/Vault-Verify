'use client'

import { useCallback, useEffect, useState } from 'react'
import { AuthView } from '@/components/auth-view'
import { TopBar, Footer, type Tab } from '@/components/top-bar'
import { ChecklistsView } from '@/components/checklists-view'
import { ChecklistDetail } from '@/components/checklist-detail'
import { ManualEntry } from '@/components/manual-entry'
import { CalculatorView } from '@/components/calculator-view'
import { SettingsView } from '@/components/settings-view'
import { PublicFill } from '@/components/public-fill'
import { api } from '@/lib/client-api'
import type { AppUser, UserSettings } from '@/lib/types'

type View =
  | { kind: 'tab'; tab: Tab }
  | { kind: 'checklist-detail'; id: string }
  | { kind: 'manual-entry'; id: string }

const DEFAULT_SETTINGS: UserSettings = {
  userId: '',
  companyName: null,
  companyLogoUrl: null,
  defaultOnboardingPct: 22,
  minW2: 15,
  otEnabled: false,
}

export default function Home() {
  const [booted, setBooted] = useState(false)
  const [user, setUser] = useState<AppUser | null>(null)
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS)
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [view, setView] = useState<View>({ kind: 'tab', tab: 'checklists' })

  useEffect(() => {
    // Public candidate link: /?c=<token> — deferred out of the sync effect body
    const c = new URLSearchParams(window.location.search).get('c')

    api<{ user: AppUser | null; settings: UserSettings | null }>('/api/auth/me')
      .then((d) => {
        if (c) setPublicToken(c)
        if (d.user) {
          setUser(d.user)
          if (d.settings) setSettings({ ...DEFAULT_SETTINGS, ...d.settings })
        }
      })
      .catch(() => {})
      .finally(() => setBooted(true))
  }, [])

  const onAuthed = useCallback((u: AppUser) => {
    setUser(u)
    setView({ kind: 'tab', tab: 'checklists' })
    api<{ settings: UserSettings | null }>('/api/auth/me')
      .then((d) => { if (d.settings) setSettings({ ...DEFAULT_SETTINGS, ...d.settings }) })
      .catch(() => {})
  }, [])

  const onLogout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' }).catch(() => {})
    setUser(null)
    setView({ kind: 'tab', tab: 'checklists' })
  }, [])

  const onSettingsChange = useCallback((patch: Partial<UserSettings>) => {
    setSettings((s) => ({ ...s, ...patch }))
  }, [])

  // ─── Render ───────────────────────────────────────────────────────

  if (!booted) {
    return (
      <div className="min-h-screen flex items-center justify-center"
        style={{ background: 'linear-gradient(180deg,#f6f8fc, #eef2f9)' }}>
        <div className="w-6 h-6 border-2 border-[#CBE8D6] border-t-[#1F7A44] rounded-full animate-spin" />
      </div>
    )
  }

  // Candidate public fill — standalone, no chrome
  if (publicToken) {
    return <PublicFill token={publicToken} />
  }

  if (!user) {
    return <AuthView onAuthed={onAuthed} />
  }

  let content: React.ReactNode = null
  if (view.kind === 'tab') {
    if (view.tab === 'checklists') {
      content = (
        <ChecklistsView
          onOpenDetail={(id) => setView({ kind: 'checklist-detail', id })}
          onManualEntry={(id) => setView({ kind: 'manual-entry', id })}
        />
      )
    } else if (view.tab === 'calculator') {
      content = <CalculatorView settings={settings} onSettingsChange={onSettingsChange} />
    } else if (view.tab === 'settings') {
      content = <SettingsView user={user} settings={settings} onSettingsChange={onSettingsChange} />
    }
  } else if (view.kind === 'checklist-detail') {
    content = (
      <ChecklistDetail
        id={view.id}
        onBack={() => setView({ kind: 'tab', tab: 'checklists' })}
        onManualEntry={(id) => setView({ kind: 'manual-entry', id })}
      />
    )
  } else {
    content = (
      <ManualEntry
        id={view.id}
        onBack={() => setView({ kind: 'tab', tab: 'checklists' })}
        onSaved={() => setView({ kind: 'tab', tab: 'checklists' })}
      />
    )
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'linear-gradient(180deg,#f6f8fc, #eef2f9)' }}>
      <TopBar
        user={user}
        tab={view.kind === 'tab' ? view.tab : view.kind === 'manual-entry' ? 'checklists' : 'checklists'}
        onTab={(t) => setView({ kind: 'tab', tab: t })}
        onLogout={onLogout}
      />
      <main className="flex-1 w-full px-4 sm:px-6 py-7">{content}</main>
      <Footer />
    </div>
  )
}
