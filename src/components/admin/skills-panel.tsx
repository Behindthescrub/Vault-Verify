'use client'

// Admin console → Skills data: the skills library management UI.
// Master-detail: left = Professions → Job Titles; right = Specialties + Skills.
// Includes the 2-step Excel import (validate → import), template/skill CRUD,
// group rename/delete, blank template download and full data export.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { api } from '@/lib/client-api'
import {
  AlertTriangle, Check, ChevronRight, Database, Download, FileDown, FileSpreadsheet, Loader2,
  Pencil, Plus, Search, Trash2, Upload,
} from 'lucide-react'

type TemplateRow = {
  id: string; profession: string; jobTitle: string; specialty: string
  name: string; isActive: boolean; skillCount: number; categoryCount: number
}
type SkillRow = {
  id: string; skillName: string; category: string
  questionType: string; sortOrder: number; hasNaOption: boolean
}
type Validation = {
  totalRows: number; validRows: number; errorRows: number
  errors: { row: number; message: string }[]
  duplicates: number; newTemplates: number; fileName: string
}

export function SkillsPanel() {
  const [templates, setTemplates] = useState<TemplateRow[]>([])
  const [totals, setTotals] = useState<{ templates: number; skills: number; professions: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // selection
  const [selProfession, setSelProfession] = useState('')
  const [selJobTitle, setSelJobTitle] = useState('')
  const [selTemplateId, setSelTemplateId] = useState<string | null>(null)
  const [skills, setSkills] = useState<SkillRow[]>([])
  const [skillsLoading, setSkillsLoading] = useState(false)
  const [search, setSearch] = useState('')

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const d = await api<{ templates: TemplateRow[]; totals: { templates: number; skills: number; professions: number } }>(
        '/api/admin/skills',
      )
      setTemplates(d.templates)
      setTotals(d.totals)
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  // load skills of selected template
  useEffect(() => {
    if (!selTemplateId) { setSkills([]); return }
    setSkillsLoading(true)
    api<{ template: TemplateRow; skills: SkillRow[] }>(`/api/admin/skills?templateId=${selTemplateId}`)
      .then((d) => setSkills(d.skills))
      .catch(() => setSkills([]))
      .finally(() => setSkillsLoading(false))
  }, [selTemplateId])

  // ─── grouping ─────────────────────────────────────────────────────
  const professions = useMemo(() => [...new Set(templates.map((t) => t.profession))].sort(), [templates])
  const jobTitles = useMemo(() => {
    if (!selProfession) return []
    const map = new Map<string, number>()
    for (const t of templates) {
      if (t.profession !== selProfession) continue
      map.set(t.jobTitle, (map.get(t.jobTitle) ?? 0) + t.skillCount)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [templates, selProfession])
  const specialties = useMemo(() => {
    if (!selProfession || !selJobTitle) return []
    return templates.filter((t) => t.profession === selProfession && t.jobTitle === selJobTitle)
  }, [templates, selProfession, selJobTitle])

  const searchMatches = useMemo<[string, TemplateRow[]][] | null>(() => {
    const q = search.trim().toLowerCase()
    if (!q || !selProfession) return null
    const filtered = templates.filter((t) => t.profession === selProfession && `${t.jobTitle} ${t.specialty}`.toLowerCase().includes(q))
    const map = new Map<string, TemplateRow[]>()
    for (const t of filtered) {
      if (!map.has(t.jobTitle)) map.set(t.jobTitle, [])
      map.get(t.jobTitle)!.push(t)
    }
    return [...map.entries()]
  }, [templates, search, selProfession])

  const visibleJobTitles: [string, number][] = useMemo(() => {
    if (searchMatches) return searchMatches.map(([jt, list]) => [jt, list.reduce((n, t) => n + t.skillCount, 0)] as [string, number])
    return jobTitles
  }, [searchMatches, jobTitles])
  const selTemplate = templates.find((t) => t.id === selTemplateId) ?? null

  // skills grouped by category
  const byCategory = useMemo(() => {
    const map = new Map<string, SkillRow[]>()
    for (const s of skills) {
      if (!map.has(s.category)) map.set(s.category, [])
      map.get(s.category)!.push(s)
    }
    return [...map.entries()]
  }, [skills])

  // ─── dialogs ──────────────────────────────────────────────────────
  const [msg, setMsg] = useState('')
  const [errMsg, setErrMsg] = useState('')
  function flash(m: string, e = '') {
    setMsg(m); setErrMsg(e)
    setTimeout(() => { setMsg(''); setErrMsg('') }, 4000)
  }

  // import dialog
  const [importOpen, setImportOpen] = useState(false)
  const [importFile, setImportFile] = useState<File | null>(null)
  const [validation, setValidation] = useState<Validation | null>(null)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ imported: number; skipped: number } | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  function resetImport() {
    setImportFile(null); setValidation(null); setImportResult(null)
    if (fileRef.current) fileRef.current.value = ''
  }

  async function validateFile() {
    if (!importFile) return
    setValidating(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const d = await api<Validation>('/api/admin/skills/validate-import', { method: 'POST', body: fd })
      setValidation(d)
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  async function runImport() {
    if (!importFile) return
    setImporting(true)
    try {
      const fd = new FormData()
      fd.append('file', importFile)
      const d = await api<{ imported: number; skipped: number }>('/api/admin/skills/import', { method: 'POST', body: fd })
      setImportResult(d)
      refresh()
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  // add/edit skill dialog
  const [skillDialog, setSkillDialog] = useState<{ mode: 'add' | 'edit'; skill?: SkillRow } | null>(null)
  const [skillForm, setSkillForm] = useState({ skillName: '', category: '', questionType: 'rating_1_4', hasNaOption: false })
  const [skillBusy, setSkillBusy] = useState(false)

  function openAddSkill(category?: string) {
    setSkillForm({ skillName: '', category: category ?? '', questionType: 'rating_1_4', hasNaOption: false })
    setSkillDialog({ mode: 'add' })
  }
  function openEditSkill(s: SkillRow) {
    setSkillForm({ skillName: s.skillName, category: s.category, questionType: s.questionType, hasNaOption: s.hasNaOption })
    setSkillDialog({ mode: 'edit', skill: s })
  }

  async function saveSkill() {
    if (!selTemplateId || !skillForm.skillName.trim() || !skillForm.category.trim()) {
      flash('', 'Skill name and category are required')
      return
    }
    setSkillBusy(true)
    try {
      if (skillDialog?.mode === 'edit' && skillDialog.skill) {
        await api(`/api/admin/skills/${skillDialog.skill.id}`, {
          method: 'PUT',
          body: JSON.stringify({
            skillName: skillForm.skillName.trim(),
            category: skillForm.category.trim(),
            questionType: skillForm.questionType,
            hasNaOption: skillForm.hasNaOption,
          }),
        })
        flash('Skill updated.')
      } else {
        await api('/api/admin/skills', {
          method: 'POST',
          body: JSON.stringify({
            templateId: selTemplateId,
            skillName: skillForm.skillName.trim(),
            category: skillForm.category.trim(),
            questionType: skillForm.questionType,
            hasNaOption: skillForm.hasNaOption,
          }),
        })
        flash('Skill added.')
      }
      setSkillDialog(null)
      // reload skills + template counts
      setSelTemplateId(null)
      setTimeout(() => setSelTemplateId(selTemplateId), 0)
      refresh()
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Save failed')
    } finally {
      setSkillBusy(false)
    }
  }

  async function deleteSkill(s: SkillRow) {
    if (!confirm(`Delete skill "${s.skillName}"?`)) return
    try {
      await api(`/api/admin/skills/${s.id}`, { method: 'DELETE' })
      setSkills((ss) => ss.filter((x) => x.id !== s.id))
      refresh()
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Delete failed')
    }
  }

  // add specialty dialog
  const [tplDialog, setTplDialog] = useState(false)
  const [tplForm, setTplForm] = useState({ profession: '', jobTitle: '', specialty: '' })
  const [tplBusy, setTplBusy] = useState(false)

  function openTemplateDialog() {
    setTplForm({ profession: selProfession || '', jobTitle: selJobTitle || '', specialty: '' })
    setTplDialog(true)
  }

  async function saveTemplate() {
    if (!tplForm.profession.trim() || !tplForm.jobTitle.trim() || !tplForm.specialty.trim()) {
      flash('', 'Profession, job title and specialty are all required')
      return
    }
    setTplBusy(true)
    try {
      await api('/api/admin/skills/templates', {
        method: 'POST',
        body: JSON.stringify({
          profession: tplForm.profession.trim(),
          jobTitle: tplForm.jobTitle.trim(),
          specialty: tplForm.specialty.trim(),
        }),
      })
      setTplDialog(false)
      setSelProfession(tplForm.profession.trim())
      setSelJobTitle(tplForm.jobTitle.trim())
      flash('Specialty template created.')
      refresh()
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Create failed')
    } finally {
      setTplBusy(false)
    }
  }

  // rename profession / job title dialog
  const [renameDialog, setRenameDialog] = useState<{ field: 'profession' | 'jobTitle'; from: string } | null>(null)
  const [renameTo, setRenameTo] = useState('')
  const [renameBusy, setRenameBusy] = useState(false)

  async function runRename() {
    if (!renameDialog) return
    setRenameBusy(true)
    try {
      const d = await api<{ updated: number }>('/api/admin/skills/rename-group', {
        method: 'POST',
        body: JSON.stringify({ field: renameDialog.field, from: renameDialog.from, to: renameTo.trim() }),
      })
      setRenameDialog(null)
      if (renameDialog.field === 'profession') setSelProfession(renameTo.trim())
      else setSelJobTitle(renameTo.trim())
      flash(`Renamed ${d.updated} template${d.updated === 1 ? '' : 's'}.`)
      refresh()
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Rename failed')
    } finally {
      setRenameBusy(false)
    }
  }

  async function deleteGroup(field: 'profession' | 'jobTitle', value: string, count: number) {
    if (!confirm(`Delete ${field === 'profession' ? 'profession' : 'job title'} "${value}" and all ${count} specialty templates under it? Sent checklists are not affected.`)) return
    try {
      await api('/api/admin/skills/delete-group', {
        method: 'POST',
        body: JSON.stringify({ field, value, confirm: true }),
      })
      if (field === 'profession') { setSelProfession(''); setSelJobTitle('') } else setSelJobTitle('')
      setSelTemplateId(null)
      flash('Deleted.')
      refresh()
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Delete failed')
    }
  }

  async function deleteAll() {
    const typed = prompt(`This deletes ALL ${totals?.skills ?? ''} skills and ${totals?.templates ?? ''} templates. Type DELETE to confirm:`)
    if (typed !== 'DELETE') return
    try {
      await api('/api/admin/skills/delete-all', { method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) })
      setSelProfession(''); setSelJobTitle(''); setSelTemplateId(null); setSkills([])
      flash('All skills data deleted.')
      refresh()
    } catch (e) {
      flash('', e instanceof Error ? e.message : 'Delete failed')
    }
  }

  // ─── render ───────────────────────────────────────────────────────
  if (loading) {
    return <div className="py-16 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] px-6 sm:px-7 py-5">
        <div className="flex items-start gap-3 flex-wrap">
          <div className="w-11 h-11 rounded-2xl bg-[#E9F5EC] border border-[#CBE8D6] flex items-center justify-center text-[#1F7A44] shrink-0">
            <Database className="w-5.5 h-5.5" />
          </div>
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-[17px] font-extrabold tracking-tight text-[#0f172a]">Skills data</h2>
            <p className="text-[12.5px] text-[#64748b] mt-0.5">
              {totals ? `${totals.professions} professions · ${totals.templates} specialty templates · ${totals.skills.toLocaleString()} skills` : ''}
              {' '}— every recruiter checklist is built from this library.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" size="sm" className="h-9 gap-1.5 font-bold" onClick={() => { setImportOpen(true); resetImport() }}>
              <Upload className="w-3.5 h-3.5" /> Import
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 font-bold" onClick={() => window.open('/api/admin/skills/export-data', '_blank')}>
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
            <Button variant="outline" size="sm" className="h-9 gap-1.5 font-bold border-[#F3B8BA] text-[#E5484D] hover:bg-[#FDEEEE]" onClick={deleteAll}>
              <Trash2 className="w-3.5 h-3.5" /> Delete all
            </Button>
          </div>
        </div>
        {(msg || errMsg) && (
          <div className={`mt-3.5 text-[12.5px] font-semibold border-l-[3px] rounded-md px-3.5 py-2.5 ${
            msg ? 'text-[#2E9E5B] bg-[#E9F5EC] border-[#34A853]' : 'text-[#E5484D] bg-[#FDEEEE] border-[#E5484D]'
          }`}>{msg || errMsg}</div>
        )}
        {error && (
          <div className="mt-3.5 text-[12.5px] font-semibold text-[#E5484D] bg-[#FDEEEE] border-l-[3px] border-[#E5484D] rounded-md px-3.5 py-2.5">{error}</div>
        )}
      </div>

      {/* Master-detail */}
      <div className="flex gap-4 items-start flex-col lg:flex-row">
        {/* Left: professions → job titles */}
        <div className="w-full lg:w-[340px] shrink-0 rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] overflow-hidden">
          <div className="px-4 py-3.5 border-b border-[#eef1f6] flex items-center justify-between gap-2">
            <h3 className="text-[13px] font-extrabold uppercase tracking-[0.6px] text-[#334155]">Professions</h3>
            <Button size="sm" variant="outline" className="h-7 w-7 p-0" title="Add specialty template" onClick={openTemplateDialog}>
              <Plus className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="px-3.5 py-2.5 border-b border-[#eef1f6] relative">
            <Search className="w-3.5 h-3.5 text-[#94a3b8] absolute left-[26px] top-1/2 -translate-y-1/2 pointer-events-none" />
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search job titles…" className="h-9 pl-8 text-[13px]" />
          </div>
          <div className="max-h-[520px] overflow-y-auto divide-y divide-[#eef1f6]">
            {professions.map((p) => {
              const open = selProfession === p
              const jtList = open ? visibleJobTitles : []
              const pTemplates = templates.filter((t) => t.profession === p)
              return (
                <div key={p}>
                  <button type="button"
                    onClick={() => { setSelProfession(open ? '' : p); setSelJobTitle(''); setSelTemplateId(null); setSearch('') }}
                    className={`w-full flex items-center gap-2 px-4 py-3 text-left cursor-pointer transition-colors ${
                      open ? 'bg-[#E9F5EC]' : 'hover:bg-[#f8fafc]'
                    }`}>
                    <ChevronRight className={`w-3.5 h-3.5 text-[#94a3b8] transition-transform ${open ? 'rotate-90' : ''}`} />
                    <span className="text-[13.5px] font-bold text-[#0f172a] flex-1">{p}</span>
                    <span className="text-[11px] font-bold text-[#94a3b8]">{pTemplates.length}</span>
                  </button>
                  {open && (
                    <div className="pb-2">
                      {jtList.length === 0 && (
                        <div className="px-4 py-2 text-[12px] text-[#94a3b8]">No matching job titles.</div>
                      )}
                      {jtList.map(([jt, count]) => (
                        <button key={jt} type="button"
                          onClick={() => { setSelJobTitle(jt); setSelTemplateId(null) }}
                          className={`w-full flex items-center gap-2 pl-9 pr-4 py-2 text-left cursor-pointer transition-colors ${
                            selJobTitle === jt ? 'bg-[#DDEFE3]' : 'hover:bg-[#f8fafc]'
                          }`}>
                          <span className={`text-[12.5px] font-semibold flex-1 truncate ${selJobTitle === jt ? 'text-[#3730a3]' : 'text-[#334155]'}`}>{jt}</span>
                          <span className="text-[10.5px] font-bold text-[#94a3b8]">{count.toLocaleString()} skills</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: specialties + skills */}
        <div className="flex-1 min-w-[280px] rounded-3xl border border-[#eef1f6] bg-white shadow-[0_12px_40px_rgba(15,23,42,0.08)] overflow-hidden">
          {!selProfession || !selJobTitle ? (
            <div className="px-6 py-16 text-center">
              <Database className="w-10 h-10 mx-auto text-[#CBE8D6] mb-3" />
              <h3 className="text-[15px] font-bold text-[#334155]">Select a job title</h3>
              <p className="text-[12.5px] text-[#94a3b8] mt-1 max-w-sm mx-auto">
                Choose a profession and job title from the left panel to view specialties and skills.
              </p>
            </div>
          ) : (
            <>
              {/* Job title header */}
              <div className="px-5 sm:px-6 py-4 border-b border-[#eef1f6] bg-gradient-to-b from-[#fbfcfe] to-[#f5f7fb]">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-1.5 text-[12.5px] text-[#64748b] mb-0.5">
                      <span>{selProfession}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                      <span className="font-bold text-[#0f172a]">{selJobTitle}</span>
                    </div>
                    <p className="text-[11.5px] text-[#94a3b8]">
                      {specialties.length} {specialties.length === 1 ? 'specialty' : 'specialties'} ·{' '}
                      {specialties.reduce((n, t) => n + t.skillCount, 0).toLocaleString()} skills
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] font-bold"
                      onClick={() => { setRenameDialog({ field: 'profession', from: selProfession }); setRenameTo(selProfession) }}>
                      <Pencil className="w-3.5 h-3.5" /> Rename profession
                    </Button>
                    <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px] font-bold border-[#F3B8BA] text-[#E5484D] hover:bg-[#FDEEEE]"
                      onClick={() => deleteGroup('jobTitle', selJobTitle, specialties.length)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete job title
                    </Button>
                    <Button size="sm" className="h-8 gap-1.5 text-[12px] font-bold" style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}
                      onClick={openTemplateDialog}>
                      <Plus className="w-3.5 h-3.5" /> Add specialty
                    </Button>
                  </div>
                </div>

                {/* Specialty chips */}
                <div className="flex flex-wrap gap-2 mt-3.5">
                  {specialties.map((t) => (
                    <button key={t.id} type="button"
                      onClick={() => setSelTemplateId(t.id === selTemplateId ? null : t.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full cursor-pointer transition-all border ${
                        selTemplateId === t.id
                          ? 'bg-[#DDEFE3] text-[#3730a3] border-[#9DDBB6]'
                          : 'bg-white text-[#334155] border-[#e2e8f0] hover:border-[#9DDBB6] hover:bg-[#E9F5EC]'
                      }`}>
                      <span className="text-[12.5px] font-bold">{t.specialty}</span>
                      <span className="text-[10px] font-bold bg-[#f1f5f9] border border-[#e2e8f0] rounded-full px-1.5 py-0.5 text-[#64748b]">{t.skillCount}</span>
                      {!t.isActive && (
                        <span className="text-[9.5px] font-bold uppercase bg-[#f1f5f9] text-[#94a3b8] rounded px-1.5 py-0.5">inactive</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Skills of selected specialty */}
              {!selTemplateId ? (
                <div className="px-6 py-10 text-center">
                  <div className="text-[13.5px] font-bold text-[#334155]">Pick a specialty above</div>
                  <p className="text-[12px] text-[#94a3b8] mt-1">Its categories and skills will appear here for editing.</p>
                </div>
              ) : skillsLoading ? (
                <div className="py-12 flex justify-center text-[#94a3b8]"><Loader2 className="w-6 h-6 animate-spin" /></div>
              ) : (
                <div className="px-5 sm:px-6 py-4">
                  <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
                    <div className="text-[12px] text-[#64748b]">
                      <strong className="text-[#0f172a]">{selTemplate?.specialty}</strong>
                      {' · '}{skills.length} skills · {byCategory.length} categories
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px] font-bold"
                        onClick={() => openAddSkill()}>
                        <Plus className="w-3.5 h-3.5" /> Add skill
                      </Button>
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-[12px] font-bold border-[#F3B8BA] text-[#E5484D] hover:bg-[#FDEEEE]"
                        onClick={async () => {
                          if (!confirm(`Delete the "${selTemplate?.specialty}" specialty template and its ${skills.length} skills?`)) return
                          try {
                            await api(`/api/admin/skills/templates/${selTemplateId}`, { method: 'DELETE' })
                            setSelTemplateId(null)
                            flash('Specialty deleted.')
                            refresh()
                          } catch (e) {
                            flash('', e instanceof Error ? e.message : 'Delete failed')
                          }
                        }}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete specialty
                      </Button>
                    </div>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-[#eef1f6] divide-y divide-[#eef1f6]">
                    {byCategory.map(([cat, list]) => (
                      <div key={cat} className="p-4">
                        <div className="flex items-center justify-between mb-2.5">
                          <div className="font-bold text-[12px] text-[#334155] uppercase tracking-wide">{cat}</div>
                          <button type="button" className="text-[11px] font-bold text-[#1F7A44] cursor-pointer"
                            onClick={() => openAddSkill(cat)}>
                            + add here
                          </button>
                        </div>
                        <div className="grid gap-1.5">
                          {list.map((s) => (
                            <div key={s.id} className="flex items-center gap-3 group">
                              <span className="text-[13px] text-[#0f172a] font-medium flex-1 min-w-0 truncate">{s.skillName}</span>
                              {s.questionType !== 'rating_1_4' && (
                                <span className="text-[9.5px] font-bold uppercase tracking-wide text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] rounded px-1.5 py-0.5">
                                  {s.questionType === 'yes_no' ? 'yes/no' : 'text'}
                                </span>
                              )}
                              {s.hasNaOption && (
                                <span className="text-[9.5px] font-bold text-[#64748b] bg-[#f1f5f9] border border-[#e2e8f0] rounded px-1.5 py-0.5">N/A</span>
                              )}
                              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button type="button" title="Edit skill" onClick={() => openEditSkill(s)}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#64748b] hover:bg-[#E9F5EC] hover:text-[#1F7A44] cursor-pointer">
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button type="button" title="Delete skill" onClick={() => deleteSkill(s)}
                                  className="w-6 h-6 rounded-md flex items-center justify-center text-[#64748b] hover:bg-[#FDEEEE] hover:text-[#E5484D] cursor-pointer">
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ═══ Import dialog ═══ */}
      <Dialog open={importOpen} onOpenChange={(o) => { setImportOpen(o); if (!o) resetImport() }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Import skills data</DialogTitle>
            <DialogDescription>
              Upload a <strong>.xlsx</strong> file with the columns <code className="bg-[#f1f5f9] rounded px-1 py-0.5 text-[11px]">Profession · Job Title · Specialty · Category · Skill Name · Question Type · Has N/A Option</code>.
              Duplicates are skipped; new specialties are created automatically.
            </DialogDescription>
          </DialogHeader>

          {importResult ? (
            <div className="space-y-3 py-2">
              <div className="flex items-center gap-2.5 text-[14px] font-bold text-[#2E9E5B] bg-[#E9F5EC] border border-[#a7f3d0] rounded-xl px-4 py-3">
                <Check className="w-5 h-5" /> Import complete
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#eaeef5] px-4 py-3 text-center">
                  <p className="text-[24px] font-extrabold text-[#2E9E5B] tabular-nums">{importResult.imported}</p>
                  <p className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-wide">imported</p>
                </div>
                <div className="rounded-2xl border border-[#eaeef5] px-4 py-3 text-center">
                  <p className="text-[24px] font-extrabold text-[#C77F0A] tabular-nums">{importResult.skipped}</p>
                  <p className="text-[11px] text-[#94a3b8] font-bold uppercase tracking-wide">skipped (duplicates)</p>
                </div>
              </div>
              <Button className="w-full font-bold" style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }} onClick={() => { setImportOpen(false); resetImport() }}>
                Done
              </Button>
            </div>
          ) : !validation ? (
            <div className="space-y-4 py-1">
              <div className="space-y-2">
                <Label>Upload file (.xlsx)</Label>
                <div className="flex items-center gap-3 flex-wrap">
                  <input ref={fileRef} type="file" accept=".xlsx"
                    onChange={(e) => { setImportFile(e.target.files?.[0] ?? null); setValidation(null) }}
                    className="flex-1 min-w-[200px] text-[13px] rounded-xl border border-[#d8dee9] px-3 py-2.5 file:mr-3 file:rounded-lg file:border-0 file:bg-[#E9F5EC] file:text-[#1E6B3C] file:font-bold file:px-3 file:py-1.5 file:cursor-pointer cursor-pointer" />
                  <Button variant="outline" size="sm" className="h-9 gap-1.5 font-bold"
                    onClick={() => window.open('/api/admin/skills/export-template', '_blank')}>
                    <FileSpreadsheet className="w-4 h-4" /> Download template
                  </Button>
                </div>
                {importFile && (
                  <p className="text-[12px] text-[#94a3b8]">Selected: {importFile.name} ({(importFile.size / 1024).toFixed(1)} KB)</p>
                )}
              </div>
              <Button className="w-full font-bold gap-2" disabled={!importFile || validating} onClick={validateFile}
                style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
                {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Validate file
              </Button>
            </div>
          ) : (
            <div className="space-y-3.5 py-1">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { v: validation.totalRows, l: 'total rows', c: 'text-[#0f172a]' },
                  { v: validation.validRows, l: 'valid rows', c: 'text-[#2E9E5B]' },
                  { v: validation.duplicates, l: 'duplicates', c: 'text-[#C77F0A]' },
                  { v: validation.errorRows, l: 'errors', c: 'text-[#E5484D]' },
                ].map((s) => (
                  <div key={s.l} className="rounded-2xl border border-[#eaeef5] px-3 py-2.5 text-center">
                    <p className={`text-[22px] font-extrabold tabular-nums ${s.c}`}>{s.v.toLocaleString()}</p>
                    <p className="text-[10px] text-[#94a3b8] font-bold uppercase tracking-wide">{s.l}</p>
                  </div>
                ))}
              </div>
              {validation.newTemplates > 0 && (
                <p className="text-[12.5px] text-[#64748b]">
                  <strong className="text-[#1F7A44]">{validation.newTemplates}</strong> new specialty template{validation.newTemplates === 1 ? '' : 's'} will be created.
                </p>
              )}
              {validation.errors.length > 0 && (
                <div className="max-h-32 overflow-y-auto border border-[#fecaca] rounded-xl p-2.5 space-y-1 bg-[#FDEEEE]">
                  {validation.errors.map((err, i) => (
                    <p key={i} className="text-[11.5px] text-[#C13A3E]"><AlertTriangle className="w-3 h-3 inline mr-1 -mt-0.5" />Row {err.row}: {err.message}</p>
                  ))}
                </div>
              )}
              {validation.validRows > 0 && (
                <Button className="w-full font-bold gap-2" disabled={importing} onClick={runImport}
                  style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {importing ? 'Importing…' : `Import ${validation.validRows.toLocaleString()} rows`}
                </Button>
              )}
              <Button variant="ghost" className="w-full text-[12.5px]" onClick={() => { setValidation(null); setImportFile(null); if (fileRef.current) fileRef.current.value = '' }}>
                Choose a different file
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ═══ Add/Edit skill dialog ═══ */}
      <Dialog open={!!skillDialog} onOpenChange={(o) => { if (!o) setSkillDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{skillDialog?.mode === 'edit' ? 'Edit skill' : 'Add skill'}</DialogTitle>
            <DialogDescription>
              {selTemplate ? `${selTemplate.profession} | ${selTemplate.jobTitle} | ${selTemplate.specialty}` : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Skill name</Label>
              <Input value={skillForm.skillName} onChange={(e) => setSkillForm((f) => ({ ...f, skillName: e.target.value }))}
                placeholder="e.g. Peripheral IV insertion" className="h-11 mt-1.5" maxLength={240} />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Category</Label>
              <Input value={skillForm.category} onChange={(e) => setSkillForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="e.g. Cardiac / Circulatory" className="h-11 mt-1.5" maxLength={120} />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Question type</Label>
              <select value={skillForm.questionType} onChange={(e) => setSkillForm((f) => ({ ...f, questionType: e.target.value }))}
                className="w-full h-11 mt-1.5 rounded-xl border border-[#d8dee9] bg-white px-3 text-[14px] cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#CBE8D6]">
                <option value="rating_1_4">Rating 1–4 (proficiency scale)</option>
                <option value="yes_no">Yes / No</option>
                <option value="text">Text answer</option>
              </select>
            </div>
            <div className="flex items-center gap-3.5 rounded-2xl border border-[#e2e8f0] bg-gradient-to-br from-[#f8fafc] to-[#f1f5f9] px-4 py-3">
              <Switch checked={skillForm.hasNaOption} onCheckedChange={(v) => setSkillForm((f) => ({ ...f, hasNaOption: v }))} />
              <div className="flex-1">
                <strong className="block text-[13.5px] font-bold text-[#0f172a]">Offer N/A option</strong>
                <span className="block text-[11.5px] text-[#64748b] mt-0.5">Candidates can mark the skill not applicable.</span>
              </div>
            </div>
            <Button className="w-full font-bold gap-2" disabled={skillBusy} onClick={saveSkill}
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
              {skillBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {skillDialog?.mode === 'edit' ? 'Save changes' : 'Add skill'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Add specialty dialog ═══ */}
      <Dialog open={tplDialog} onOpenChange={setTplDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add specialty template</DialogTitle>
            <DialogDescription>Creates an empty specialty you can fill with the import file or by adding skills.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Profession</Label>
              <Input value={tplForm.profession} onChange={(e) => setTplForm((f) => ({ ...f, profession: e.target.value }))}
                placeholder="e.g. Nursing" className="h-11 mt-1.5" maxLength={80} />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Job title</Label>
              <Input value={tplForm.jobTitle} onChange={(e) => setTplForm((f) => ({ ...f, jobTitle: e.target.value }))}
                placeholder="e.g. RN" className="h-11 mt-1.5" maxLength={120} />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Specialty</Label>
              <Input value={tplForm.specialty} onChange={(e) => setTplForm((f) => ({ ...f, specialty: e.target.value }))}
                placeholder="e.g. ICU" className="h-11 mt-1.5" maxLength={120} />
            </div>
            <Button className="w-full font-bold gap-2" disabled={tplBusy} onClick={saveTemplate}
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
              {tplBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create specialty
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ═══ Rename dialog ═══ */}
      <Dialog open={!!renameDialog} onOpenChange={(o) => { if (!o) setRenameDialog(null) }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Rename {renameDialog?.field === 'profession' ? 'profession' : 'job title'}</DialogTitle>
            <DialogDescription>
              Renames it across every specialty template that uses it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-1">
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">Current name</Label>
              <Input value={renameDialog?.from ?? ''} disabled className="h-11 mt-1.5 opacity-60" />
            </div>
            <div>
              <Label className="text-[10.5px] uppercase tracking-wider font-bold text-[#334155]">New name</Label>
              <Input value={renameTo} onChange={(e) => setRenameTo(e.target.value)} className="h-11 mt-1.5" maxLength={120} />
            </div>
            <Button className="w-full font-bold gap-2" disabled={renameBusy || !renameTo.trim()} onClick={runRename}
              style={{ background: 'linear-gradient(180deg,#2E9E5B,#1E6B3C)' }}>
              {renameBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Rename
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
