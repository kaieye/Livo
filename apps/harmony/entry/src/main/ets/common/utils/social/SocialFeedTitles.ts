import {
  XPlatformParser,
  InstagramPlatformParser,
  BilibiliPlatformParser,
  GenericPlatformParser,
  getHostLike,
  extractBilibiliUid as pExtractBilibiliUid,
  isKnownXHost,
  isKnownInstagramHost,
  trimTitle,
} from './SocialPlatformParsers.ts'
import type { ISocialPlatformParser } from './SocialPlatformParsers.ts'

const xParser = new XPlatformParser()
const instagramParser = new InstagramPlatformParser()
const bilibiliParser = new BilibiliPlatformParser()
const genericParser = new GenericPlatformParser()

/**
 * Registry dispatcher to resolve the appropriate social platform parser for a given feed/site URL.
 */
export function getParserForUrl(
  feedUrl: string,
  siteUrl: string = '',
): ISocialPlatformParser {
  const feedHost = getHostLike(feedUrl)
  const siteHost = getHostLike(siteUrl)

  if (
    isKnownXHost(feedHost) ||
    isKnownXHost(siteHost) ||
    xParser.extractUsername(feedUrl) ||
    xParser.extractUsername(siteUrl)
  ) {
    return xParser
  }

  if (
    isKnownInstagramHost(feedHost) ||
    isKnownInstagramHost(siteHost) ||
    instagramParser.extractUsername(feedUrl) ||
    instagramParser.extractUsername(siteUrl)
  ) {
    return instagramParser
  }

  if (pExtractBilibiliUid(feedUrl) || pExtractBilibiliUid(siteUrl)) {
    return bilibiliParser
  }

  return genericParser
}

// ── Public Facades & Backward Compatibility Exports ──

export function extractInstagramUsername(value: string): string {
  return instagramParser.extractUsername(value)
}

export function extractXUsername(value: string): string {
  return xParser.extractUsername(value)
}

export function canonicalInstagramFeedUrl(
  rawUrl: string,
  siteUrl: string = '',
): string {
  return instagramParser.canonicalUrl(rawUrl, siteUrl)
}

export function canonicalXFeedUrl(
  rawUrl: string,
  siteUrl: string = '',
): string {
  return xParser.canonicalUrl(rawUrl, siteUrl)
}

export function canonicalFeedUrl(rawUrl: string, siteUrl: string = ''): string {
  return getParserForUrl(rawUrl, siteUrl).canonicalUrl(rawUrl, siteUrl)
}

export function formatInstagramFeedTitle(
  candidateTitle: string | undefined,
  usernameOrUrl: string,
): string {
  return instagramParser.formatTitle(candidateTitle, usernameOrUrl)
}

export function formatXFeedTitle(
  candidateTitle: string | undefined,
  usernameOrUrl: string,
): string {
  return xParser.formatTitle(candidateTitle, usernameOrUrl)
}

export function formatBilibiliFeedTitle(
  candidateTitle: string | undefined,
  fallbackUidOrUrl: string,
): string {
  return bilibiliParser.formatTitle(candidateTitle, fallbackUidOrUrl)
}

export function normalizeSocialFeedTitle(
  candidateTitle: string | undefined,
  feedUrl: string,
  siteUrl: string = '',
): string {
  return getParserForUrl(feedUrl, siteUrl).formatTitle(
    candidateTitle,
    feedUrl || siteUrl,
  )
}

export function normalizeSocialFeedDescription(
  description: string | undefined,
  feedUrl: string,
  siteUrl: string = '',
): string {
  const normalized = trimTitle(description || '')
    .replace(/\s*[|·•\-–—]?\s*powered\s+by\s+rsshub\.?\s*$/i, '')
    .trim()
  if (normalized && !/^(instagram|x)\s+用户$/i.test(normalized)) {
    return normalized
  }

  const instagramUsername =
    extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
  if (instagramUsername) {
    return `@${instagramUsername}`
  }

  const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
  if (xUsername) {
    return `@${xUsername}`
  }

  return normalized
}
