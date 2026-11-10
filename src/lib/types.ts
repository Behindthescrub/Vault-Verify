// Shared client-side types.
export type AppUser = {
  id: string
  email: string
  name: string | null
  company: string | null
  role: string
}

export type UserSettings = {
  userId: string
  companyName: string | null
  companyLogoUrl: string | null
  gsaApiKey: string | null
  defaultOnboardingPct: number
  minW2: number
  otEnabled: boolean
}

export type ChecklistSummary = {
  id: string
  title: string
  templateLabel: string
  candidateName: string | null
  candidateEmail: string | null
  status: 'draft' | 'sent' | 'submitted'
  submittedVia: string | null
  avgRating: number | null
  hasResponse: boolean
  inviteSentAt: string | null
  createdAt: string
  skillCount: number
}

export type ChecklistDetail = {
  id: string
  title: string
  templateLabel: string
  candidateName: string | null
  candidateEmail: string | null
  status: 'draft' | 'sent' | 'submitted'
  submittedVia: string | null
  token: string
  items: { category: string; skills: { name: string; questionType: string; hasNaOption: boolean }[] }[]
  ratings: Record<string, number | 'na' | 'yes' | 'no' | string> | null
  lastPerformed: Record<string, '3m' | '6m' | '6m+' | 'na'> | null
  additional: { experienceYears: number | null; answers: Record<string, string> } | null
  avgRating: number | null
  signedName: string | null
  printedName: string | null
  validUntil: string | null
  completedAt: string | null
  inviteSentAt: string | null
  createdAt: string
}

export type SavedCalculation = {
  id: string
  name: string
  inputs: Record<string, unknown>
  results: Record<string, unknown>
  createdAt: string
}

export type PlatformSettingsView = {
  brevoApiKeyMasked: string
  brevoApiKeySet: boolean
  brevoSenderEmail: string
  brevoSenderName: string
  emailTestMode: boolean
  gsaApiKeyMasked: string
  gsaApiKeySet: boolean
}

// ─── Superadmin: platform-wide data ──────────────────────────────────

export type AdminOverview = {
  users: number
  checklists: number
  drafts: number
  sent: number
  submitted: number
  responses: number
  avgRating: number | null
  calculations: number
  emailsSent: number
  emailsTestMode: number
  emailsFailed: number
}

export type AdminRecentSignup = {
  id: string
  email: string
  company: string | null
  createdAt: string
}

export type AdminRecentSubmission = {
  id: string
  title: string
  candidateName: string | null
  templateLabel: string
  avgRating: number | null
  completedAt: string
  ownerEmail: string
}

export type AdminChecklistRow = {
  id: string
  title: string
  templateLabel: string
  candidateName: string | null
  candidateEmail: string | null
  status: 'draft' | 'sent' | 'submitted'
  submittedVia: string | null
  avgRating: number | null
  completedAt: string | null
  skillCount: number
  ownerEmail: string
  ownerCompany: string | null
  createdAt: string
  updatedAt: string
}

export type AdminChecklistDetail = ChecklistDetail & {
  ownerEmail: string
  ownerCompany: string | null
}

export type AdminCalculationRow = {
  id: string
  name: string
  ownerEmail: string
  billRate: number | null
  createdAt: string
}

export type AdminUserRow = {
  id: string
  email: string
  name: string | null
  company: string | null
  role: string
  createdAt: string
  checklistCount: number
  calculationCount: number
  activeSessions: number
}
