// Brevo transactional email — API key is managed in the superadmin panel
// (PlatformSetting), not env vars. Test mode logs sends without delivering.
import { db } from '@/lib/db'
import { readPlatformBackup } from '@/lib/platform-backup'

export async function getPlatformSettings() {
  let s = await db.platformSetting.findUnique({ where: { id: 'main' } })
  if (!s) {
    // The dev sandbox can re-provision the SQLite file empty; restore the
    // previously saved keys/sender from the git-ignored backup file so the
    // platform keeps working without re-entering secrets.
    const backup = readPlatformBackup()
    s = await db.platformSetting.create({
      data: backup
        ? {
            id: 'main',
            brevoApiKey: backup.brevoApiKey ?? undefined,
            brevoSenderEmail: backup.brevoSenderEmail ?? undefined,
            brevoSenderName: backup.brevoSenderName ?? undefined,
            emailTestMode: backup.emailTestMode ?? undefined,
            gsaApiKey: backup.gsaApiKey ?? undefined,
          }
        : { id: 'main' },
    })
  }
  return s
}

type SendArgs = {
  to: string
  toName?: string
  subject: string
  html: string
  purpose: string
}

export type SendResult = {
  ok: boolean
  status: 'sent' | 'failed' | 'test-mode'
  error?: string
  /** Brevo messageId — set when the API accepted the email (HTTP 2xx). */
  messageId?: string
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const platform = await getPlatformSettings()
  const key = platform.brevoApiKey?.trim()

  // Test mode / missing key: log only, never pretend the email was delivered.
  if (platform.emailTestMode || !key) {
    await db.emailLog.create({
      data: {
        toEmail: args.to,
        subject: args.subject,
        purpose: args.purpose,
        status: 'test-mode',
      },
    })
    return { ok: true, status: 'test-mode' }
  }

  try {
    const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'content-type': 'application/json',
        'api-key': key,
      },
      body: JSON.stringify({
        sender: { email: platform.brevoSenderEmail, name: platform.brevoSenderName },
        to: [{ email: args.to, ...(args.toName ? { name: args.toName } : {}) }],
        subject: args.subject,
        htmlContent: args.html,
      }),
    })
    const body = await resp.json().catch(() => ({}))
    if (!resp.ok) {
      const err = typeof body === 'object' && body && 'message' in body
        ? String((body as { message?: string }).message)
        : `HTTP ${resp.status}`
      await db.emailLog.create({
        data: { toEmail: args.to, subject: args.subject, purpose: args.purpose, status: 'failed', error: err },
      })
      return { ok: false, status: 'failed', error: err }
    }
    const messageId = typeof body === 'object' && body && 'messageId' in body
      ? String((body as { messageId?: string }).messageId)
      : undefined
    await db.emailLog.create({
      data: { toEmail: args.to, subject: args.subject, purpose: args.purpose, status: 'sent', providerMessageId: messageId },
    })
    return { ok: true, status: 'sent', messageId }
  } catch (e) {
    const err = e instanceof Error ? e.message : 'unknown error'
    await db.emailLog.create({
      data: { toEmail: args.to, subject: args.subject, purpose: args.purpose, status: 'failed', error: err },
    })
    return { ok: false, status: 'failed', error: err }
  }
}
