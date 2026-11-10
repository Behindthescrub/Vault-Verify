'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { api } from '@/lib/client-api'
import type { ChecklistDetail } from '@/lib/types'
import { ChecklistDocument } from '@/components/checklist-document'
import { ArrowLeft, ClipboardCheck, Copy, Download, Link2, Loader2, Mail, UserPen } from 'lucide-react'

type Props = {
  id: string
  onBack: () => void
  onManualEntry: (id: string) => void
}

export function ChecklistDetail({ id, onBack, onManualEntry }: Props) {
  const [data, setData] = useState<ChecklistDetail | null>(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [pdfBusy, setPdfBusy] = useState(false)

  useEffect(() => {
    setData(null)
    api<{ checklist: ChecklistDetail }>(`/api/checklists/${id}`)
      .then((d) => setData(d.checklist))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [id])

  if (error) {
    return (
      <div className="max-w-[1100px] mx-auto">
        <Button variant="ghost" onClick={onBack} className="mb-4 gap-1.5"><ArrowLeft className="w-4 h-4" /> Back</Button>
        <div className="text-[13px] font-semibold text-[#E5484D] bg-[#FDEEEE] border-l-[3px] border-[#E5484D] rounded-md px-3.5 py-2.5">{error}</div>
      </div>
    )
  }
  if (!data) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  const link = typeof window !== 'undefined' ? `${window.location.origin}/?c=${data.token}` : ''

  function copyLink() {
    if (!link) return
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    }).catch(() => {})
  }

  // Download the VaultVerify-styled PDF generated server-side
  async function downloadPdf() {
    if (!data || pdfBusy) return
    setPdfBusy(true)
    try {
      const res = await fetch(`/api/checklists/${data.id}/pdf`)
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        throw new Error(j?.error ?? 'Could not generate the PDF')
      }
      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const m = /filename="([^"]+)"/.exec(disposition)
      const filename = m?.[1] ?? `Skills-Checklist-${(data.candidateName ?? 'Candidate').replace(/[^A-Za-z0-9]+/g, '-')}.pdf`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Could not generate the PDF')
    } finally {
      setPdfBusy(false)
    }
  }

  const statusBadge =
    data.status === 'submitted' ? 'Completed' : data.status === 'sent' ? 'Awaiting candidate' : 'Draft'

  return (
    <div className="max-w-[900px] mx-auto">
      {/* Toolbar (hidden when printing) */}
      <div className="no-print flex items-center justify-between gap-3 flex-wrap mb-4">
        <Button variant="ghost" onClick={onBack} className="gap-1.5 h-9 text-[13px]">
          <ArrowLeft className="w-4 h-4" /> All checklists
        </Button>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${
            data.status === 'submitted' ? 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]'
              : data.status === 'sent' ? 'bg-[#E9F5EC] border-[#CBE8D6] text-[#1E6B3C]'
                : 'bg-[#f1f5f9] border-[#e2e8f0] text-[#64748b]'
          }`}>{statusBadge}</span>
          <Button variant="ghost" className="h-9 gap-1.5 text-[13px]" onClick={copyLink}>
            {copied ? <Copy className="w-4 h-4 text-[#2E9E5B]" /> : <Link2 className="w-4 h-4" />}
            {copied ? 'Link copied' : 'Copy candidate link'}
          </Button>
          {data.candidateEmail && (
            <a href={`mailto:${data.candidateEmail}`} className="h-9 inline-flex items-center gap-1.5 text-[13px] font-bold px-4 rounded-xl bg-[#f1f4f9] text-[#475569] hover:bg-[#e5e9f0] transition-colors"
              style={{ textDecoration: 'none' }}>
              <Mail className="w-4 h-4" /> Email candidate
            </a>
          )}
          {data.ratings && (
            <Button onClick={downloadPdf} disabled={pdfBusy} className="h-9 gap-1.5 text-[13px] font-bold"
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
              {pdfBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              Download PDF
            </Button>
          )}
          {!data.ratings && (
            <Button variant="ghost" className="h-9 gap-1.5 text-[13px]" onClick={() => onManualEntry(data.id)}>
              <UserPen className="w-4 h-4" /> Enter ratings manually
            </Button>
          )}
        </div>
      </div>

      {/* Document or empty state */}
      {data.ratings ? (
        <ChecklistDocument data={data} />
      ) : (
        <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-10 py-14 text-center">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[#E9F5EC] border border-[#CBE8D6] flex items-center justify-center text-[#1F7A44]">
            <ClipboardCheck className="w-6 h-6" />
          </div>
          <div className="text-[15px] font-bold text-[#334155] mt-4">No results yet</div>
          <p className="text-[13px] text-[#94a3b8] mt-1.5 max-w-md mx-auto leading-relaxed">
            Copy the candidate link above (or send it from the checklist list) — the candidate fills it in on their device
            and their skills checklist document appears here, exactly as they completed it.
            Prefer entering their answers yourself? Use “Enter ratings manually”.
          </p>
        </div>
      )}
    </div>
  )
}
