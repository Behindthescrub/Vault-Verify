// Pure template placeholder rendering — safe to import from client code
// (no DB / server imports). Shared by the server email pipeline and the
// superadmin live preview.

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Replace {{var}} placeholders. Values are HTML-escaped unless their name is
 *  passed in rawKeys (used for pre-built HTML such as personal messages).
 *  Unknown placeholders render as empty strings. */
export function renderTemplate(
  tpl: string,
  vars: Record<string, string>,
  rawKeys: string[] = [],
): string {
  const raw = new Set(rawKeys)
  return tpl.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, k: string) => {
    if (!(k in vars)) return ''
    const v = vars[k]
    return raw.has(k) ? v : escapeHtml(v)
  })
}
