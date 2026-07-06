import type { SyntheticEvent } from 'react'
import type { Entry, MediaItem } from '../../../shared/types'
import {
  decodeHtmlEntitiesUrl,
  decodeMediaUrl,
  extractIgCacheKeyFromUrl,
  hasTinyDecorativeDimensions,
  isDecorativeSocialImageUrl,
} from './entry-media-url'
import { getImageProxyFallbackUrls } from './image-proxy'
import { normalizeLooseText } from './entry-text'
import { getSafeImageSrc } from './safe-image-source'
import {
  cleanSocialPlainText,
  extractImagesFromHtml,
  extractPixnoyOriginUrl,
  getPhotoDedupeKeys,
  isLikelyImageByUrl,
  isRenderableVideoMediaItem,
  withCacheBust,
} from './social-entry-utils'

export interface EntryPhotoDecision {
  url: string
  previewUrl?: string
  width?: number
  height?: number
  blurhash?: string
}

export interface RelatedEntryFallback {
  candidate: Entry
  cover: string
  distance: number
}

export interface SocialEntryMediaDecision {
  photos: EntryPhotoDecision[]
  videos: MediaItem[]
  visibleVideos: MediaItem[]
  galleryPhotos: EntryPhotoDecision[]
  hasBilibiliPageVideo: boolean
  hasMirrorDerivedPhotoContent: boolean
}

const MEDIA_SRC_CACHE_STORAGE_KEY = 'livo-picture-src-cache-v4'
const mediaSrcCache = new Map<string, string>()
let mediaSrcCacheLoaded = false
let mediaSrcCacheSaveTimer: number | null = null

/** 返回解码后的媒体项，保留 previewUrl 的镜像/代理语义用于渲染。 */
export function decodeMediaUrls(m: MediaItem): MediaItem {
  return {
    ...m,
    url: decodeMediaUrl(m.url),
    previewUrl: m.previewUrl
      ? decodeHtmlEntitiesUrl(m.previewUrl)
      : m.previewUrl,
  }
}

export function normalizeImageCacheKey(url: string): string {
  const raw = (url || '').trim()
  if (!raw) return ''
  try {
    const u = new URL(raw)
    const query = u.search || ''
    u.hash = ''
    return `${u.origin}${u.pathname}${query}`
  } catch {
    return raw.split('#')[0] || raw
  }
}

function getPhotoVariantQualityScore(photo: {
  url: string
  previewUrl?: string
}): number {
  const rawUrl = decodeMediaUrl(photo.url || '')
  const rawPreview = decodeMediaUrl(photo.previewUrl || '')
  const target = rawUrl || rawPreview
  if (!target) return 0

  let score = 0
  const lower = target.toLowerCase()
  if (extractIgCacheKeyFromUrl(rawUrl) || extractIgCacheKeyFromUrl(rawPreview))
    score += 12
  if (lower.includes('oh=') && lower.includes('oe=')) score += 8
  if (lower.includes('&_nc_') || lower.includes('?_nc_')) score += 5
  if (/cdninstagram|scontent\.|fbcdn\.net/.test(lower)) score += 4
  if (rawPreview) score += 2
  score += Math.min(target.length, 2000) / 2000
  return score
}

export function dedupeGalleryPhotoVariants(
  photos: EntryPhotoDecision[],
): EntryPhotoDecision[] {
  const kept = new Map<
    string,
    {
      photo: EntryPhotoDecision
      score: number
      order: number
    }
  >()
  const fallback = new Map<
    string,
    {
      photo: EntryPhotoDecision
      score: number
      order: number
    }
  >()

  const register = (
    map: Map<
      string,
      {
        photo: EntryPhotoDecision
        score: number
        order: number
      }
    >,
    key: string,
    payload: {
      photo: EntryPhotoDecision
      score: number
      order: number
    },
  ) => {
    const existing = map.get(key)
    if (
      !existing ||
      payload.score > existing.score ||
      (payload.score === existing.score && payload.order < existing.order)
    ) {
      map.set(key, payload)
    }
  }

  for (let index = 0; index < photos.length; index += 1) {
    const photo = photos[index]
    const keys = getPhotoDedupeKeys(photo.url || '', photo.previewUrl || '')
    const payload = {
      photo,
      score: getPhotoVariantQualityScore(photo),
      order: index,
    }
    if (keys.length === 0) {
      const fallbackKey =
        normalizeImageCacheKey(
          decodeMediaUrl(photo.url || photo.previewUrl || ''),
        ) || `idx:${index}`
      register(fallback, fallbackKey, payload)
      continue
    }
    for (const key of keys) register(kept, key, payload)
  }

  const merged = [...kept.values(), ...fallback.values()].sort(
    (a, b) => a.order - b.order,
  )

  const unique: EntryPhotoDecision[] = []
  const seenOrders = new Set<number>()
  for (const entry of merged) {
    if (seenOrders.has(entry.order)) continue
    seenOrders.add(entry.order)
    unique.push(entry.photo)
  }

  return unique
}

