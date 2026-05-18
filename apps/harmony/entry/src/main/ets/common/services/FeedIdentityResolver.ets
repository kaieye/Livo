import { canonicalFeedUrl, extractInstagramUsername, extractXUsername } from '../utils/social/SocialFeedTitles'
import { FeedViewType } from '../models/LivoModels'

export class FeedIdentityResolver {
  static feedIdentityKeys(rawUrl: string, rawSiteUrl: string = ''): string[] {
    const normalizedUrl = FeedIdentityResolver.normalizeImportedUrl(rawUrl)
    const normalizedSiteUrl = FeedIdentityResolver.normalizeImportedUrl(rawSiteUrl)
    const canonicalUrl = canonicalFeedUrl(normalizedUrl, normalizedSiteUrl)
    const keys: string[] = []

    const urlKey = FeedIdentityResolver.normalizeComparableUrl(normalizedUrl)
    if (urlKey) {
      keys.push(`url:${urlKey}`)
    }

    const canonicalKey = FeedIdentityResolver.normalizeComparableUrl(canonicalUrl)
    if (canonicalKey) {
      keys.push(`canonical:${canonicalKey}`)
    }

    const siteKey = FeedIdentityResolver.normalizeComparableUrl(normalizedSiteUrl)
    if (siteKey) {
      keys.push(`site:${siteKey}`)
    }

    const instagramUsername = extractInstagramUsername(canonicalUrl || normalizedUrl)
      || extractInstagramUsername(normalizedSiteUrl)
    if (instagramUsername) {
      keys.push(`instagram:${instagramUsername}`)
    }

    const xUsername = extractXUsername(canonicalUrl || normalizedUrl)
      || extractXUsername(normalizedSiteUrl)
    if (xUsername) {
      keys.push(`x:${xUsername}`)
    }

    const bilibiliUid = FeedIdentityResolver.extractBilibiliUid(canonicalUrl || normalizedUrl)
      || FeedIdentityResolver.extractBilibiliUid(normalizedSiteUrl)
    if (bilibiliUid) {
      keys.push(`bilibili:${bilibiliUid}`)
    }

    const dedupedKeys: string[] = []
    const seenKeySet: Set<string> = new Set<string>()
    keys.forEach((key: string) => {
      const normalizedKey = (key || '').trim()
      if (!normalizedKey || seenKeySet.has(normalizedKey)) {
        return
      }
      seenKeySet.add(normalizedKey)
      dedupedKeys.push(normalizedKey)
    })
    return dedupedKeys
  }

  static inferFeedViewByUrl(url: string): FeedViewType {
    const normalized = FeedIdentityResolver.normalizeFeedUrl(url)
    if (normalized.includes('/xiaoyuzhou/') || normalized.includes('xiaoyuzhoufm.com')) {
      // 小宇宙 RSSHub 路由默认归入文章栏目，与发现页播客精选保持一致。
      return FeedViewType.Articles
    }
    if (!!extractInstagramUsername(normalized)) {
      return FeedViewType.Pictures
    }
    if (
      normalized.includes('/twitter/')
      || normalized.includes('/x.com/')
      || normalized.includes('/nitter.')
      || normalized.includes('/bilibili/user/dynamic/')
    ) {
      return FeedViewType.SocialMedia
    }
    if (
      normalized.includes('/youtube/')
      || normalized.includes('/bilibili/user/video/')
      || normalized.includes('tedtalks')
    ) {
      return FeedViewType.Videos
    }
    return FeedViewType.Articles
  }

  static normalizeImportedUrl(raw: string): string {
    const trimmed = (raw || '').trim()
    if (!trimmed) {
      return ''
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed.replace(/^\/\/+/, '')}`
    }
    return trimmed
  }

  private static normalizeFeedUrl(url: string): string {
    return (url || '').trim().toLowerCase().replace(/\/+$/g, '')
  }

  private static normalizeComparableUrl(raw: string): string {
    const normalized = (raw || '').trim().toLowerCase()
    if (!normalized) {
      return ''
    }
    return normalized
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./, '')
      .replace(/[?#].*$/g, '')
      .replace(/\/+$/g, '')
  }

  private static extractBilibiliUid(raw: string): string {
    const normalized = FeedIdentityResolver.normalizeComparableUrl(raw)
    if (!normalized) {
      return ''
    }
    const matched = normalized.match(/(?:space\.bilibili\.com\/|\/bilibili\/user\/(?:video|dynamic|article)\/)(\d+)/i)
    return matched?.[1]?.trim() || ''
  }
}
