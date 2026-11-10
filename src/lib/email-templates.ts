// Transactional email templates — the content library the platform sends.
// Managed by the platform admin (Email tab): subject + HTML body per template,
// live preview, per-template test send, reset to default.
//
// Templates are stored in the EmailTemplate table; rows are created lazily
// from the DEFAULT_TEMPLATES below. Placeholders use {{var}} syntax.
//
// bodyHtml is the CONTENT ONLY (heading, copy, detail boxes, CTA) — the
// branded shell (logo lockup top, content box, company banner bottom) is
// applied at send time by buildEmailFrame, so the whole platform's email
// branding can be upgraded in one place.

import { db } from '@/lib/db'
import { sendEmail, type SendResult } from '@/lib/email'
import { VALIDITY_DAYS } from '@/lib/skills'
import { renderTemplate } from '@/lib/template-render'
import { buildEmailFrame, EMAIL_LOGO_PATH } from '@/lib/email-frame'

export { renderTemplate }

// ─── Shared content building blocks (inside the branded frame) ───────

const SANS = 'Arial,Helvetica,sans-serif'

const H = (title: string, sub?: string) => `
  <h1 style="margin:0 0 8px;font-family:${SANS};font-size:21px;line-height:1.3;font-weight:700;color:#0A2B23;letter-spacing:-0.2px">${title}</h1>
  ${sub ? `<p style="margin:0 0 20px;font-family:${SANS};font-size:13px;line-height:1.5;color:#8A9A94">${sub}</p>` : ''}`

const P = (html: string) => `
  <p style="margin:0 0 14px;font-family:${SANS};font-size:15px;line-height:1.65;color:#41504B">${html}</p>`

const SMALL = (html: string) => `
  <p style="margin:18px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:#8A9A94">${html}</p>`

