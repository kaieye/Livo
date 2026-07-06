const SECRET_QUERY_PARAM_NAMES = new Set([
  'access_token',
  'apikey',
  'api_key',
  'auth_token',
  'authorization',
  'awsaccesskeyid',
  'client_secret',
  'credential',
  'expires',
  'googleaccessid',
  'key',
  'key-pair-id',
  'password',
  'policy',
  'refresh_token',
  'se',
  'secret',
  'security-token',
  'session',
  'sessionid',
  'sig',
  'signature',
  'sp',
  'spr',
  'sr',
  'srt',
  'ss',
  'st',
  'sv',
  'token',
])

function isSecretQueryParam(name: string): boolean {
  const normalized = name.trim().toLowerCase()
  return (
    SECRET_QUERY_PARAM_NAMES.has(normalized) ||
    normalized.startsWith('x-amz-') ||
    normalized.startsWith('x-goog-') ||
    normalized.endsWith('_token') ||
    normalized.endsWith('-token')
  )
}

export function sanitizePersistedUrl(rawUrl: string): string {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ''

  try {
    const url = new URL(trimmed)
    url.username = ''
    url.password = ''
    url.hash = ''
    for (const key of Array.from(url.searchParams.keys())) {
      if (isSecretQueryParam(key)) {
        url.searchParams.delete(key)
      }
    }
    return url.toString()
  } catch {
    return trimmed
  }
}