export function isInstagramLikeGalleryPhoto(photo: {
  url: string
  previewUrl?: string
}): boolean {
  const candidate = decodeMediaUrl(
    photo.url || photo.previewUrl || '',
  ).toLowerCase()
  if (!candidate) return false
  return (
    candidate.includes('ig_cache_key=') ||
    /cdninstagram|scontent\.|fbcdn\.net|media\.(?:picnob|pixnoy|piokok|pixwox)\./i.test(
      candidate,
    )
  )
}

function ensureMediaSrcCacheLoaded(): void {
  if (mediaSrcCacheLoaded || typeof window === 'undefined') return
  mediaSrcCacheLoaded = true
  try {
    const raw = window.localStorage.getItem(MEDIA_SRC_CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, string>
    for (const [k, v] of Object.entries(parsed || {})) {
      if (k && v) mediaSrcCache.set(k, v)
    }
  } catch {
    // 媒体缓存是 best-effort，解析失败不影响渲染。
  }
}

function persistMediaSrcCache(): void {
  if (typeof window === 'undefined') return
  if (mediaSrcCacheSaveTimer) window.clearTimeout(mediaSrcCacheSaveTimer)
  mediaSrcCacheSaveTimer = window.setTimeout(() => {
    try {
      const maxEntries = 1500
      const entries = Array.from(mediaSrcCache.entries())
      const sliced =
        entries.length > maxEntries
          ? entries.slice(entries.length - maxEntries)
          : entries
      const obj = Object.fromEntries(sliced)
      window.localStorage.setItem(
        MEDIA_SRC_CACHE_STORAGE_KEY,
        JSON.stringify(obj),
      )
    } catch {
      // localStorage 写入失败时保持当前图片渲染，不升级为用户可见错误。
    }
  }, 200)
}

export function buildMediaFallbackCandidates(
  primaryUrl: string,
  coverUrl: string,
  mirrorOriginUrl: string,
): string[] {
  const proxyFallbacks = getImageProxyFallbackUrls(
    mirrorOriginUrl || coverUrl || primaryUrl,
    {
      width: 1280,
      quality: 85,
      format: 'jpg',
    },
  )
  const candidates = [
    primaryUrl,
    coverUrl,
    mirrorOriginUrl,
    ...proxyFallbacks,
  ].filter(Boolean)
  const seedForMirror = mirrorOriginUrl || coverUrl || primaryUrl
  if (
    seedForMirror &&
    /cdninstagram\.com|fbcdn\.net|scontent\./i.test(seedForMirror)
  ) {
    candidates.push(
      `https://media.pixnoy.com/get?url=${encodeURIComponent(seedForMirror)}`,
    )
  }
  const unique: string[] = []
  for (const url of candidates) {
    const safeUrl = getSafeImageSrc(url)
    if (!safeUrl) continue
    const normalized = normalizeImageCacheKey(safeUrl)
    if (
      !normalized ||
      unique.some((existing) => normalizeImageCacheKey(existing) === normalized)
    )
      continue
    unique.push(safeUrl)
  }
  return unique
}

export function advanceCardImageFallback(
  e: SyntheticEvent<HTMLImageElement>,
  seedUrl: string,
  onExhausted?: (img: HTMLImageElement) => void,
  previewUrl?: string,
): void {
  const img = e.currentTarget
  const normalizedSeed = decodeMediaUrl(seedUrl || '')
  const originFromMirror =
    extractPixnoyOriginUrl(seedUrl) || extractPixnoyOriginUrl(normalizedSeed)
  const candidates = buildMediaFallbackCandidates(
    img.currentSrc || img.src || normalizedSeed,
    normalizedSeed || seedUrl,
    originFromMirror,
  )
  const rawDecoded = decodeHtmlEntitiesUrl(seedUrl || '')
  if (
    rawDecoded &&
    rawDecoded !== normalizedSeed &&
    getSafeImageSrc(rawDecoded)
  ) {
    const rawKey = normalizeImageCacheKey(rawDecoded)
    if (
      rawKey &&
      !candidates.some((c) => normalizeImageCacheKey(c) === rawKey)
    ) {
      candidates.splice(1, 0, rawDecoded)
    }
  }
  if (previewUrl) {
    const decodedPreview = decodeMediaUrl(previewUrl)
    for (const pUrl of [previewUrl, decodedPreview]) {
      const safePreviewUrl = getSafeImageSrc(pUrl)
      if (safePreviewUrl) {
        const pKey = normalizeImageCacheKey(safePreviewUrl)
        if (
          pKey &&
          !candidates.some((c) => normalizeImageCacheKey(c) === pKey)
        ) {
          candidates.splice(1, 0, safePreviewUrl)
          const mirrorProxyFallbacks = getImageProxyFallbackUrls(
            safePreviewUrl,
            {
              width: 1280,
              quality: 85,
              format: 'jpg',
            },
          )
          for (const mpUrl of mirrorProxyFallbacks) {
            const safeMpUrl = getSafeImageSrc(mpUrl)
            if (!safeMpUrl) continue
            const mpKey = normalizeImageCacheKey(safeMpUrl)
            if (
              mpKey &&
              !candidates.some((c) => normalizeImageCacheKey(c) === mpKey)
            ) {
              candidates.push(safeMpUrl)
            }
          }
        }
      }
    }
  }
  const currentKey = normalizeImageCacheKey(img.currentSrc || img.src || '')
  const currentIdx = candidates.findIndex(
    (candidate) => normalizeImageCacheKey(candidate) === currentKey,
  )
  const nextIdx = currentIdx >= 0 ? currentIdx + 1 : 1
  if (nextIdx < candidates.length) {
    img.dataset.fallbackIndex = String(nextIdx)
    img.src = withCacheBust(candidates[nextIdx])
    return
  }
  onExhausted?.(img)
}

export function getRememberedMediaSrc(
  coverUrl: string,
  primaryUrl: string,
): string {
  ensureMediaSrcCacheLoaded()
  const byUrl = mediaSrcCache.get(`url:${normalizeImageCacheKey(coverUrl)}`)
  if (byUrl) {
    const safeRememberedUrl = getSafeImageSrc(byUrl)
    if (
      !safeRememberedUrl ||
      /^https?:\/\/media\.(picnob|pixnoy)\.[^/]+\/get\?/i.test(byUrl)
    ) {
      mediaSrcCache.delete(`url:${normalizeImageCacheKey(coverUrl)}`)
    } else {
      return safeRememberedUrl
    }
  }
  return getSafeImageSrc(primaryUrl) || ''
}

export function rememberMediaSrc(coverUrl: string, resolvedSrc: string): void {
  const src = (resolvedSrc || '').trim()
  const safeSrc = getSafeImageSrc(src)
  if (!safeSrc) return
  ensureMediaSrcCacheLoaded()
  const urlKey = normalizeImageCacheKey(coverUrl)
  if (urlKey) mediaSrcCache.set(`url:${urlKey}`, safeSrc)
  persistMediaSrcCache()
}

function hasVideoMedia(entry: Entry): boolean {
  if (
    (entry.media || []).some(
      (m) => m.type === 'video' && isRenderableVideoMediaItem(m),
    )
  )
    return true
  const html = `${entry.content || ''}\n${entry.summary || ''}`
  return /<video\b/i.test(html)
}

function countRenderableImages(entry: Entry): number {
  const keys = new Set<string>()
  for (const media of entry.media || []) {
    const preview = decodeMediaUrl(media.previewUrl || '')
    const primary = decodeMediaUrl(media.url || '')
    if (preview && isLikelyImageByUrl(preview))
      keys.add(normalizeImageCacheKey(preview))
    if (primary && isLikelyImageByUrl(primary))
      keys.add(normalizeImageCacheKey(primary))
  }
  const imageUrl = decodeMediaUrl(entry.imageUrl || '')
  if (imageUrl && isLikelyImageByUrl(imageUrl))
    keys.add(normalizeImageCacheKey(imageUrl))
  for (const img of extractImagesFromHtml(
    entry.content || entry.summary || '',
  )) {
    const decoded = decodeMediaUrl(img)
    if (decoded && isLikelyImageByUrl(decoded))
      keys.add(normalizeImageCacheKey(decoded))
  }
  return keys.size
}

function collectEntryPostHints(entry: Entry): Set<string> {
  const hints = new Set<string>()
  const push = (value: string) => {
    const key = (value || '').trim()
    if (key) hints.add(key)
  }
  const html = `${entry.content || ''}\n${entry.summary || ''}`
  const urls = [
    entry.url || '',
    entry.imageUrl || '',
    ...(entry.media || []).flatMap((m) => [m.url || '', m.previewUrl || '']),
    ...extractImagesFromHtml(html),
    ...(html.match(/https?:\/\/[^\s"'<>]+/g) || []),
  ]
    .map((u) => decodeMediaUrl(u))
    .filter(Boolean)

  for (const url of urls) {
    const igCacheKey = extractIgCacheKeyFromUrl(url)
    const base = decodeURIComponent(igCacheKey).split('.')[0] || ''
    if (base) push(`igk:${base}`)
    const shortcode =
      url.match(/instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)?.[1] || ''
    if (shortcode) push(`igsc:${shortcode}`)
  }

  const textKey = normalizeLooseText(
    `${entry.title || ''} ${cleanSocialPlainText(html)}`,
  ).slice(0, 180)
  if (textKey) push(`txt:${textKey}`)
  return hints
}

function areStronglySameSocialPost(a: Entry, b: Entry): boolean {
  if (a.feedId !== b.feedId) return false
  const delta = Math.abs((a.publishedAt || 0) - (b.publishedAt || 0))
  if (delta > 7 * 24 * 60 * 60 * 1000) return false
  const aHints = collectEntryPostHints(a)
  const bHints = collectEntryPostHints(b)
  for (const hint of aHints) {
    if (bHints.has(hint)) return true
  }
  return false
}

export function collapseCoverOnlyBeforeVideoEntries(entries: Entry[]): Entry[] {
  if (entries.length <= 1) return entries
  const compacted: Entry[] = []
  const LOOKAHEAD = 8
  for (let i = 0; i < entries.length; i += 1) {
    const current = entries[i]
    const currentIsSingleCover =
      !hasVideoMedia(current) && countRenderableImages(current) === 1
    if (currentIsSingleCover) {
      const upper = Math.min(entries.length - 1, i + LOOKAHEAD)
      let shouldMergeBackward = false
      for (let j = i + 1; j <= upper; j += 1) {
        const candidate = entries[j]
        if (!hasVideoMedia(candidate)) continue
        if (areStronglySameSocialPost(current, candidate)) {
          shouldMergeBackward = true
          break
        }
      }
      if (shouldMergeBackward) continue
    }
    compacted.push(current)
  }
  return compacted
}

export function resolveGridCardMedia(entry: Entry): {
  photoCovers: string[]
  coverUrl: string
  photoCount: number
} {
  const unique: string[] = []
  const push = (value: string) => {
    const candidate = decodeMediaUrl(value || '').trim()
    if (!candidate || !isLikelyImageByUrl(candidate)) return
    const safeCandidate = getSafeImageSrc(candidate)
    if (!safeCandidate) return
    const key = normalizeImageCacheKey(safeCandidate)
    if (!key) return
    if (unique.some((u) => normalizeImageCacheKey(u) === key)) return
    unique.push(safeCandidate)
  }

  for (const media of entry.media || []) {
    if (media.type !== 'photo') continue
    push(media.previewUrl || '')
    push(media.url || '')
    if (unique.length >= 4) break
  }
  if (unique.length === 0) push(entry.imageUrl || '')
  const photoCovers = unique.slice(0, 4)
  const fromValidatedPhotos = photoCovers[0] || ''

  const fromMediaCandidates =
    [
      ...(entry.media || []).flatMap((media) => [
        media.previewUrl || '',
        media.url || '',
      ]),
      entry.imageUrl || '',
    ]
      .map((value) => decodeMediaUrl(value))
      .find(
        (value) =>
          !!value && isLikelyImageByUrl(value) && !!getSafeImageSrc(value),
      ) || ''

  const ytMatch = (entry.url || '').match(
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]+)/,
  )
  const youtubeThumbnail = ytMatch
    ? `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`
    : ''

  return {
    photoCovers,
    coverUrl:
      fromValidatedPhotos ||
      getSafeImageSrc(fromMediaCandidates) ||
      getSafeImageSrc(youtubeThumbnail) ||
      '',
    photoCount: (entry.media || []).filter((m) => m.type === 'photo').length,
  }
}

function collectPostKeys(candidate: Entry): Set<string> {
  const keys = new Set<string>()
  const push = (k: string) => {
    const value = (k || '').trim()
    if (!value) return
    keys.add(value)
  }
  const htmlText = `${candidate.content || ''}\n${candidate.summary || ''}`
  const urls = [
    candidate.url || '',
    candidate.imageUrl || '',
    ...(candidate.media || []).flatMap((m) => [
      m.url || '',
      m.previewUrl || '',
    ]),
    ...extractImagesFromHtml(htmlText),
    ...(htmlText.match(/https?:\/\/[^\s"'<>]+/g) || []),
  ]
    .map((u) => decodeMediaUrl(u))
    .filter(Boolean)

  for (const url of urls) {
    const decoded = decodeMediaUrl(url)
    const igCacheKey = extractIgCacheKeyFromUrl(decoded)
    const base64Part = decodeURIComponent(igCacheKey).split('.')[0] || ''
    if (base64Part) {
      push(`igk:${base64Part}`)
      try {
        const instagramId = atob(base64Part)
        if (/^\d+$/.test(instagramId)) push(`igid:${instagramId}`)
      } catch {
        // 非 base64 的缓存键不是 Instagram 数字 ID，忽略即可。
      }
    }
    const shortcodeMatch = decoded.match(
      /instagram\.com\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i,
    )
    if (shortcodeMatch?.[1]) push(`igsc:${shortcodeMatch[1]}`)
  }
  return keys
}

function getBestImage(candidate: Entry): string {
  const mediaPhotos = (candidate.media || []).filter((m) => m.type === 'photo')
  for (const photo of mediaPhotos) {
    const preview = decodeMediaUrl(photo.previewUrl || '')
    if (preview && isLikelyImageByUrl(preview)) {
      const safePreview = getSafeImageSrc(preview)
      if (safePreview) return safePreview
    }
    const primary = decodeMediaUrl(photo.url || '')
    if (primary && isLikelyImageByUrl(primary)) {
      const safePrimary = getSafeImageSrc(primary)
      if (safePrimary) return safePrimary
    }
  }
  const entryImage = decodeMediaUrl(candidate.imageUrl || '')
  if (entryImage && isLikelyImageByUrl(entryImage)) {
    const safeEntryImage = getSafeImageSrc(entryImage)
    if (safeEntryImage) return safeEntryImage
  }
  const contentImages = extractImagesFromHtml(
    candidate.content || candidate.summary || '',
  )
  const firstValid = contentImages.find(
    (u) => isLikelyImageByUrl(u) && !!getSafeImageSrc(u),
  )
  return firstValid ? getSafeImageSrc(decodeMediaUrl(firstValid)) || '' : ''
}

export function findRelatedSocialEntryFallback(
  entry: Entry,
  allEntries: Entry[],
): RelatedEntryFallback | null {
  const currentKeys = collectPostKeys(entry)
  const currentTextKey = normalizeLooseText(
    `${entry.title || ''} ${cleanSocialPlainText(entry.content || entry.summary || '')}`,
  ).slice(0, 180)
  const minTime = (entry.publishedAt || 0) - 30 * 24 * 60 * 60 * 1000
  const maxTime = (entry.publishedAt || 0) + 30 * 24 * 60 * 60 * 1000

  const isLikelySamePost = (candidate: Entry): boolean => {
    if (candidate.id === entry.id) return false
    if (candidate.feedId !== entry.feedId) return false
    const ts = candidate.publishedAt || 0
    if (ts < minTime || ts > maxTime) return false

    const candidateKeys = collectPostKeys(candidate)
    for (const key of currentKeys) {
      if (candidateKeys.has(key)) return true
    }
    if (currentTextKey) {
      const candidateTextKey = normalizeLooseText(
        `${candidate.title || ''} ${cleanSocialPlainText(candidate.content || candidate.summary || '')}`,
      ).slice(0, 180)
      if (candidateTextKey && candidateTextKey === currentTextKey) return true
    }
    return false
  }

  const related = allEntries
    .filter(isLikelySamePost)
    .map((candidate) => ({
      candidate,
      cover: getBestImage(candidate),
      distance: Math.abs(
        (candidate.publishedAt || 0) - (entry.publishedAt || 0),
      ),
    }))
    .sort((a, b) => a.distance - b.distance)

  const withCover = related.find((item) => !!item.cover)
  if (withCover) return withCover
  return related[0] || null
}

export function resolveSocialEntryMediaDecision(input: {
  entry: Entry
  relatedFallbackCover?: string
}): SocialEntryMediaDecision {
  const { entry } = input
  const photos: EntryPhotoDecision[] = []
  const seen = new Set<string>()
  for (const m of entry.media || []) {
    if (m.type !== 'photo' && !isLikelyImageByUrl(m.url || m.previewUrl || ''))
      continue
    const decoded = decodeMediaUrls(m)
    if (isDecorativeSocialImageUrl(decoded.url || decoded.previewUrl || ''))
      continue
    if (hasTinyDecorativeDimensions(decoded.width, decoded.height)) continue
    const safeUrl = getSafeImageSrc(decoded.url)
    const safePreviewUrl = getSafeImageSrc(decoded.previewUrl)
    if (!safeUrl && !safePreviewUrl) continue
    const key = (safeUrl || safePreviewUrl || '').toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    photos.push({
      ...decoded,
      url: safeUrl || safePreviewUrl || '',
      previewUrl: safePreviewUrl,
    })
  }
  if (photos.length === 0) {
    const fallback = entry.imageUrl ? decodeMediaUrl(entry.imageUrl) : ''
    const safeFallback = getSafeImageSrc(fallback)
    if (safeFallback && isLikelyImageByUrl(safeFallback))
      photos.push({ url: safeFallback })
  }

  const videos = (entry.media || [])
    .filter((m) => {
      if (m.type !== 'video') return false
      const url = decodeMediaUrl(m.url || '').toLowerCase()
      const preview = decodeMediaUrl(m.previewUrl || '').toLowerCase()
      if (isLikelyImageByUrl(url) || isLikelyImageByUrl(preview)) return false
      return true
    })
    .map(decodeMediaUrls)
    .filter((m) => isRenderableVideoMediaItem(m))

  const hasBilibiliPageVideo = videos.some((video) =>
    /(?:^|\.)bilibili\.com\/video\/|(?:^|\.)b23\.tv\//i.test(
      (video.url || '').toLowerCase(),
    ),
  )
  const fallbackPreview =
    photos[0]?.url || input.relatedFallbackCover || entry.imageUrl || ''
  const visibleVideos = videos.map((video) => {
    const rawPreview = decodeMediaUrl(video.previewUrl || '')
    const validPreview =
      rawPreview && isLikelyImageByUrl(rawPreview)
        ? getSafeImageSrc(rawPreview) || ''
        : ''
    if (validPreview) return { ...video, previewUrl: validPreview }
    if (!fallbackPreview) return video
    const fallback = decodeMediaUrl(fallbackPreview)
    const safeFallback = getSafeImageSrc(fallback)
    if (!safeFallback || !isLikelyImageByUrl(safeFallback)) return video
    return { ...video, previewUrl: safeFallback }
  })

  return {
    photos,
    videos,
    visibleVideos,
    galleryPhotos: hasBilibiliPageVideo ? [] : photos,
    hasBilibiliPageVideo,
    hasMirrorDerivedPhotoContent:
      /media\.(?:picnob|pixnoy|piokok|pixwox)\.|sp\d+\.pixnoy\./i.test(
        `${entry.content || ''}\n${entry.summary || ''}`,
      ),
  }
}
