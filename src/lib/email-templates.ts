// SMTP email templates — the full branded set the platform sends.
// Managed by the platform admin (Email tab): subject + HTML body per template,
// live preview, per-template test send, reset to default.
//
// Templates are stored in the EmailTemplate table; rows are created lazily
// from the DEFAULT_TEMPLATES below. Placeholders use {{var}} syntax.

import { db } from '@/lib/db'
import { sendEmail, type SendResult } from '@/lib/email'
import { VALIDITY_DAYS } from '@/lib/skills'
import { renderTemplate } from '@/lib/template-render'

export { renderTemplate }

// ─── Shared branded building blocks ──────────────────────────────────

const LOGO = `
  <div style="font-size:21px;font-weight:700;letter-spacing:0.4px;color:#fff;font-family:Arial,Helvetica,sans-serif">
    Vault<span style="color:#8BC34A">Verify</span>
  </div>`

const FOOTER = `
  <div style="background:#EDF6F1;padding:16px 28px;font-size:11.5px;color:#5B6B66;line-height:1.7;font-family:Arial,Helvetica,sans-serif">
    <strong style="color:#1E6B3C">VaultVerify</strong> · Skills verification for healthcare staffing<br>
    Self-assessed — not independently verified · Checklists are valid {{valid_days}} days after completion<br>
    Sent by {{sender_name}} &lt;{{sender_email}}&gt;
  </div>`

const CTA = (label: string) => `
  <p style="text-align:center;margin:28px 0 10px">
    <a href="{{link}}" style="background:#1F7A44;background-image:linear-gradient(180deg,#2E9E5B,#1E6B3C);color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:14px 32px;border-radius:10px;display:inline-block;font-family:Arial,Helvetica,sans-serif">${label}</a>
  </p>
  <p style="font-size:12px;color:#94a3b8;font-family:Arial,Helvetica,sans-serif">
    If the button doesn't work, paste this link into your browser:<br>
    <a href="{{link}}" style="color:#1F7A44;word-break:break-all">{{link}}</a>
  </p>`

