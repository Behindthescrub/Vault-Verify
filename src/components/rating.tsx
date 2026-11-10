'use client'

// Shared rating UI for skills checklists — the VaultVerify proficiency scale:
// 1 = No theory / experience · 2 = Limited · 3 = Experienced · 4 = Proficient
// plus N/A where the skill offers it, and yes/no + text question types.

import { Input } from '@/components/ui/input'
import type { RatingValue } from '@/lib/skills'

export function RatingPills({ value, onChange, hasNa = false, questionType = 'rating_1_4', size = 'md', textValue }: {
  value: RatingValue | null
  onChange: (v: RatingValue) => void
  hasNa?: boolean
  questionType?: string
  size?: 'sm' | 'md'
  textValue?: string
}) {
  const h = size === 'sm' ? 'h-7 min-w-7' : 'h-8 min-w-8'
  const text = size === 'sm' ? 'text-[12px]' : 'text-[13px]'

  if (questionType === 'text') {
    return (
      <Input
        value={typeof value === 'string' && value !== 'na' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe your experience…"
        className={`flex-1 min-w-[180px] ${size === 'sm' ? 'h-9 text-[13px]' : 'h-10 text-[13.5px]'}`}
        maxLength={2000}
      />
    )
  }

  if (questionType === 'yes_no') {
    const opts: { v: 'yes' | 'no'; label: string }[] = [
      { v: 'yes', label: 'Yes' },
      { v: 'no', label: 'No' },
    ]
    return (
      <div className="inline-flex gap-1" role="radiogroup" aria-label="Yes or No">
        {opts.map((o) => {
          const selected = value === o.v
          const tone = o.v === 'yes'
            ? 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]'
            : 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]'
          return (
            <button key={o.v} type="button" role="radio" aria-checked={selected}
              onClick={() => onChange(o.v)}
              className={`${h} ${text} px-3 rounded-lg border font-bold cursor-pointer transition-colors ${
                selected ? tone : 'bg-white border-[#d8dee9] text-[#64748b] hover:border-[#b8c2d4] hover:text-[#334155]'
              }`}>
              {o.label}
            </button>
          )
        })}
        {hasNa && <NaButton value={value} onChange={onChange} h={h} text={text} />}
      </div>
    )
  }

  // rating_1_4
  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label="Self-rating 1 to 4">
      {[1, 2, 3, 4].map((n) => {
        const selected = value === n
        const tone = ratingTone(n)
        return (
          <button key={n} type="button" role="radio" aria-checked={selected}
            onClick={() => onChange(n)}
            title={`Rate ${n}`}
            className={`${h} ${text} px-2 rounded-lg border font-bold tabular-nums cursor-pointer transition-colors ${
              selected ? tone.selected : 'bg-white border-[#d8dee9] text-[#64748b] hover:border-[#b8c2d4] hover:text-[#334155]'
            }`}>
            {n}
          </button>
        )
      })}
      {hasNa && <NaButton value={value} onChange={onChange} h={h} text={text} />}
    </div>
  )
}

function NaButton({ value, onChange, h, text }: {
  value: RatingValue | null; onChange: (v: RatingValue) => void; h: string; text: string
}) {
  const selected = value === 'na'
  return (
    <button type="button" role="radio" aria-checked={selected}
      onClick={() => onChange('na')}
      title="Not applicable"
      className={`${h} ${text} px-2 rounded-lg border font-bold cursor-pointer transition-colors ${
        selected ? 'bg-[#f1f5f9] border-[#cbd5e1] text-[#475569]' : 'bg-white border-[#e2e7f0] text-[#b6c0cf] hover:border-[#c3cbd8] hover:text-[#64748b]'
      }`}>
      N/A
    </button>
  )
}

function ratingTone(n: number): { selected: string } {
  switch (n) {
    case 1: return { selected: 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]' }
    case 2: return { selected: 'bg-[#FDF1DC] border-[#F3D9A6] text-[#9A6200]' }
    case 3: return { selected: 'bg-[#E3EDFB] border-[#B9D0F5] text-[#2F6BC4]' }
    case 4: return { selected: 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]' }
    default: return { selected: 'bg-[#E9F5EC] border-[#CBE8D6] text-[#1E6B3C]' }
  }
}

