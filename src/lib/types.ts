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
  templateKey: string
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
  templateKey: string
  templateLabel: string
  candidateName: string | null
  candidateEmail: string | null
  status: 'draft' | 'sent' | 'submitted'
  submittedVia: string | null
  token: string
  items: { category: string; skills: string[] }[]
  ratings: Record<string, number> | null
  avgRating: number | null
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