function card(title: string, sub: string, body: string, footer = FOOTER): string {
  return `
  <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a">
    <div style="background:#0A2B23;background-image:linear-gradient(135deg,#0A2B23,#0E3B32);border-radius:16px 16px 0 0;padding:24px 28px;color:#fff">
      ${LOGO}
      <div style="height:4px;width:64px;background:#8BC34A;border-radius:2px;margin:10px 0 14px"></div>
      <h2 style="margin:0;font-size:18px;font-weight:700;color:#fff">${title}</h2>
      ${sub ? `<p style="margin:6px 0 0;color:#A8CFB8;font-size:13px">${sub}</p>` : ''}
    </div>
    <div style="background:#fff;border:1px solid #e2e8f0;border-top:0;padding:26px 28px;font-size:14px;color:#475569;line-height:1.65;font-family:Arial,Helvetica,sans-serif">
      ${body}
    </div>
    ${footer}
  </div>`
}

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
    bodyHtml: card(
      'Skills Checklist Invitation',
      'from {{recruiter_name}}{{company_suffix}}',
      `
      <p style="font-size:15px;color:#0f172a">Hello{{candidate_name_suffix}},</p>
      {{personal_message}}
      <p>
        Please complete the <strong style="color:#0f172a">{{checklist_title}}</strong> skills checklist
        — {{skill_count}} skills, about 10–15 minutes.
      </p>
      <p>
        You'll rate each skill from 1 (no experience) to 4 (expert), tell us when you last performed it,
        and sign a short attestation that the ratings are your own. No account or password needed.
      </p>
      <p style="background:#EDF6F1;border-left:4px solid #2E9E5B;border-radius:0 8px 8px 0;padding:12px 14px;margin:20px 0">
        <strong style="color:#1E6B3C">Honesty first:</strong> this is a self-assessment, clearly labeled as such.
        Rate what you have actually done — your recruiter values accuracy over inflated numbers.
      </p>
      ${CTA('Open the checklist')}
      <p style="font-size:12px;color:#94a3b8;margin-top:18px">
        Completed checklists are valid for {{valid_days}} days.
      </p>`,
    ),
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
    bodyHtml: card(
      'Friendly Reminder',
      '{{checklist_title}} · still pending',
      `
      <p style="font-size:15px;color:#0f172a">Hello{{candidate_name_suffix}},</p>
      {{personal_message}}
      <p>
        The <strong style="color:#0f172a">{{checklist_title}}</strong> skills checklist from
        {{recruiter_name}}{{company_suffix}} is still waiting for you — {{skill_count}} skills, about 10–15 minutes.
      </p>
      <p>Your ratings help your recruiter match you to the right position, so accuracy matters more than perfection.</p>
      ${CTA('Complete the checklist')}
      <p style="font-size:12px;color:#94a3b8;margin-top:18px">
        Already completed it? You can ignore this reminder — checklists are valid {{valid_days}} days after submission.
      </p>`,
    ),
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
    bodyHtml: card(
      'Checklist Received',
      'submitted {{completed_at}}',
      `
      <p style="font-size:15px;color:#0f172a">Hello{{candidate_name_suffix}},</p>
      <p>
        Thank you — your <strong style="color:#0f172a">{{checklist_title}}</strong> skills checklist
        ({{skill_count}} skills) has been submitted to {{recruiter_name}}{{company_suffix}}.
      </p>
      <p>Here's your summary:</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:14px 0">
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Average self-rating</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#1E6B3C">{{avg_rating}} / 4.0</strong></td>
        </tr>
        <tr><td style="height:8px"></td></tr>
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Valid until</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#0f172a">{{valid_until}}</strong></td>
        </tr>
      </table>
      <p style="font-size:12.5px;color:#94a3b8">
        A copy with your e-signature ({{signed_name}}) is on file with your recruiter.
        No further action is needed — if they have questions, they'll reach out directly.
      </p>`,
    ),
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
    bodyHtml: card(
      'Checklist Completed',
      'by {{candidate_name}}',
      `
      <p style="font-size:15px;color:#0f172a">Hi{{recruiter_name_suffix}},</p>
      <p>
        <strong style="color:#0f172a">{{candidate_name}}</strong> has submitted the
        <strong style="color:#0f172a">{{checklist_title}}</strong> skills checklist ({{skill_count}} skills).
      </p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:14px 0">
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Average rating</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#1E6B3C">{{avg_rating}} / 4.0</strong></td>
        </tr>
        <tr><td style="height:8px"></td></tr>
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Self-reported experience</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#0f172a">{{experience_years}}</strong></td>
        </tr>
        <tr><td style="height:8px"></td></tr>
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Valid until</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#0f172a">{{valid_until}}</strong></td>
        </tr>
      </table>
      <p>Open the results to see the full breakdown: rating mix, recency per skill and the signed attestation — then export the branded PDF.</p>
      ${CTA('View results & export PDF')}`,
    ),
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
    bodyHtml: card(
      'Welcome aboard',
      'your recruiter account is ready',
      `
      <p style="font-size:15px;color:#0f172a">Hi{{name_suffix}},</p>
      <p>
        Your VaultVerify account{{company_suffix}} is ready. Two tools, one login:
      </p>
      <p style="background:#EDF6F1;border-left:4px solid #2E9E5B;border-radius:0 8px 8px 0;padding:12px 16px;margin:18px 0">
        <strong style="color:#1E6B3C">1 · Skills Checklists</strong><br>
        Pick from 315 profession-specific templates, send a candidate their link,
        and get back a signed, dated self-assessment — exportable as a branded PDF.
      </p>
      <p style="background:#EDF6F1;border-left:4px solid #2E9E5B;border-radius:0 8px 8px 0;padding:12px 16px;margin:18px 0">
        <strong style="color:#1E6B3C">2 · Bill-to-Pay Calculator</strong><br>
        Bill rate → pay package with overtime, onboarding burden, worker's comp and live GSA per-diem
        for travelers. Every run is saved and reloadable.
      </p>
      ${CTA('Open VaultVerify')}
      <p style="font-size:12.5px;color:#94a3b8;margin-top:18px">
        This account was created with {{account_email}}. If this wasn't you, just ignore this email.
      </p>`,
    ),
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
    bodyHtml: card(
      'Test email',
      'from the VaultVerify platform',
      `
      <p>This is a test email from <strong style="color:#0f172a">VaultVerify</strong>.</p>
      <p>If you can read this, transactional email delivery is working end-to-end:</p>
      <table role="presentation" style="width:100%;border-collapse:collapse;margin:14px 0">
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Mode</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#1E6B3C">{{mode}}</strong></td>
        </tr>
        <tr><td style="height:8px"></td></tr>
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Sender</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#0f172a">{{sender_name}} &lt;{{sender_email}}&gt;</strong></td>
        </tr>
        <tr><td style="height:8px"></td></tr>
        <tr>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:8px 0 0 8px;color:#475569">Template</td>
          <td style="padding:10px 14px;background:#F6FAF8;border:1px solid #DCE9E2;border-radius:0 8px 8px 0"><strong style="color:#0f172a">{{template_name}}</strong></td>
        </tr>
      </table>
      <p style="font-size:12.5px;color:#94a3b8">Sent {{sent_at}}.</p>`,
    ),
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
}

/** Render + send a DB template. Returns null when skipped (disabled).
 *  Real sends NEVER fall back to sampleVars — only the universal vars
 *  (sender identity, validity window) are injected automatically. */
export async function sendTemplateEmail(args: TemplateSendArgs): Promise<SendResult | null> {
  const { row, def } = await getEmailTemplate(args.key)
  if (!args.force && !row.isActive) return null

  const platform = await db.platformSetting.findUnique({ where: { id: 'main' } })
  const universal = {
    sender_name: platform?.brevoSenderName || 'VaultVerify',
    sender_email: platform?.brevoSenderEmail || '',
    valid_days: String(VALIDITY_DAYS),
  }
  const vars = { ...universal, ...args.vars }
  const subject = renderTemplate(row.subject, vars, args.rawKeys)
  const html = renderTemplate(row.bodyHtml, vars, args.rawKeys)

  return sendEmail({
    to: args.to,
    toName: args.toName,
    subject,
    html,
    purpose: def.purpose,
  })
}