// Compact badge for showing a stored rating in results views.
export function RatingBadge({ value, questionType = 'rating_1_4' }: {
  value: RatingValue | null | undefined
  questionType?: string
}) {
  if (value == null || value === '') {
    return <span className="text-[11.5px] font-bold text-[#c3cbd8] px-2 py-0.5 rounded-md border border-[#eef1f6] bg-[#f8fafc]">—</span>
  }
  if (value === 'na') {
    return <span className="text-[11px] font-bold text-[#64748b] px-2 py-0.5 rounded-md border border-[#e2e8f0] bg-[#f1f5f9]">N/A</span>
  }
  if (questionType === 'yes_no') {
    return (
      <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
        value === 'yes' ? 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]' : 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]'
      }`}>{value === 'yes' ? 'Yes' : 'No'}</span>
    )
  }
  if (questionType === 'text' || typeof value === 'string') {
    return <span className="text-[12px] text-[#334155] font-medium max-w-[280px] truncate inline-block align-middle">{String(value)}</span>
  }
  const n = value as number
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-extrabold px-2.5 py-0.5 rounded-md border tabular-nums ${badgeTone(n)}`}>
      {n} <span className="text-[10px] font-bold opacity-70">/ 4</span>
    </span>
  )
}

function badgeTone(n: number): string {
  switch (n) {
    case 1: return 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]'
    case 2: return 'bg-[#FDF1DC] border-[#F3D9A6] text-[#9A6200]'
    case 3: return 'bg-[#E3EDFB] border-[#B9D0F5] text-[#2F6BC4]'
    case 4: return 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]'
    default: return 'bg-[#E9F5EC] border-[#CBE8D6] text-[#1E6B3C]'
  }
}

// Color helper for big average numbers (1–4 scale).
export function ratingColor(value: number): string {
  if (value < 2) return 'text-[#E5484D]'
  if (value < 3) return 'text-[#C77F0A]'
  if (value < 3.5) return 'text-[#2F6BC4]'
  return 'text-[#2E9E5B]'
}

// Big 1–4 scale legend block (candidate-facing).
export function ScaleLegend({ compact = false }: { compact?: boolean }) {
  const levels = [
    { value: 1, label: 'No theory / experience', desc: 'Have not performed this skill', cls: 'bg-[#FDEAEA] border-[#F3B8BA] text-[#C13A3E]' },
    { value: 2, label: 'Limited', desc: 'Performed only with direct oversight', cls: 'bg-[#FDF1DC] border-[#F3D9A6] text-[#9A6200]' },
    { value: 3, label: 'Experienced', desc: 'Independent with occasional guidance', cls: 'bg-[#E3EDFB] border-[#B9D0F5] text-[#2F6BC4]' },
    { value: 4, label: 'Proficient', desc: 'Fully independent, complex cases included', cls: 'bg-[#DFF2E3] border-[#BFE3CE] text-[#2E7D4F]' },
  ]
  if (compact) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {levels.map((l) => (
          <span key={l.value} className="text-[11px] text-[#64748b] bg-[#f8fafc] border border-[#eef1f6] rounded-full px-2.5 py-1">
            <b className={`inline-flex w-4.5 h-4.5 items-center justify-center rounded border text-[10px] mr-1 ${l.cls}`}>{l.value}</b>
            {l.label}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="grid gap-1.5">
      {levels.map((l) => (
        <div key={l.value} className="flex items-baseline gap-2.5 text-[12px] text-[#64748b]">
          <span className={`w-5 h-5 rounded-md border text-[11px] font-extrabold inline-flex items-center justify-center shrink-0 tabular-nums ${l.cls}`}>{l.value}</span>
          <span className="leading-relaxed"><strong className="text-[#334155]">{l.label}</strong> — {l.desc}</span>
        </div>
      ))}
    </div>
  )
}
