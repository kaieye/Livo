// Cookie group builder for account login detection
// Consolidates cookie fetching logic across providers

export interface BilibiliCookieGroupsInput {
  documentCookies: string
  currentUrl: string
  fetchCookie: (url: string) => string
  probeUrls?: string[]
}

export interface YouTubeCookieGroupsInput {
  documentCookies: string
  currentUrl: string
  fetchCookie: (url: string) => string
  probeUrls?: string[]
}

export const BILIBILI_PROBE_URLS: string[] = [
  'https://www.bilibili.com/',
  'https://passport.bilibili.com/',
  'https://m.bilibili.com/',
  'https://account.bilibili.com/',
]

export const YOUTUBE_PROBE_URLS: string[] = [
  'https://m.youtube.com/',
  'https://www.youtube.com/',
  'https://studio.youtube.com/',
  'https://myaccount.google.com/',
  'https://accounts.google.com/',
]

function buildCookieGroups(
  documentCookies: string,
  currentUrl: string,
  probeUrls: string[],
  fetchCookie: (url: string) => string,
): string[] {
  const cookieGroups: string[] = []
  if (documentCookies.trim()) {
    cookieGroups.push(documentCookies)
  }
  if (currentUrl.trim()) {
    cookieGroups.push(fetchCookie(currentUrl))
  }
  probeUrls.forEach((url: string) => {
    cookieGroups.push(fetchCookie(url))
  })
  return cookieGroups
}

export function buildBilibiliCookieGroups(
  input: BilibiliCookieGroupsInput,
): string[] {
  return buildCookieGroups(
    input.documentCookies,
    input.currentUrl,
    input.probeUrls || BILIBILI_PROBE_URLS,
    input.fetchCookie,
  )
}

export function buildYouTubeCookieGroups(
  input: YouTubeCookieGroupsInput,
): string[] {
  return buildCookieGroups(
    input.documentCookies,
    input.currentUrl,
    input.probeUrls || YOUTUBE_PROBE_URLS,
    input.fetchCookie,
  )
}
