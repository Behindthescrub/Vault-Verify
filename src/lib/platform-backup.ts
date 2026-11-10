// Server-only. Snapshots the PlatformSetting row (API keys included) to a
// git-ignored JSON file next to the SQLite database.
//
// Why: the dev sandbox can re-provision the database file empty between
// sessions. When that happens, getPlatformSettings() lazily re-creates the
// row from this file, so the saved email/GSA keys and sender identity
// survive — the superadmin only ever pastes a key once. On read-only hosts
// (Vercel serverless) every operation degrades to a no-op: the production
// database is the source of truth there and is never re-provisioned.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'

const DIR = join(process.cwd(), 'db')
const FILE = join(DIR, 'platform-backup.json')

export type PlatformBackup = {
  brevoApiKey?: string | null
  brevoSenderEmail?: string
  brevoSenderName?: string
  emailTestMode?: boolean
  gsaApiKey?: string | null
}

export function readPlatformBackup(): PlatformBackup | null {
  try {
    if (!existsSync(FILE)) return null
    const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as PlatformBackup
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function writePlatformBackup(b: PlatformBackup): void {
  try {
    mkdirSync(DIR, { recursive: true })
    writeFileSync(FILE, JSON.stringify(b, null, 2) + '\n')
  } catch {
    // Read-only filesystem (production serverless) — nothing to do there.
  }
}
