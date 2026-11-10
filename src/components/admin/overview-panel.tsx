'use client'

// Superadmin → Overview: platform usage stats + recent activity.
import { useEffect, useState } from 'react'
import { api } from '@/lib/client-api'
import type { AdminOverview, AdminRecentSignup, AdminRecentSubmission } from '@/lib/types'
import { ratingColor } from '@/components/rating'
import {
  Activity, CheckSquare, ClipboardCheck, Calculator, Gauge, Loader2, MailCheck, UserPlus, Users,
} from 'lucide-react'

type Props = { version: number }

export function OverviewPanel({ version }: Props) {
  const [data, setData] = useState<{
    overview: AdminOverview
    recentSignups: AdminRecentSignup[]
    recentSubmissions: AdminRecentSubmission[]
  } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    api<{ overview: AdminOverview; recentSignups: AdminRecentSignup[]; recentSubmissions: AdminRecentSubmission[] }>(
      '/api/admin/overview',
    )
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [version])

  if (error) {
    return (
      <div className="text-[13px] font-semibold text-[#dc2626] bg-[#fef2f2] border-l-[3px] border-[#dc2626] rounded-md px-3.5 py-2.5">
        {error}
      </div>
    )
  }
  if (!data) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  const o = data.overview

  const stats: { icon: React.ReactNode; label: string; value: string; sub: string }[] = [
    {
      icon: <Users className="w-4 h-4" />, label: 'Recruiters',
      value: String(o.users), sub: `${o.users - 1 > 0 ? o.users - 1 : 0} account${(o.users - 1) === 1 ? '' : 's'} + you`,
    },
    {
      icon: <CheckSquare className="w-4 h-4" />, label: 'Checklists',
      value: String(o.checklists), sub: `${o.drafts} draft · ${o.sent} awaiting`,
    },
    {
      icon: <ClipboardCheck className="w-4 h-4" />, label: 'Completed',
      value: String(o.submitted), sub: `${o.responses} candidate response${o.responses === 1 ? '' : 's'}`,
    },
    {
      icon: <Gauge className="w-4 h-4" />, label: 'Avg score',
      value: o.avgRating != null ? o.avgRating.toFixed(1) : '—',
      sub: o.avgRating != null ? 'across all submitted' : 'no submissions yet',
    },
    {
      icon: <Calculator className="w-4 h-4" />, label: 'Calculator runs',
      value: String(o.calculations), sub: 'saved bill-to-pay runs',
    },
    {
      icon: <MailCheck className="w-4 h-4" />, label: 'Emails sent',
      value: String(o.emailsSent), sub: `${o.emailsTestMode} test-mode · ${o.emailsFailed} failed`,
    },
  ]

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label}
            className="rounded-2xl border border-[#eaeef5] bg-white shadow-[0_6px_20px_rgba(15,23,42,0.05)] px-4 py-3.5">
            <div className="flex items-center gap-1.5 text-[#64748b]">
              <span className="text-[#4f46e5]">{s.icon}</span>
              <span className="text-[10px] font-bold uppercase tracking-[0.7px]">{s.label}</span>
            </div>
            <div className="text-[26px] font-extrabold tabular-nums text-[#0f172a] leading-none mt-1.5">{s.value}</div>
            <div className="text-[11px] text-[#94a3b8] mt-1 truncate">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#4f46e5]" /> Latest submissions
          </h2>
          {data.recentSubmissions.length === 0 ? (
            <div className="text-[13px] text-[#94a3b8] py-4 text-center">No completed checklists yet.</div>
          ) : (
            <div className="divide-y divide-[#eef1f6]">
              {data.recentSubmissions.map((s) => (
                <div key={s.id} className="py-2.5 flex items-center gap-3 flex-wrap">
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-bold text-[#0f172a] truncate">
                      {s.candidateName || s.title}
                    </div>
                    <div className="text-[11.5px] text-[#94a3b8] truncate">
                      {s.templateKey.toUpperCase()} · by {s.ownerEmail} · {new Date(s.completedAt).toLocaleDateString()}
                    </div>
                  </div>
                  {s.avgRating != null && (
                    <div className={`text-[16px] font-extrabold tabular-nums ${ratingColor(s.avgRating)}`}>
                      {s.avgRating.toFixed(1)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 py-5">
          <h2 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155] mb-3.5 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-[#4f46e5]" /> Newest recruiters
          </h2>
          {data.recentSignups.map((u) => (
            <div key={u.id} className="py-2.5 flex items-center gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-bold text-[#0f172a] truncate">{u.email}</div>
                <div className="text-[11.5px] text-[#94a3b8]">
                  {u.company || 'no company'} · joined {new Date(u.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