const NOTE = (html: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0">
    <tr><td style="background-color:#F0F7F4;border-left:4px solid #2E9E5B;border-radius:0 10px 10px 0;padding:13px 16px;font-family:${SANS};font-size:13.5px;line-height:1.6;color:#41504B">${html}</td></tr>
  </table>`

const INFO = (rows: Array<[string, string]>) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:18px 0;background-color:#F6FAF8;border:1px solid #DCE9E2;border-radius:12px">
    <tr><td style="padding:4px 18px 8px">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        ${rows.map(([label, value], i) => `
        <tr>
          <td style="padding:${i === 0 ? 10 : 9}px 0;${i > 0 ? 'border-top:1px solid #E4EEEA;' : ''}font-family:${SANS};font-size:13px;line-height:1.4;color:#5B6B66">${label}</td>
          <td align="right" style="padding:${i === 0 ? 10 : 9}px 0;${i > 0 ? 'border-top:1px solid #E4EEEA;' : ''}font-family:${SANS};font-size:13.5px;line-height:1.4;font-weight:700;color:#0A2B23">${value}</td>
        </tr>`).join('')}
      </table>
    </td></tr>
  </table>`

const CTA = (label: string) => `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 10px">
    <tr><td align="center">
      <a href="{{link}}" style="display:inline-block;background-color:#1F7A44;background-image:linear-gradient(180deg,#2E9E5B 0%,#1E6B3C 100%);color:#FFFFFF;text-decoration:none;font-family:${SANS};font-weight:700;font-size:15px;padding:14px 34px;border-radius:10px;border-bottom:2px solid #175A33">${label}</a>
    </td></tr>
  </table>
  <p style="margin:0;text-align:center;font-family:${SANS};font-size:11.5px;line-height:1.6;color:#8A9A94">
    Button not working? <a href="{{link}}" style="color:#1F7A44;word-break:break-all">open this link</a> in your browser.
  </p>`

// ─── The template set ────────────────────────────────────────────────

export type TemplateKey =
  | 'candidate_invite'
  | 'candidate_reminder'
  | 'candidate_confirmation'
  | 'recruiter_results'
  | 'recruiter_welcome'
  | 'platform_test'

export type TemplateDef = {
  key: TemplateKey
  name: string
  description: string
  purpose: string // email-log purpose
  automated: boolean // true = fired by the system; false = sent on demand
  subject: string
  preheader: string // hidden inbox preview text (frame-level, not stored in DB)
  bodyHtml: string
  sampleVars: Record<string, string>
}

export const DEFAULT_TEMPLATES: TemplateDef[] = [
  {
    key: 'candidate_invite',
    name: 'Candidate invitation',
    description: 'Sent to a candidate when a recruiter invites them to complete a skills checklist.',
    purpose: 'invite',
    automated: false,
    subject: 'Skills Checklist invitation — {{checklist_title}}',
    preheader: '{{candidate_name}}, your {{checklist_title}} skills checklist is ready — about 10–15 minutes.',
    bodyHtml: `
      ${H('Skills Checklist invitation', 'from {{recruiter_name}}{{company_suffix}}')}
      ${P('Hello{{candidate_name_suffix}},')}
      {{personal_message}}
      ${P('Please complete the <strong style="color:#0A2B23">{{checklist_title}}</strong> skills checklist — {{skill_count}} skills, about 10–15 minutes.')}
      ${P(`You'll rate each skill from 1 (no experience) to 4 (expert), tell us when you last performed it,
        and sign a short attestation that the ratings are your own. No account or password needed.`)}
      ${NOTE(`<strong style="color:#1E6B3C">Honesty first:</strong> this is a self-assessment, clearly labeled as such.
        Rate what you have actually done — your recruiter values accuracy over inflated numbers.`)}
      ${CTA('Open the checklist')}
      ${SMALL('Completed checklists are valid for {{valid_days}} days.')}`,
    sampleVars: {
      candidate_name: 'Jordan Rivera',
      candidate_name_suffix: ' Jordan',
      checklist_title: 'RN — ICU',
      skill_count: '45',
      recruiter_name: 'Alex Morgan',
      company: 'MedStaff Talent',
      company_suffix: ' · MedStaff Talent',
      link: 'https://your-app.example.com/?c=sample-token',
      personal_message:
        '<p style="color:#334155">We have a travel ICU position opening next month — this checklist is the first step.</p>',
      valid_days: '30',
      sender_name: 'VaultVerify',
      sender_email: 'noreply@yourdomain.com',
    },
  },
  {
    key: 'candidate_reminder',
    name: 'Candidate reminder',
    description: 'Sent when a recruiter re-invites a candidate whose checklist is still pending.',
    purpose: 'reminder',
    automated: false,
    subject: 'Reminder: {{checklist_title}} skills checklist is waiting',
    preheader: 'Reminder — your {{checklist_title}} skills checklist is still waiting for you.',
    bodyHtml: `
      ${H('Friendly reminder', '{{checklist_title}} · still pending')}
      ${P('Hello{{candidate_name_suffix}},')}
      {{personal_message}}
      ${P('The <strong style="color:#0A2B23">{{checklist_title}}</strong> skills checklist from {{recruiter_name}}{{company_suffix}} is still waiting for you — {{skill_count}} skills, about 10–15 minutes.')}
      ${P('Your ratings help your recruiter match you to the right position, so accuracy matters more than perfection.')}
      ${CTA('Complete the checklist')}
      ${SMALL('Already completed it? You can ignore this reminder — checklists stay valid for {{valid_days}} days after submission.')}`,
    sampleVars: {
      candidate_name: 'Jordan Rivera',
      candidate_name_suffix: ' Jordan',
      checklist_title: 'RN — ICU',
      skill_count: '45',
      recruiter_name: 'Alex Morgan',
      company: 'MedStaff Talent',
      company_suffix: ' · MedStaff Talent',
      link: 'https://your-app.example.com/?c=sample-token',
      personal_message: '',
      valid_days: '30',
      sender_name: 'VaultVerify',
      sender_email: 'noreply@yourdomain.com',
    },
  },
  {
    key: 'candidate_confirmation',
    name: 'Submission confirmation (candidate)',
    description: 'Automatically sent to the candidate right after they submit their checklist.',
    purpose: 'confirmation',
    automated: true,
    subject: 'Received — your {{checklist_title}} skills checklist',
    preheader: 'Got it — your {{checklist_title}} skills checklist has been received.',
    bodyHtml: `
      ${H('Checklist received', 'submitted {{completed_at}}')}
      ${P('Hello{{candidate_name_suffix}},')}
      ${P('Thank you — your <strong style="color:#0A2B23">{{checklist_title}}</strong> skills checklist ({{skill_count}} skills) has been submitted to {{recruiter_name}}{{company_suffix}}.')}
      ${INFO([
        ['Average self-rating', '<span style="color:#1E7A5A">{{avg_rating}} / 4.0</span>'],
        ['Valid until', '{{valid_until}}'],
      ])}
      ${SMALL(`A copy with your e-signature ({{signed_name}}) is on file with your recruiter.
        No further action is needed — if they have questions, they'll reach out directly.`)}`,
    sampleVars: {
      candidate_name: 'Jordan Rivera',
      candidate_name_suffix: ' Jordan',
      checklist_title: 'RN — ICU',
      skill_count: '45',
      recruiter_name: 'Alex Morgan',
      company: 'MedStaff Talent',
      company_suffix: ' · MedStaff Talent',
      completed_at: 'Nov 11, 2026, 2:40 PM',
      avg_rating: '3.4',
      valid_until: 'Dec 11, 2026',
      signed_name: 'Jordan Rivera',
      valid_days: '30',
      sender_name: 'VaultVerify',
      sender_email: 'noreply@yourdomain.com',
    },
  },
  {
    key: 'recruiter_results',
    name: 'Results notification (recruiter)',
    description: 'Automatically sent to the checklist owner when a candidate submits their responses.',
    purpose: 'results',
    automated: true,
    subject: '✅ {{candidate_name}} completed {{checklist_title}}',
    preheader: '{{candidate_name}} completed the {{checklist_title}} checklist — average {{avg_rating}} / 4.0.',
    bodyHtml: `
      ${H('Checklist completed', 'by {{candidate_name}}')}
      ${P('Hi{{recruiter_name_suffix}},')}
      ${P('<strong style="color:#0A2B23">{{candidate_name}}</strong> has submitted the <strong style="color:#0A2B23">{{checklist_title}}</strong> skills checklist ({{skill_count}} skills).')}
      ${INFO([
        ['Average rating', '<span style="color:#1E7A5A">{{avg_rating}} / 4.0</span>'],
        ['Self-reported experience', '{{experience_years}}'],
        ['Valid until', '{{valid_until}}'],
      ])}
      ${P('Open the results to see the full breakdown — rating mix, recency per skill and the signed attestation — then export the branded PDF.')}
      ${CTA('View results & export PDF')}`,
    sampleVars: {
      recruiter_name: 'Alex Morgan',
      recruiter_name_suffix: ' Alex',
      candidate_name: 'Jordan Rivera',
      checklist_title: 'RN — ICU',
      skill_count: '45',
      experience_years: '7 years',
      avg_rating: '3.4',
      valid_until: 'Dec 11, 2026',
      link: 'https://your-app.example.com/',
      valid_days: '30',
      sender_name: 'VaultVerify',
      sender_email: 'noreply@yourdomain.com',
    },
  },
  {
    key: 'recruiter_welcome',
    name: 'Welcome (new recruiter)',
    description: 'Automatically sent when a new recruiter account is created.',
    purpose: 'welcome',
    automated: true,
    subject: 'Welcome to VaultVerify — your account is ready',
    preheader: 'Your VaultVerify account is ready — skills checklists + bill-to-pay calculator.',
    bodyHtml: `
      ${H('Welcome aboard', 'your VaultVerify account is ready')}
      ${P('Hi{{name_suffix}},')}
      ${P('Your VaultVerify account{{company_suffix}} is ready. Two tools, one login:')}
      ${NOTE(`<strong style="color:#1E6B3C">1 · Skills Checklists</strong><br>
        Pick from 315 profession-specific templates, send a candidate their link,
        and get back a signed, dated self-assessment — exportable as a branded PDF.`)}
      ${NOTE(`<strong style="color:#1E6B3C">2 · Bill-to-Pay Calculator</strong><br>
        Bill rate → pay package with overtime, onboarding burden, worker's comp and live GSA per-diem
        for travelers. Every run is saved and reloadable.`)}
      ${CTA('Open VaultVerify')}
      ${SMALL('This account was created with {{account_email}}. If this wasn\'t you, just ignore this email.')}`,
    sampleVars: {
      name: 'Alex Morgan',
      name_suffix: ' Alex',
      company: 'MedStaff Talent',
      company_suffix: ' (MedStaff Talent)',
      account_email: 'alex@medstafftalent.com',
      link: 'https://your-app.example.com/',
      valid_days: '30',
      sender_name: 'VaultVerify',
      sender_email: 'noreply@yourdomain.com',
    },
  },
  {
    key: 'platform_test',
    name: 'Platform test email',
    description: 'Sent by the "Send test email" buttons to verify email delivery.',
    purpose: 'test',
    automated: false,
    subject: 'VaultVerify — test email',
    preheader: 'VaultVerify delivery test — {{mode}} mode.',
    bodyHtml: `
      ${H('Test email', 'delivery verification · VaultVerify platform')}
      ${P('This is a test email from <strong style="color:#0A2B23">VaultVerify</strong>. If you can read this, transactional email delivery is working end-to-end.')}
      ${INFO([
        ['Mode', '<span style="color:#1E7A5A">{{mode}}</span>'],
        ['Sender', '{{sender_name}} &lt;{{sender_email}}&gt;'],
        ['Template', '{{template_name}}'],
        ['Sent', '{{sent_at}}'],
      ])}
      ${P('Questions or delivery problems? Check the send log in the platform console — every attempt is recorded there with its status.')}`,
    sampleVars: {
      mode: 'LIVE',
      sender_name: 'VaultVerify',
      sender_email: 'noreply@yourdomain.com',
      template_name: 'Platform test email',
      sent_at: 'Nov 11, 2026, 3:05 PM',
      valid_days: '30',
    },
  },
]

export function getTemplateDef(key: string): TemplateDef | undefined {
  return DEFAULT_TEMPLATES.find((t) => t.key === key)
}

// ─── DB access ───────────────────────────────────────────────────────

/** Load a template from the DB; lazily create the row from the code default. */
export async function getEmailTemplate(key: TemplateKey) {
  const def = getTemplateDef(key)!
  let row = await db.emailTemplate.findUnique({ where: { key } })
  if (!row) {
    row = await db.emailTemplate.create({
      data: { key, subject: def.subject, bodyHtml: def.bodyHtml, isActive: true },
    })
  }
  return { row, def }
}

// ─── Sending ─────────────────────────────────────────────────────────

export type TemplateSendArgs = {
  key: TemplateKey
  to: string
  toName?: string
  vars: Record<string, string>
  rawKeys?: string[]
  /** on-demand templates (invite/reminder/test) always send; automated ones respect isActive */
  force?: boolean
  /** app origin, e.g. https://app.example.com — powers the header logo + banner link */
  origin?: string
}

function normalizeOrigin(origin?: string): string {
  if (!origin) return ''
  return origin.trim().replace(/\/+$/, '')
}

/** Render + send a DB template (content) wrapped in the branded frame.
 *  Returns null when skipped (disabled). Real sends NEVER fall back to
 *  sampleVars — only the universal vars (sender identity, validity window,
 *  app URL) are injected automatically. */
export async function sendTemplateEmail(args: TemplateSendArgs): Promise<SendResult | null> {
  const { row, def } = await getEmailTemplate(args.key)
  if (!args.force && !row.isActive) return null

  const platform = await db.platformSetting.findUnique({ where: { id: 'main' } })
  const origin = normalizeOrigin(args.origin)
  const universal = {
    sender_name: platform?.brevoSenderName || 'VaultVerify',
    sender_email: platform?.brevoSenderEmail || '',
    valid_days: String(VALIDITY_DAYS),
    app_url: origin,
  }
  const vars = { ...universal, ...args.vars }
  const subject = renderTemplate(row.subject, vars, args.rawKeys)
  const content = renderTemplate(row.bodyHtml, vars, args.rawKeys)
  const html = buildEmailFrame(content, {
    logoUrl: origin ? `${origin}${EMAIL_LOGO_PATH}` : undefined,
    appUrl: origin || undefined,
    senderName: vars.sender_name,
    validDays: vars.valid_days,
    preheader: renderTemplate(def.preheader, vars, args.rawKeys),
  })

  return sendEmail({
    to: args.to,
    toName: args.toName,
    subject,
    html,
    purpose: def.purpose,
  })
}
