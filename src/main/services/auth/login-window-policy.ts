export interface LoginWindowUrlPolicy {
  allowedOrigins?: string[]
  allowedHostSuffixes?: string[]
}

function normalizeHost(value: string): string {
  return value.trim().toLowerCase().replace(/^\.+/, '')
}

function normalizeOrigin(value: string): string | null {
  try {
    return new URL(value).origin.toLowerCase()
  } catch {
    return null
  }
}

function isHostAllowed(
  hostname: string,
  allowedHostSuffixes: string[],
): boolean {
  const host = normalizeHost(hostname)
  return allowedHostSuffixes.some((suffix) => {
    const normalizedSuffix = normalizeHost(suffix)
    return host === normalizedSuffix || host.endsWith(`.${normalizedSuffix}`)
  })
}

export function isLoginWindowUrlAllowed(
  rawUrl: string,
  policy: LoginWindowUrlPolicy,
): boolean {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return false
  }

  if (parsed.protocol !== 'https:') return false
  if (parsed.username || parsed.password) return false

  const allowedOrigins = new Set(
    (policy.allowedOrigins || [])
      .map(normalizeOrigin)
      .filter((origin): origin is string => Boolean(origin)),
  )
  if (allowedOrigins.has(parsed.origin.toLowerCase())) return true

  return isHostAllowed(parsed.hostname, policy.allowedHostSuffixes || [])
}
