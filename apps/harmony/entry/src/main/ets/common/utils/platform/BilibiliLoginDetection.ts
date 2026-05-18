export interface BilibiliNavLike {
  code?: number
  message?: string
  data?: {
    isLogin?: boolean
    uname?: string
  }
}

export interface BilibiliPageStateLike {
  currentUrl?: string
  title?: string
  displayName?: string
  loggedIn?: boolean
  cookies?: string
}

export interface BilibiliLoginDetectionInput {
  nav?: BilibiliNavLike | null
  pageState?: BilibiliPageStateLike | null
  currentUrl?: string
  cookieGroups?: string[]
}

export interface BilibiliLoginDetectionResult {
  loggedIn: boolean
  navLoggedIn: boolean
  pageLoggedIn: boolean
  hasSessionCookie: boolean
  sessdata: string
  effectiveUrl: string
  displayName: string
}

export function hasBilibiliLoginMarker(value: string): boolean {
  return /"isLogin"\s*:\s*true/i.test(value || '')
}

export function detectBilibiliPageLoggedIn(
  html: string,
  stateText: string,
  displayName: string,
): boolean {
  return (
    hasBilibiliLoginMarker(html) ||
    hasBilibiliLoginMarker(stateText) ||
    !!(displayName || '').trim()
  )
}

function cookieValue(cookieString: string, key: string): string {
  const matched = (cookieString || '').match(
    new RegExp(`(?:^|;\\s*)${key}=([^;]+)`),
  )
  return matched?.[1]?.trim() || ''
}

function decodeCookieValue(value: string): string {
  try {
    return decodeURIComponent(value)
  } catch (_error) {
    return value
  }
}

function bilibiliSessDataFromCookies(...cookieGroups: string[]): string {
  for (const cookies of cookieGroups) {
    const rawValue = cookieValue(cookies, 'SESSDATA')
    const decodedValue = decodeCookieValue(rawValue).trim()
    if (decodedValue) {
      return decodedValue
    }
  }
  return ''
}

function hasCookieInGroups(key: string, ...cookieGroups: string[]): boolean {
  for (const cookies of cookieGroups) {
    if (cookieValue(cookies, key).trim()) {
      return true
    }
  }
  return false
}

function isBilibiliUrl(url: string): boolean {
  return /^https?:\/\/(?:[^/]+\.)?bilibili\.com(?:\/|$)/i.test(
    (url || '').trim(),
  )
}

export function detectBilibiliLogin(
  input: BilibiliLoginDetectionInput,
): BilibiliLoginDetectionResult {
  const cookieGroups = (input.cookieGroups || []).filter(
    (value: string) => !!value.trim(),
  )
  const sessdata = bilibiliSessDataFromCookies(...cookieGroups)
  const hasSessionCookie =
    !!sessdata ||
    hasCookieInGroups('DedeUserID', ...cookieGroups) ||
    hasCookieInGroups('bili_jct', ...cookieGroups)
  const effectiveUrl = (
    input.currentUrl ||
    input.pageState?.currentUrl ||
    ''
  ).trim()
  const navLoggedIn = input.nav?.code === 0 && input.nav?.data?.isLogin === true
  const displayName = (
    input.nav?.data?.uname ||
    input.pageState?.displayName ||
    ''
  ).trim()
  const pageLoggedIn =
    input.pageState?.loggedIn === true ||
    (isBilibiliUrl(effectiveUrl) && hasSessionCookie)

  return {
    loggedIn: navLoggedIn || pageLoggedIn,
    navLoggedIn,
    pageLoggedIn,
    hasSessionCookie,
    sessdata,
    effectiveUrl,
    displayName,
  }
}
