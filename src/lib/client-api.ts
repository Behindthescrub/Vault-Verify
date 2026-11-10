// Small JSON fetch helper for client components.
export async function api<T = unknown>(path: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...opts,
    headers: { 'content-type': 'application/json', ...(opts?.headers ?? {}) },
    cache: 'no-store',
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    // no body
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : `Request failed (${res.status})`
    throw new Error(message)
  }
  return body as T
}
