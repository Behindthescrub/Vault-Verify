'use client'

// Superadmin → Users & auth: all accounts, active sessions (auth data),
// and saved calculator runs across the platform.
import { useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import type { AdminUserRow, AdminCalculationRow } from '@/lib/types'
import { Calculator, Loader2, ShieldCheck, Users } from 'lucide-react'

type Props = { version: number }

export function UsersPanel({ version }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>([])
  const [calcs, setCalcs] = useState<AdminCalculationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([
      api<{ users: AdminUserRow[] }>('/api/admin/users'),
      api<{ calculations: AdminCalculationRow[] }>('/api/admin/calculations'),
    ])
      .then(([u, c]) => { setUsers(u.users); setCalcs(c.calculations) })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false))
  }, [version])

  if (loading) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }
  if (error) {
    return (
      <div className="text-[13px] font-semibold text-[#E5484D] bg-[#FDEEEE] border-l-[3px] border-[#E5484D] rounded-md px-3.5 py-2.5">
        {error}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Accounts */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#1F7A44]" /> Accounts ({users.length})
        </h2>
        <div className="rounded-2xl border border-[#eef1f6] divide-y divide-[#eef1f6] overflow-hidden">
          {users.map((u) => (
            <div key={u.id} className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-[#f8fafc] transition-colors">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-[#0f172a] truncate">{u.email}</div>
                <div className="text-[11.5px] text-[#94a3b8]">
                  {u.role === 'superadmin' ? 'superadmin' : u.company || 'no company'}
                  {' · '}{u.checklistCount} checklists · {u.calculationCount} saved runs
                  {' · joined '}{new Date(u.createdAt).toLocaleDateString()}
                </div>
              </div>
              {u.role === 'superadmin' && (
                <span className="text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded-full bg-[#0A2B23] text-white">
                  admin
                </span>
              )}
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-bold px-2.5 py-1 rounded-full border ${
                u.activeSessions > 0
                  ? 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]'
                  : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#94a3b8]'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${u.activeSessions > 0 ? 'bg-[#22c55e]' : 'bg-[#cbd5e1]'}`} />
                {u.activeSessions > 0 ? `${u.activeSessions} active session${u.activeSessions === 1 ? '' : 's'}` : 'offline'}
              </span>
            </div>
          ))}
        </div>
        <p className="text-[11.5px] text-[#94a3b8] mt-3 flex items-center gap-1.5">
          <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
          Sessions are the live login tokens issued by the auth layer — an &ldquo;active session&rdquo; means the account is signed in somewhere right now.
        </p>
      </div>

      {/* Saved calculator runs */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
          <Calculator className="w-4 h-4 text-[#1F7A44]" /> Saved calculator runs ({calcs.length})
        </h2>
        {calcs.length === 0 ? (
          <div className="text-[13px] text-[#94a3b8] py-4 text-center">No saved bill-to-pay runs yet.</div>
        ) : (
          <div className="rounded-2xl border border-[#eef1f6] max-h-72 overflow-y-auto divide-y divide-[#eef1f6]">
            {calcs.map((c) => (
              <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold text-[#334155] truncate">{c.name}</div>
                  <div className="text-[11.5px] text-[#94a3b8] truncate">
                    {c.ownerEmail} · {new Date(c.createdAt).toLocaleString()}
                  </div>
                </div>
                {c.billRate != null && (
                  <span className="text-[12.5px] font-bold tabular-nums text-[#1F7A44]">
                    ${c.billRate.toFixed(2)}/hr
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
