'use client'

// Shared 1–5 rating UI for skills checklists.
// 1 = no experience … 5 = expert (see src/lib/templates.ts SCALE_LEGEND).

export function RatingPills({ value, onChange, size = 'md' }: {
  value: number | null
  onChange: (v: number) => void
  size?: 'sm' | 'md'
}) {
  const h = size === 'sm' ? 'h-7 min-w-7' : 'h-8 min-w-8'
  const text = size === 'sm' ? 'text-[12px]' : 'text-[13px]'
  return (
    <div className="inline-flex gap-1" role="radiogroup" aria-label="Self-rating 1 to 5">
      {[1, 2, 3, 4, 5].map((n) => {
        const selected = value === n
        const tone = ratingTone(n)
        return (
          <button key={n} type="button" role="radio" aria-checked={selected}
            onClick={() => onChange(n)}
            title={`Rate ${n}`}
            className={`${h} ${text} px-2 rounded-lg border font-bold tabular-nums cursor-pointer transition-colors ${
              selected ? tone.selected : `bg-white border-[#d8dee9] text-[#64748b] hover:border-[#b8c2d4] hover:text-[#334155]`
            }`}>
            {n}
          </button>
        )
      })}
    </div>
  )
}

function ratingTone(n: number): { selected: string } {
  switch (n) {
    case 1: case 2: return { selected: 'bg-[#fee2e2] border-[#fca5a5] text-[#b91c1c]' }
    case 3: return { selected: 'bg-[#fef3c7] border-[#fcd34d] text-[#b45309]' }
    case 4: case 5: return { selected: 'bg-[#dcfce7] border-[#86efac] text-[#15803d]' }
    default: return { selected: 'bg-[#eef2ff] border-[#c7d2fe] text-[#4338ca]' }
  }
}

export function RatingBadge({ value }: { value: number | null }) {
  if (value == null) return <span className="text-[12px] text-[#94a3b8]">—</span>
  const tone = ratingTone(Math.round(value)).selected
  return (
    <span className={`inline-block text-[12px] font-bold tabular-nums px-2 py-0.5 rounded-full border ${tone}`}>
      {value.toFixed(1)}
    </span>
  )
}

export function ratingColor(value: number): string {
  if (value <= 2) return 'text-[#b91c1c]'
  if (value < 4) return 'text-[#b45309]'
  return 'text-[#15803d]'
}
