import { NextResponse } from 'next/server'
import { getPlatformSettings } from '@/lib/email'
import { getCurrentUser, isSuperadmin } from '@/lib/auth'

// GET /api/admin/email-status — live picture of the Brevo account behind the
// saved key: which account it is, its plan/quota, the verified senders, and
// whether the configured sender actually checks out. The API key itself is
// never returned. Answers "which account is being charged?" at a glance.

const FREE_MAIL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com', 'yahoo.com', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'outlook.com', 'live.com', 'msn.com', 'aol.com',
  'icloud.com', 'me.com', 'mac.com', 'proton.me', 'protonmail.com',
  'gmx.com', 'gmx.net', 'mail.com', 'zoho.com', 'yandex.com', 'yandex.ru',
  'qq.com', '163.com', '126.com', 'sina.com',
])

const BREVO_HEADERS = { accept: 'application/json' } as const

export async function GET() {
  const user = await getCurrentUser()
  if (!user || !isSuperadmin(user)) {
    return NextResponse.json({ error: 'Superadmin access required' }, { status: 403 })
  }

  const platform = await getPlatformSettings()
  const key = platform.brevoApiKey?.trim()
  const senderEmail = platform.brevoSenderEmail
  const base = {
    testMode: platform.emailTestMode,
    senderEmail,
    senderName: platform.brevoSenderName,
    senderDomain: senderEmail.split('@')[1]?.toLowerCase() ?? '',
  }

  if (!key) {
    return NextResponse.json({ ...base, authenticated: false, reason: 'no-key', senders: [] })
  }

  try {
    const [accResp, sendersResp] = await Promise.all([
      fetch('https://api.brevo.com/v3/account', {
        headers: { ...BREVO_HEADERS, 'api-key': key },
        signal: AbortSignal.timeout(10_000),
      }),
      fetch('https://api.brevo.com/v3/senders?limit=50', {
        headers: { ...BREVO_HEADERS, 'api-key': key },
        signal: AbortSignal.timeout(10_000),
      }),
    ])

    if (!accResp.ok) {
      const body = (await accResp.json().catch(() => ({}))) as { message?: string; code?: string }
      return NextResponse.json({
        ...base,
        authenticated: false,
        reason: 'rejected',
        error: body.message ?? body.code ?? `Brevo returned HTTP ${accResp.status}`,
        senders: [],
      })
    }

    const acc = (await accResp.json()) as {
      email?: string; firstName?: string; lastName?: string; companyName?: string
      plan?: Array<{ type?: string; credits?: number }>
    }
    const sendersBody = sendersResp.ok
      ? ((await sendersResp.json().catch(() => ({}))) as { senders?: Array<{ email?: string; name?: string; active?: boolean }> })
      : {}
    const senders = (sendersBody.senders ?? [])
      .filter((s) => typeof s.email === 'string')
      .map((s) => ({ email: String(s.email), name: s.name ?? '', active: !!s.active }))

    const senderVerified = senders.some(
      (s) => s.email.toLowerCase() === senderEmail.toLowerCase() && s.active,
    )
    const plan = acc.plan?.[0]

    return NextResponse.json({
      ...base,
      authenticated: true,
      account: {
        email: acc.email ?? '(unknown)',
        name: [acc.firstName, acc.lastName].filter(Boolean).join(' ') || undefined,
        company: acc.companyName || undefined,
        planType: plan?.type ?? 'unknown',
        planCredits: typeof plan?.credits === 'number' ? plan.credits : undefined,
      },
      senders,
      senderVerified,
      senderFreeMail: FREE_MAIL_DOMAINS.has(base.senderDomain),
    })
  } catch (e) {
    return NextResponse.json({
      ...base,
      authenticated: false,
      reason: 'network',
      error: e instanceof Error ? e.message : 'Could not reach Brevo',
      senders: [],
    })
  }
}
