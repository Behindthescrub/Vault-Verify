'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NumberInput } from '@/components/number-input'
import { api } from '@/lib/client-api'
import { computeCalc, money } from '@/lib/calc'
import { currentGsaFiscalYear } from '@/lib/gsa'
import type { SavedCalculation, UserSettings } from '@/lib/types'
import {
  Briefcase, Eye, EyeOff, Loader2, MapPin, Save, Trash2, Upload, Clock4, ExternalLink,
} from 'lucide-react'

type Props = {
  settings: UserSettings
  onSettingsChange: (s: Partial<UserSettings>) => void
}

type CalcState = {
  billRate: number
  mspFeePct: number
  payRate: number
  onboardingPct: number
  hoursPerWeek: number
  otEnabled: boolean
  otThreshold: number
  otMultiplier: number
  travelerMode: boolean
  stipendSource: 'manual' | 'auto'
  manLodging: number
  manMeals: number
  manualWeekly: number
}

const DEFAULTS: CalcState = {
  billRate: 75, mspFeePct: 5, payRate: 50, onboardingPct: 22, hoursPerWeek: 36,
  otEnabled: false, otThreshold: 40, otMultiplier: 1.5,
  travelerMode: false, stipendSource: 'manual',
  manLodging: 159, manMeals: 79, manualWeekly: 1666,
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

export function CalculatorView({ settings, onSettingsChange }: Props) {
  const [st, setSt] = useState<CalcState>(() => ({
    ...DEFAULTS,
    onboardingPct: settings.defaultOnboardingPct ?? DEFAULTS.onboardingPct,
    otEnabled: settings.otEnabled ?? DEFAULTS.otEnabled,
  }))
  const onboardingTouched = useRef(false)
  const manualWeeklyTouched = useRef(false)

  // GSA auto-fetch fields
  const [pdCity, setPdCity] = useState('New York')
  const [pdState, setPdState] = useState('NY')
  const [pdZip, setPdZip] = useState('')
  const [pdYear, setPdYear] = useState(() => currentGsaFiscalYear())
  const [pdMonth, setPdMonth] = useState(new Date().getMonth() + 1)
  const [pdStatus, setPdStatus] = useState<{ text: string; kind: 'idle' | 'error' | 'success' | 'busy' }>({
    text: 'Fetch live GSA per-diem rates for any destination.',
    kind: 'idle',
  })
  const [fetching, setFetching] = useState(false)

  // Reveal breakdown
  const [revealed, setRevealed] = useState(false)

  // Saved runs
  const [saved, setSaved] = useState<SavedCalculation[]>([])
  const [calcName, setCalcName] = useState('')
  const [savingRun, setSavingRun] = useState(false)
  const [runError, setRunError] = useState('')

  // Keep defaults in sync with user settings until the user edits them here
  useEffect(() => {
    if (!onboardingTouched.current && settings.defaultOnboardingPct != null) {
      setSt((s) => ({ ...s, onboardingPct: settings.defaultOnboardingPct }))
    }
  }, [settings.defaultOnboardingPct])

  const set = <K extends keyof CalcState>(key: K, value: CalcState[K]) =>
    setSt((s) => ({ ...s, [key]: value }))

  const num = (v: string) => Number(v) || 0

  const currentStipendWeekly = manualWeeklyTouched.current
    ? st.manualWeekly
    : (st.manLodging + st.manMeals) * 7

  const results = useMemo(
    () =>
      computeCalc(
        {
          billRate: st.billRate,
          mspFeePct: st.mspFeePct,
          payRate: st.payRate,
          onboardingPct: st.onboardingPct,
          hoursPerWeek: st.hoursPerWeek,
          otEnabled: st.otEnabled,
          otThreshold: st.otThreshold,
          otMultiplier: st.otMultiplier,
          travelerMode: st.travelerMode,
          stipendWeekly: currentStipendWeekly,
        },
        { minW2: settings.minW2 ?? 0 }
      ),
    [st, currentStipendWeekly, settings.minW2]
  )

  async function toggleOvertime(checked: boolean) {
    set('otEnabled', checked)
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify({ otEnabled: checked }) })
      onSettingsChange({ otEnabled: checked })
    } catch { /* preference only — ignore failure */ }
  }

  async function fetchPerDiem() {
    setFetching(true)
    setPdStatus({ text: 'Fetching GSA Per Diem…', kind: 'busy' })
    try {
      const q = new URLSearchParams({
        city: pdCity, state: pdState, zip: pdZip,
        year: String(pdYear), month: String(pdMonth),
      })
      const data = await api<{ perDiem: { lodging: number; meals: number; daily: number; weekly: number; location: string } }>(
        `/api/calculator/gsa?${q.toString()}`
      )
      const pd = data.perDiem
      manualWeeklyTouched.current = true
      setSt((s) => ({ ...s, manLodging: pd.lodging, manMeals: pd.meals, manualWeekly: pd.weekly }))
      setPdStatus({
        text: `Per Diem loaded: ${money(pd.daily)}/day, ${money(pd.weekly)}/week (${pd.location}, FY${pdYear}).`,
        kind: 'success',
      })
    } catch (e) {
      setPdStatus({ text: e instanceof Error ? e.message : 'Per Diem fetch failed', kind: 'error' })
    } finally {
      setFetching(false)
    }
  }

  async function refreshSaved() {
    try {
      const data = await api<{ calculations: SavedCalculation[] }>('/api/calculations')
      setSaved(data.calculations)
    } catch { /* list refresh failure is non-fatal */ }
  }
  useEffect(() => { refreshSaved() }, [])

  function snapshotInputs(): Record<string, unknown> {
    return { ...st, stipendWeekly: currentStipendWeekly }
  }

  async function saveRun() {
    setRunError('')
    const name = calcName.trim() || `${money(st.billRate)}/hr bill · ${st.payRate}/hr pay · ${st.hoursPerWeek}h`
    setSavingRun(true)
    try {
      await api('/api/calculations', {
        method: 'POST',
        body: JSON.stringify({ name, inputs: snapshotInputs(), results }),
      })
      setCalcName('')
      await refreshSaved()
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSavingRun(false)
    }
  }

  async function deleteRun(id: string) {
    try {
      await api(`/api/calculations/${id}`, { method: 'DELETE' })
      await refreshSaved()
    } catch { /* ignore */ }
  }

  function loadRun(run: SavedCalculation) {
    const i = run.inputs as Partial<CalcState>
    onboardingTouched.current = true
    manualWeeklyTouched.current = true
    setSt((s) => ({ ...DEFAULTS, ...s, ...i }))
    setCalcName(run.name)
    // scroll to top so the loaded numbers are visible
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const company = settings.companyName || 'Bill-to-Pay Staffing Calculator'

  return (
    <div className="max-w-[1100px] mx-auto">
      {/* ===== Card header ===== */}
      <div className="rounded-t-3xl px-6 sm:px-9 pt-6 pb-5 text-white relative flex items-center gap-4 flex-wrap"
        style={{
          background:
            'radial-gradient(600px 200px at 0% 0%, rgba(46,158,91,0.35), transparent 60%), linear-gradient(135deg,#0A2B23 0%, #0E3B32 60%, #124F41 100%)',
        }}>
        <div className="after:content-[''] after:absolute after:left-0 after:right-0 after:bottom-0 after:h-[3px]"
          style={{ background: 'linear-gradient(90deg,#7BC894,#1F7A44,#22d3ee)' }} />
        <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/15 backdrop-blur flex items-center justify-center overflow-hidden shrink-0">
          {settings.companyLogoUrl ? (
            <img src={settings.companyLogoUrl} alt="Company logo" className="w-full h-full object-cover" />
          ) : (
            <Briefcase className="w-6 h-6" />
          )}
        </div>
        <div>
          <h1 className="text-[22px] font-extrabold tracking-tight m-0">{company}</h1>
          <p className="text-[13px] font-medium text-[#A8CFB8] m-0 mt-0.5">Margin → Traveler Stipend Split</p>
        </div>
      </div>

      {/* ===== Flow track ===== */}
      <div className="flex gap-2 px-6 sm:px-9 py-4 flex-wrap"
        style={{ background: 'linear-gradient(180deg,#0A2B23,#0d1a35)' }}>
        <FlowStep active>1. Margin Calculator</FlowStep>
        <FlowStep arrow>2. Stipend Split</FlowStep>
        <FlowStep arrow>3. Saved Runs</FlowStep>
      </div>

      {/* ===== Section 1: margin calculator ===== */}
      <Section num="1" title="Staffing Margin Calculator"
        action={
          <button type="button" onClick={() => setRevealed((r) => !r)}
            className={`h-8 px-3.5 rounded-full text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer border transition-colors ${
              revealed ? 'bg-[#E9F5EC] text-[#1E6B3C] border-[#CBE8D6]' : 'bg-[#f1f4f9] text-[#475569] border-[#d8dee9] hover:bg-[#e5e9f0]'
            }`}>
            {revealed ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {revealed ? 'Hide breakdown' : 'Reveal breakdown'}
          </button>
        }
        desc="Onboarding % is the all-in cost overhead — payroll burden, drug test, background check, tools, everything. Default is set in Settings. Click Reveal breakdown to see the cost components behind the margin.">

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <NumField label="Bill Rate ($/hr)" value={st.billRate} onChange={(v) => set('billRate', v)} step={0.01} />
          <NumField label="MSP Fee (%)" value={st.mspFeePct} onChange={(v) => set('mspFeePct', v)} step={0.01} />
          <NumField label="Candidate Pay ($/hr)" value={st.payRate} onChange={(v) => set('payRate', v)} step={0.01} />
          <NumField label="Onboarding (%)" hint="payroll, drug/bg test, tools — set default in Settings"
            value={st.onboardingPct} onChange={(v) => { onboardingTouched.current = true; set('onboardingPct', v) }} step={0.01} />
          <NumField label="Hours / Week" value={st.hoursPerWeek} onChange={(v) => set('hoursPerWeek', v)} step={0.5} />
        </div>

        {/* Overtime toggle */}
        <ToggleRow
          on={st.otEnabled}
          onToggle={toggleOvertime}
          active={results.otActive}
          variant="ot"
          titleOn="Overtime — enabled"
          titleOff="Overtime — off"
          subOn="OT applies to hours above the threshold. Toggle off for straight-time contracts."
          subOff="Toggle on if this contract includes overtime pay (e.g. over 40 hrs/wk at 1.5×)."
        />
        {st.otEnabled && (
          <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-3.5 p-4 rounded-xl bg-[#fffbeb] border border-[#fde68a]">
            <NumField label="OT Threshold (hrs/wk)" hint="Hours above this trigger OT" amber
              value={st.otThreshold} onChange={(v) => set('otThreshold', v)} step={0.5} />
            <NumField label="OT Multiplier" hint="e.g. 1.5 = time-and-a-half" amber
              value={st.otMultiplier} onChange={(v) => set('otMultiplier', v)} step={0.01} />
          </div>
        )}

        {/* Always-visible summary */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          <ResultBox highlight label="Margin / Hour" value={`${money(results.marginHourly)}/hr`} good={results.marginHourly >= 0} />
          <ResultBox highlight label="Total Weekly Pay Package" value={money(results.totalWeeklyPay)}
            sub={results.otActive
              ? `${money(results.regPay)} reg + ${money(results.otPay)} OT (${results.otHours}h @ ${st.otMultiplier}×)`
              : 'Candidate Pay × Hours → feeds Step 2 cap reference'} />
        </div>

        {/* Hidden breakdown */}
        {revealed && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mt-3 animate-in fade-in">
            <ResultBox label="MSP Fee" value={`${money(results.blendedMspHourly)}/hr`} />
            <ResultBox highlight label="Net Bill" value={`${money(results.blendedNetBillHourly)}/hr`} />
            <ResultBox label="Onboarding Cost" value={`${money(results.onboardCostHourly)}/hr`} />
            <ResultBox label="Cost to Company" value={`${money(results.costToCompanyHourly)}/hr`} />
            <ResultBox highlight label="Margin %" value={`${results.marginPct.toFixed(2)}%`} good={results.marginPct >= 0} />
          </div>
        )}
      </Section>

      {/* ===== Section 2: stipend split ===== */}
      <Section num="2" title="GSA Per Diem / Stipend Split"
        desc="Turn on the Traveler toggle if the candidate commutes 50+ miles from the facility — this unlocks the stipend (non-taxable) split. Otherwise, the entire pay package goes to W2.">

        <ToggleRow
          on={st.travelerMode}
          onToggle={(v) => set('travelerMode', v)}
          variant="traveler"
          titleOn="Traveler — stipend split active (50+ miles)"
          titleOff="Local candidate — full pay on W2"
          subOn="Stipend (non-taxable) is split from W2 (taxable). Onboarding % applies only to the W2 portion."
          subOff="Toggle on if the candidate travels 50+ miles — enables GSA stipend (non-taxable) split."
        />

        {st.travelerMode ? (
          <div>
            {/* Manual vs auto */}
            <div className="inline-flex gap-1 p-1.5 rounded-2xl bg-[#eef1f7] border border-[#e2e7f0]">
              <SourcePill active={st.stipendSource === 'manual'} onClick={() => set('stipendSource', 'manual')}>Manual entry</SourcePill>
              <SourcePill active={st.stipendSource === 'auto'} onClick={() => set('stipendSource', 'auto')}>Live GSA fetch</SourcePill>
            </div>

            {st.stipendSource === 'manual' ? (
              <div className="mt-3.5 rounded-2xl border border-[#eaeef5] bg-[#fafbff] p-4.5 sm:p-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <NumField label="Daily Lodging ($)" value={st.manLodging}
                    onChange={(v) => { manualWeeklyTouched.current = false; set('manLodging', v) }} step={0.01} />
                  <NumField label="Daily M&IE ($)" value={st.manMeals}
                    onChange={(v) => { manualWeeklyTouched.current = false; set('manMeals', v) }} step={0.01} />
                </div>
                <div className="mt-2.5 text-[11.5px] text-[#94a3b8] bg-[#f8fafc] rounded-lg px-3.5 py-2.5 leading-relaxed">
                  Or skip lodging/M&amp;IE and type the weekly stipend directly below.
                </div>
                <div className="mt-2.5">
                  <NumField label="Weekly Stipend ($) — overrides the fields above if edited" value={st.manualWeekly}
                    onChange={(v) => { manualWeeklyTouched.current = true; set('manualWeekly', v) }} step={0.01} />
                </div>
              </div>
            ) : (
              <div className="mt-3.5 rounded-2xl border border-[#eaeef5] bg-[#fafbff] p-4.5 sm:p-5">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
                  <TextField label="City" value={pdCity} onChange={setPdCity} placeholder="e.g. New York" />
                  <TextField label="State" value={pdState} onChange={(v) => setPdState(v.toUpperCase().slice(0, 2))} placeholder="NY" maxLength={2} />
                  <TextField label="ZIP (optional)" value={pdZip} onChange={setPdZip} placeholder="10001" />
                  <NumField label="Fiscal Year" value={pdYear} onChange={setPdYear} step={1} />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 mt-3">
                  <label className="block">
                    <span className="block text-[10.5px] font-bold tracking-[0.6px] uppercase text-[#334155] mb-1.5">Month</span>
                    <select value={pdMonth} onChange={(e) => setPdMonth(Number(e.target.value))}
                      className="w-full h-[46px] rounded-xl border border-[#d8dee9] px-3.5 text-[14px] font-medium bg-white focus:border-[#1F7A44] focus:ring-4 focus:ring-[rgba(31,122,68,0.12)] outline-none">
                      {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                    </select>
                  </label>
                </div>
                <div className="mt-4">
                  <Button onClick={fetchPerDiem} disabled={fetching}
                    className="text-[13.5px] h-[46px] font-bold"
                    style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)', boxShadow: '0 4px 14px rgba(31,122,68,0.30)' }}>
                    {fetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    Fetch GSA Per Diem
                  </Button>
                </div>
                <StatusMessage kind={pdStatus.kind}>{pdStatus.text}</StatusMessage>
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-[#CBE8D6] bg-[#E9F5EC] px-4 py-3 text-[13px] font-semibold text-[#3730a3]">
            <MapPin className="w-[18px] h-[18px] shrink-0" />
            <span>Local candidate — entire pay package goes to W2 (taxable). No stipend applied.</span>
          </div>
        )}

        {/* Split results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <ResultBox highlight label="Total Weekly Pay" value={money(results.totalWeeklyPay)} sub="Candidate gross package" />
          <ResultBox highlight label="Stipend Weekly" value={money(results.stipendWeekly)}
            badge={st.travelerMode && results.stipendWeekly > 0 ? { text: 'Non-tax', tone: 'nontax' } : undefined}
            sub={st.travelerMode
              ? (results.stipendWeekly > 0
                ? (results.minWageApplied ? 'Reduced to keep W2 at min' : 'Non-taxable (GSA)')
                : 'Stipend is $0 — full pay on W2')
              : 'No stipend (local)'} />
          <ResultBox highlight label="W2 Weekly" value={money(results.w2Weekly)}
            badge={{ text: 'Tax', tone: 'tax' }} sub="Taxable wages" />
          <ResultBox label="W2 Hourly" highlight={results.minWageUndersold || results.minWageApplied ? true : !st.travelerMode}
            good={results.minWageUndersold ? false : undefined}
            value={`${money(results.w2Hourly)}/hr`}
            sub={
              results.minWageUndersold
                ? `Below min W2 ${money(settings.minW2 ?? 0)}/hr`
                : results.minWageApplied
                  ? `↳ raised to min W2 ${money(settings.minW2 ?? 0)}/hr`
                  : st.travelerMode ? '= Total − Stipend' : '= Candidate Pay'
            } />
        </div>
      </Section>

      {/* ===== Section 3: saved runs ===== */}
      <Section num="3" title="Saved Runs"
        desc="Name this calculation and save it. Load it later from the list below — every input and result is restored.">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="flex-1">
            <label className="block">
              <span className="block text-[10.5px] font-bold tracking-[0.6px] uppercase text-[#334155] mb-1.5">Run name</span>
              <Input value={calcName} onChange={(e) => setCalcName(e.target.value)}
                placeholder="e.g. NYC ICU RN — 36hr nights" className="h-[46px]" maxLength={160} />
            </label>
          </div>
          <Button onClick={saveRun} disabled={savingRun}
            className="h-[46px] self-end sm:self-auto text-[13.5px] font-bold"
            style={{ background: 'linear-gradient(180deg,#34A853,#2E9E5B)', boxShadow: '0 4px 14px rgba(5,150,105,0.30)' }}>
            {savingRun ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save calculation
          </Button>
        </div>
        {runError && <div className="mt-2 text-[13px] font-semibold text-[#E5484D]">{runError}</div>}

        <div className="mt-4 rounded-2xl border border-[#eaeef5] divide-y divide-[#eef1f6] overflow-hidden">
          {saved.length === 0 && (
            <div className="px-5 py-8 text-center text-[13px] text-[#94a3b8]">
              No saved runs yet — calculate something above and save it here.
            </div>
          )}
          {saved.map((run) => {
            const i = run.inputs as Partial<CalcState>
            const r = run.results as Partial<ReturnType<typeof computeCalc>>
            return (
              <div key={run.id} className="px-4 sm:px-5 py-3.5 flex items-center gap-3 hover:bg-[#f8fafc] transition-colors">
                <div className="min-w-0 flex-1">
                  <div className="font-bold text-[13.5px] text-[#0f172a] truncate">{run.name}</div>
                  <div className="text-[11.5px] text-[#94a3b8] mt-0.5 flex flex-wrap gap-x-2">
                    <span>{money(i.billRate ?? 0)}/hr bill</span>
                    <span>· {money(i.payRate ?? 0)}/hr pay</span>
                    <span>· {i.hoursPerWeek ?? 0}h/wk</span>
                    {i.travelerMode ? <span>· traveler</span> : null}
                    <span className="hidden sm:inline">· margin {r.marginPct != null ? r.marginPct.toFixed(2) + '%' : '—'}</span>
                    <span>· {new Date(run.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Button variant="ghost" onClick={() => loadRun(run)} className="h-9 px-3 text-[12.5px] gap-1.5">
                    <Clock4 className="w-3.5 h-3.5" /> Load
                  </Button>
                  <Button variant="ghost" onClick={() => deleteRun(run.id)}
                    className="h-9 px-3 text-[12.5px] text-[#E5484D] hover:bg-[#FDEEEE] hover:text-[#C13A3E]">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="mt-2.5 text-[11.5px] text-[#94a3b8] flex items-center gap-1.5">
          <ExternalLink className="w-3 h-3" /> Margin snapshot is stored with each run so historical numbers stay exactly as they were.
        </p>
      </Section>
    </div>
  )
}

/* ---------- building blocks (visual port of the original CSS) ---------- */

function FlowStep({ children, active, arrow }: { children: React.ReactNode; active?: boolean; arrow?: boolean }) {
  if (arrow) {
    return (
      <span className={`text-[11px] font-bold tracking-[0.4px] uppercase px-3.5 py-1.5 rounded-full border ${
        active
          ? 'bg-[#1F7A44] text-white border-[#2E9E5B] shadow-[0_0_0_3px_rgba(31,122,68,0.25)]'
          : 'bg-white/[0.06] text-[#cbd5e1] border-white/[0.08]'
      }`}>
        → {children}
      </span>
    )
  }
  return (
    <span className={`text-[11px] font-bold tracking-[0.4px] uppercase px-3.5 py-1.5 rounded-full border ${
      active
        ? 'bg-[#1F7A44] text-white border-[#2E9E5B] shadow-[0_0_0_3px_rgba(31,122,68,0.25)]'
        : 'bg-white/[0.06] text-[#cbd5e1] border-white/[0.08]'
    }`}>
      {children}
    </span>
  )
}

function Section({ num, title, desc, action, children }: {
  num: string; title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="px-6 sm:px-9 py-7 border-b border-[#eef1f6] last:border-b-0">
      <h2 className="flex items-center gap-3 text-[17px] font-extrabold text-[#0f172a] tracking-tight m-0 flex-wrap">
        <span className="w-[26px] h-[26px] rounded-lg text-white text-[13px] font-extrabold inline-flex items-center justify-center shrink-0"
          style={{ background: 'linear-gradient(135deg,#2E9E5B,#1E6B3C)', boxShadow: '0 4px 10px rgba(31,122,68,0.35)' }}>
          {num}
        </span>
        {title}
        {action}
      </h2>
      {desc && <p className="text-[12.5px] text-[#64748b] mt-1.5 mb-4.5 leading-relaxed sm:ml-[38px]">{desc}</p>}
      {children}
    </section>
  )
}

function NumField({ label, hint, value, onChange, step = 1, amber }: {
  label: string; hint?: string; value: number; onChange: (v: number) => void; step?: number; amber?: boolean
}) {
  return (
    <label className="block">
      <span className={`block text-[10.5px] font-bold tracking-[0.6px] uppercase mb-1.5 ${amber ? 'text-[#78350f]' : 'text-[#334155]'}`}>
        {label}
        {hint && <span className={`block text-[10.5px] font-medium tracking-normal normal-case mt-0.5 ${amber ? 'text-[#a16207]' : 'text-[#94a3b8]'}`}>{hint}</span>}
      </span>
      <NumberInput value={value} onChange={onChange} step={step} min={0}
        className={`h-[46px] rounded-xl ${
          amber
            ? 'border-[#fde68a] focus:border-[#f59e0b] focus:ring-[rgba(245,158,11,0.12)]'
            : ''
        }`} />
    </label>
  )
}

function TextField({ label, value, onChange, placeholder, maxLength }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; maxLength?: number
}) {
  return (
    <label className="block">
      <span className="block text-[10.5px] font-bold tracking-[0.6px] uppercase text-[#334155] mb-1.5">{label}</span>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} maxLength={maxLength} className="h-[46px]" />
    </label>
  )
}

function ToggleRow({ on, onToggle, active, variant, titleOn, titleOff, subOn, subOff }: {
  on: boolean; onToggle: (v: boolean) => void; active?: boolean; variant: 'ot' | 'traveler'
  titleOn: string; titleOff: string; subOn: string; subOff: string
}) {
  const traveler = variant === 'traveler'
  return (
    <div className={`flex items-center gap-3.5 rounded-2xl px-4 py-3.5 mt-3.5 border transition-colors ${
      traveler
        ? (on ? 'bg-gradient-to-br from-[#f0fdf4] to-[#E9F5EC] border-[#bbf7d0]' : 'bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] border-[#e2e8f0]')
        : (on
          ? (active ? 'bg-gradient-to-br from-[#FDF1DC] to-[#fde68a] border-[#f59e0b] shadow-[0_0_0_3px_rgba(245,158,11,0.12)]' : 'bg-gradient-to-br from-[#fffbeb] to-[#FDF1DC] border-[#fde68a]')
          : 'bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] border-[#e2e8f0]')
    }`}>
      <label className="relative inline-block w-[46px] h-[26px] shrink-0 cursor-pointer">
        <input type="checkbox" checked={on} onChange={(e) => onToggle(e.target.checked)} className="opacity-0 w-0 h-0 absolute" />
        <span className={`absolute inset-0 rounded-full transition-colors ${
          on
            ? (traveler ? 'bg-gradient-to-b from-[#34A853] to-[#2E9E5B]' : 'bg-gradient-to-b from-[#34A853] to-[#2E9E5B]')
            : 'bg-[#cbd5e1]'
        }`} />
        <span className={`absolute bottom-[3px] left-[3px] w-5 h-5 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.2)] transition-transform ${
          on ? 'translate-x-5' : ''
        }`} />
      </label>
      <div className="flex-1">
        <strong className={`block text-[14px] font-bold tracking-tight ${
          traveler ? (on ? 'text-[#1E6B3C]' : 'text-[#0f172a]') : (on ? (active ? 'text-[#9A6200]' : 'text-[#92400e]') : 'text-[#0f172a]')
        }`}>
          {on ? titleOn : titleOff}
        </strong>
        <span className="block text-[12px] text-[#64748b] mt-0.5 leading-relaxed">{on ? subOn : subOff}</span>
      </div>
    </div>
  )
}

function SourcePill({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick}
      className={`text-[13px] font-bold px-4.5 py-2 rounded-[10px] cursor-pointer transition-colors inline-flex items-center gap-2 ${
        active ? 'bg-white text-[#0E3B32] shadow-[0_2px_8px_rgba(26,42,108,0.12)] ring-1 ring-[rgba(31,122,68,0.15)]' : 'text-[#64748b] hover:text-[#334155]'
      }`}>
      {active && <span className="w-2 h-2 rounded-full bg-[#1F7A44] shrink-0" />}
      {children}
    </button>
  )
}

function StatusMessage({ kind, children }: { kind: 'idle' | 'error' | 'success' | 'busy'; children: React.ReactNode }) {
  const cls = kind === 'error'
    ? 'border-[#E5484D] text-[#E5484D] bg-[#FDEEEE]'
    : kind === 'success'
      ? 'border-[#34A853] text-[#2E9E5B] bg-[#E9F5EC]'
      : 'border-[#cbd5e1] text-[#64748b] bg-[#f8fafc]'
  return (
    <div className={`mt-3.5 rounded-[10px] border-l-[3px] px-3.5 py-2.5 text-[13px] leading-relaxed ${cls}`}>
      {children}
    </div>
  )
}

function ResultBox({ label, value, sub, highlight, good, badge }: {
  label: React.ReactNode; value: string; sub?: string; highlight?: boolean; good?: boolean; badge?: { text: string; tone: 'tax' | 'nontax' }
}) {
  return (
    <div className={`rounded-2xl border px-4 py-3.5 transition-transform hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(15,23,42,0.06)] ${
      highlight ? 'bg-gradient-to-b from-[#E9F5EC] to-[#DDEFE3] border-[#CBE8D6]' : 'bg-gradient-to-b from-[#fbfcfe] to-[#f5f7fb] border-[#eaeef5]'
    }`}>
      <div className="text-[10px] font-bold tracking-[0.7px] uppercase text-[#64748b] flex items-center gap-1.5 flex-wrap">
        {label}
        {badge && (
          <span className={`text-[9.5px] font-bold tracking-[0.5px] uppercase px-[7px] py-0.5 rounded-full ${
            badge.tone === 'tax' ? 'bg-[#FDEAEA] text-[#C13A3E]' : 'bg-[#DFF2E3] text-[#2E7D4F]'
          }`}>{badge.text}</span>
        )}
      </div>
      <div className={`text-[21px] font-extrabold tabular-nums tracking-tight mt-1 ${
        good === true ? 'text-[#2E9E5B]' : good === false ? 'text-[#E5484D]' : 'text-[#0f172a]'
      }`}>{value}</div>
      {sub && <div className="text-[11.5px] text-[#94a3b8] font-medium mt-0.5">{sub}</div>}
    </div>
  )
}
