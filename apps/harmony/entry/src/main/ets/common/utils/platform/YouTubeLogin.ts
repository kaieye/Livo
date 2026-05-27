export interface YouTubePageState {
  currentUrl: string
  title: string
  cookies: string
  pageHtml: string
}

const PROFILE_PATTERNS: RegExp[] = [
  /"channelHandle"\s*:\s*"(@[^"]+)"/i,
  /\\"channelHandle\\"\s*:\s*\\"(@[^\\"]+)\\"/i,
  /"accountName"\s*:\s*"([^"]+)"/i,
  /\\"accountName\\"\s*:\s*\\"([^\\"]+)\\"/i,
  /"channelName"\s*:\s*"([^"]+)"/i,
  /\\"channelName\\"\s*:\s*\\"([^\\"]+)\\"/i,
  /"displayName"\s*:\s*"([^"]+)"/i,
  /\\"displayName\\"\s*:\s*\\"([^\\"]+)\\"/i,
  /"fullName"\s*:\s*"([^"]+)"/i,
  /\\"fullName\\"\s*:\s*\\"([^\\"]+)\\"/i,
  /"givenName"\s*:\s*"([^"]+)"/i,
  /\\"givenName\\"\s*:\s*\\"([^\\"]+)\\"/i,
  /<meta\s+itemprop="name"\s+content="([^"]+)"/i,
  /Google Account[:\s]+([^"<]+)/i,
]

function extractYouTubeProfileName(source: string): string {
  const text = source || ''
  for (const pattern of PROFILE_PATTERNS) {
    const matched = text.match(pattern)
    if (matched?.[1]?.trim()) {
      return matched[1].trim()
    }
  }
  return ''
}

export function normalizeYouTubeProfileSources(
  value: object | string[] | null | undefined,
): string[] {
  if (!Array.isArray(value)) {
    return []
  }
  return value
    .filter(
      (item: object | string | null | undefined) => typeof item === 'string',
    )
    .map((item: object | string | null | undefined) => `${item}`.trim())
    .filter((item: string) => !!item)
}

export function resolveYouTubeProfileName(sources: string[]): string {
  for (const source of sources) {
    const name = extractYouTubeProfileName(source)
    if (name) {
      return name
    }
  }
  return ''
}

export interface YouTubeLoginDetectionInput {
  currentUrl: string
  title: string
  documentCookies: string
  pageHtml: string
}

export interface YouTubeLoginDetectionResult {
  inLoginFlow: boolean
  loggedIn: boolean
  hasSessionCookie: boolean
  displayName: string
}

function extractHost(url: string): string {
  const matched = (url || '').trim().match(/^(?:https?:\/\/)?([^/?#:]+)/i)
  return matched?.[1]?.toLowerCase() || ''
}

function extractDisplayName(source: string): string {
  return extractYouTubeProfileName(source)
}

function hasSessionCookie(cookies: string): boolean {
  return /(?:^|;\s*)(?:SAPISID|SID|SSID|HSID|APISID)=/i.test(cookies || '')
}

function isLoginHost(host: string): boolean {
  return host === 'accounts.google.com' || host === 'accounts.youtube.com'
}

export function detectYouTubeLoginState(
  input: YouTubeLoginDetectionInput,
): YouTubeLoginDetectionResult {
  const currentUrl = (input.currentUrl || '').trim()
  const documentCookies = (input.documentCookies || '').trim()
  const pageHtml = input.pageHtml || ''
  const host = extractHost(currentUrl)
  const sessionCookie = hasSessionCookie(documentCookies)
  const displayName = extractDisplayName(pageHtml)
  const hasProfileEvidence = !!displayName
  const inLoginFlow =
    isLoginHost(host) && !(sessionCookie && hasProfileEvidence)
  const loggedIn = (sessionCookie || hasProfileEvidence) && !inLoginFlow

  return {
    inLoginFlow,
    loggedIn,
    hasSessionCookie: sessionCookie,
    displayName,
  }
}

export function resolveYouTubeLoginUrl(): string {
  const continueUrl = encodeURIComponent('https://m.youtube.com/')
  return `https://accounts.google.com/ServiceLogin?service=youtube&uilel=3&passive=true&prompt=select_account&continue=${continueUrl}`
}
