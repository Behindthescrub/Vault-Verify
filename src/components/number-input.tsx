'use client'

// Smooth-editing numeric input (shared by the calculator and settings).
//
// Why: a controlled `type="number"` bound to `Number(v) || 0` snaps an emptied
// field straight to "0" — clearing "$75" and retyping forced a select-all or
// double-click first. This input keeps a string draft while focused:
//   • backspace works naturally ("75" → "7" → "" → type the new value)
//   • empty field shows the placeholder, not a forced 0
//   • ↑/↓ nudge the value by `step`
//   • blur re-renders the committed (clamped) value
import { useState } from 'react'

export function formatNumberValue(v: number): string {
  if (!Number.isFinite(v)) return '0'
  return String(Math.round(v * 100) / 100)
}

const BASE_CLASS =
  'w-full rounded-md border border-[#d8dee9] bg-white px-3.5 text-[14px] font-medium outline-none ' +
  'transition-[border-color,box-shadow] focus:border-[#1F7A44] focus:ring-4 focus:ring-[rgba(31,122,68,0.12)] ' +
  'tabular-nums'

export function NumberInput({
  value,
  onChange,
  step = 1,
  min = 0,
  max,
  className = '',
  placeholder = '0',
  ...rest
}: {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  className?: string
  placeholder?: string
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'>) {
  const [draft, setDraft] = useState<string | null>(null) // non-null while editing

  const clampMin = (n: number) => {
    const x = Number.isFinite(n) ? n : min
    return Math.max(min, x)
  }
  const clampAll = (n: number) => {
    let x = clampMin(n)
    if (max != null) x = Math.min(max, x)
    return x
  }

  // Keep digits and a single decimal point (no negatives: min is 0 by default).
  const sanitize = (raw: string) => {
    let s = raw.replace(/[^0-9.]/g, '')
    const i = s.indexOf('.')
    if (i !== -1) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/\./g, '')
    return s
  }

  const shown = draft !== null ? draft : formatNumberValue(value)

  return (
    <input
      {...rest}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      spellCheck={false}
      value={shown}
      placeholder={placeholder}
      onFocus={(e) => {
        setDraft(formatNumberValue(value))
        rest.onFocus?.(e)
      }}
      onChange={(e) => {
        const s = sanitize(e.target.value)
        setDraft(s)
        onChange(clampMin(Number(s)))
      }}
      onBlur={(e) => {
        onChange(clampAll(Number(draft ?? value)))
        setDraft(null)
        rest.onBlur?.(e)
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const base = draft != null && draft !== '' ? Number(draft) : value
          const next = clampAll((Number.isFinite(base) ? base : min) + (e.key === 'ArrowUp' ? step : -step))
          const s = formatNumberValue(next)
          setDraft(s)
          onChange(next)
        }
        rest.onKeyDown?.(e)
      }}
      className={`${BASE_CLASS} ${className}`}
    />
  )
}
