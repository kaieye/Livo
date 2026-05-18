import { extractYouTubeProfileName } from './YouTubeProfileResolver.ts'

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
