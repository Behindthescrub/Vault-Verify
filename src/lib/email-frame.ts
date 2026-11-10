// The branded VaultVerify email frame — the shell every transactional email
// shares: the logo lockup at the top, the content box in the middle, and the
// company banner at the bottom.
//
// Pure module (no DB / server imports) so the send pipeline (server) and the
// admin live preview (client) render byte-identical emails.

export const EMAIL_APP_NAME = 'VaultVerify'
export const EMAIL_TAGLINE = 'Skills verification for healthcare staffing'
export const EMAIL_LOGO_PATH = '/vaultverify-logo.png'

export type EmailFrameVars = {
  /** Absolute URL of the emblem PNG; empty → text-only lockup. */
  logoUrl?: string
  /** Absolute URL of the platform — powers the banner link. */
  appUrl?: string
  /** Sender display name for the legal line. */
  senderName?: string
  /** Checklist validity window in days. */
  validDays?: string
  /** Hidden inbox preview text (preheader). */
  preheader?: string
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SANS = 'Arial,Helvetica,sans-serif'

/** Build the full HTML document for one transactional email. */
export function buildEmailFrame(contentHtml: string, vars: EmailFrameVars = {}): string {
  const year = new Date().getFullYear()

  const logo = vars.logoUrl
    ? `<img src="${esc(vars.logoUrl)}" width="46" height="46" alt="${EMAIL_APP_NAME}" style="display:block;width:46px;height:46px;margin:0 auto 12px;border:0;outline:none;text-decoration:none">`
    : ''

  const bannerLink = vars.appUrl
    ? `<div style="margin-top:14px;font-family:${SANS};font-size:12.5px;font-weight:700">
        <a href="${esc(vars.appUrl)}" style="color:#8BC34A;text-decoration:none">Open the platform &rarr;</a>
      </div>`
    : ''

  const preheader = vars.preheader
    ? `<span style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(vars.preheader)}</span>`
    : ''

  const senderName = vars.senderName || EMAIL_APP_NAME
  const validDays = vars.validDays || '30'

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light">
<title>${EMAIL_APP_NAME}</title>
<style>
  @media only screen and (max-width:620px){
    .vv-outer{padding:0 8px!important}
    .vv-card{padding:26px 20px!important}
  }
</style>
</head>
<body style="margin:0;padding:0;word-spacing:normal;background-color:#F2F6F4">
${preheader}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#F2F6F4">
  <tr>
    <td align="center" class="vv-outer" style="padding:8px 12px 36px">

      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:600px">

        <!-- ── Logo lockup ─────────────────────────────────────────── -->
        <tr>
          <td align="center" style="padding:34px 10px 24px">
            ${logo}
            <div style="font-family:${SANS};font-size:23px;line-height:1;font-weight:700;color:#0A2B23;letter-spacing:0.2px">
              Vault<span style="color:#0F766E">Verify</span>
            </div>
          </td>
        </tr>

        <!-- ── Content box ─────────────────────────────────────────── -->
        <tr>
          <td class="vv-card" style="background-color:#FFFFFF;border:1px solid #DCE7E2;border-radius:16px;padding:36px 34px;font-family:${SANS};font-size:15px;line-height:1.65;color:#41504B">
${contentHtml}
          </td>
        </tr>

        <!-- ── Company banner ──────────────────────────────────────── -->
        <tr>
          <td style="padding-top:26px">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:#0A2B23;background-image:linear-gradient(135deg,#0A2B23 0%,#0E3B32 55%,#11544A 100%);border-radius:16px">
              <tr>
                <td align="center" style="padding:28px 30px 26px">
                  <div style="font-family:${SANS};font-size:19px;line-height:1;font-weight:700;color:#FFFFFF;letter-spacing:0.3px">
                    Vault<span style="color:#8BC34A">Verify</span>
                  </div>
                  <div style="width:46px;height:3px;background-color:#2E9E5B;border-radius:2px;margin:12px auto 0"></div>
                  <div style="margin-top:12px;font-family:${SANS};font-size:13px;line-height:1.5;color:#A8CFB8">
                    ${EMAIL_TAGLINE}
                  </div>
                  ${bannerLink}
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- ── Legal line ──────────────────────────────────────────── -->
        <tr>
          <td align="center" style="padding:18px 16px 0;font-family:${SANS};font-size:11.5px;line-height:1.7;color:#7C8A84">
            &copy; ${year} ${EMAIL_APP_NAME} &middot; All rights reserved<br>
            Skills checklists are self-assessed by the candidate and valid ${validDays} days after completion &middot; Sent by ${esc(senderName)}
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>`
}
