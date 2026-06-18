import type { Entry } from '../../../shared/types'
import {
  isBrokenScraperEntry,
  mergeEntryData,
  mergeTextFromEntry,
} from './entry-merge-policy'
import {
  extractInstagramAssetId,
  getLooseNormalizedTitle,
  normalizeIdentityText,
  normalizeIdentityUrl,
  titlesLikelySameForRead,
} from './entry-identity'
import {
  areEntrySimHashesNearDuplicate,
  computeEntrySimHash,
} from '../../database/entry-simhash'

const MATCH_WINDOW_MS = 48 * 60 * 60 * 1000
const NEAR_DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000

function isStaticSocialAssetUrl(url: string): boolean {
  const lower = url.toLowerCase()
  if (lower.includes('static.cdninstagram.com/rsrc')) return true
  if (lower.includes('instagram.com/static/')) return true
  return false
}

function getMediaIdentityKeysForRead(entry: Entry): string[] {
  const keys: string[] = []
  for (const m of entry.media || []) {
    const rawUrl = m.url || ''
    const rawPreview = m.previewUrl || ''
    if (isStaticSocialAssetUrl(rawUrl) && !rawPreview) continue
    if (isStaticSocialAssetUrl(rawPreview) && !rawUrl) continue
    const url = normalizeIdentityUrl(rawUrl)
    const preview = normalizeIdentityUrl(rawPreview)
    if (url && !isStaticSocialAssetUrl(rawUrl)) keys.push(url)
    if (preview && !isStaticSocialAssetUrl(rawPreview)) keys.push(preview)
  }
  const rawImage = entry.imageUrl || ''
  if (rawImage && !isStaticSocialAssetUrl(rawImage)) {
    const image = normalizeIdentityUrl(rawImage)
    if (image) keys.push(image)
  }
  return Array.from(new Set(keys))
}

export function isMirrorSingleForRead(entry: Entry): boolean {
  const mediaCount = getMediaIdentityKeysForRead(entry).length
  if (mediaCount > 1) return false
  const blob = [
    entry.url || '',
    entry.imageUrl || '',
    entry.content || '',
    entry.summary || '',
    ...(entry.media || []).flatMap((m) => [m.url || '', m.previewUrl || '']),
  ]
    .join('\n')
    .toLowerCase()
  return (
    blob.includes('pixnoy.com') ||
    blob.includes('sp1.pixnoy.com') ||
    blob.includes('piokok.com') ||
    blob.includes('picnob.com') ||
    blob.includes('media.picnob.info/get') ||
    blob.includes('media.pixnoy.com/get') ||
    blob.includes('media.picnob.com/get') ||
    blob.includes('media.piokok.com/get') ||
    blob.includes('/p/pt_') ||
    blob.includes('picnob.info/post/') ||
    blob.includes('picnob.com/post/')
  )
}

export function isRichGalleryForRead(entry: Entry): boolean {
  const mediaCount = getMediaIdentityKeysForRead(entry).length
  if (mediaCount >= 2) return true

  const realMediaCount = (entry.media || []).filter(
    (m) =>
      !isStaticSocialAssetUrl(m.url || '') ||
      !isStaticSocialAssetUrl(m.previewUrl || ''),
  ).length
  return realMediaCount >= 2
}

function getPrimaryMediaIdentity(entry: Entry): string {
  for (const m of entry.media || []) {
    const normalized = normalizeIdentityUrl(m.url || m.previewUrl || '')
    if (normalized) return normalized
  }
  return normalizeIdentityUrl(entry.imageUrl || '')
}

export function getEntryReadDedupKey(entry: Entry): string {
  const candidates: string[] = [entry.url || '', entry.imageUrl || '']
  for (const m of entry.media || []) {
    candidates.push(m.url || '', m.previewUrl || '')
  }

  let fallbackAssetId = ''
  for (const s of candidates) {
    const assetId = extractInstagramAssetId(s)
    if (assetId) {
      if (/^\d+$/.test(assetId)) return `read-asset:${entry.feedId}:${assetId}`
      if (!fallbackAssetId) fallbackAssetId = assetId
    }
  }

  const normalizedUrl = normalizeIdentityUrl(entry.url)
  if (normalizedUrl) return `read-url:${entry.feedId}:${normalizedUrl}`
  if (fallbackAssetId) return `read-asset:${entry.feedId}:${fallbackAssetId}`

  const title = normalizeIdentityText(entry.title).slice(0, 80)
  const bucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  const media = getPrimaryMediaIdentity(entry)
  if (media) return `read-media:${entry.feedId}:${title}:${bucket}:${media}`

  const text = normalizeIdentityText(
    (entry.content || entry.summary || '').replace(/<[^>]+>/g, ''),
  ).slice(0, 120)
  return `read-text:${entry.feedId}:${title}:${bucket}:${text}`
}

export function entryRichnessForRead(entry: Entry): number {
  return (
    (entry.media?.length || 0) * 400 +
    (entry.content?.length || 0) +
    (entry.summary?.length || 0) +
    (entry.imageUrl ? 50 : 0)
  )
}

function dedupeMirrorPairsForRead(entries: Entry[]): Entry[] {
  const tsBuckets = new Map<string, Entry>()
  for (const entry of entries) {
    const tsKey = `${entry.feedId}|${entry.publishedAt || 0}`
    const existing = tsBuckets.get(tsKey)
    if (!existing) {
      tsBuckets.set(tsKey, entry)
      continue
    }
    const keepIncoming =
      entryRichnessForRead(entry) > entryRichnessForRead(existing)
    const winner = keepIncoming ? entry : existing
    const loser = keepIncoming ? existing : entry
    mergeTextFromEntry(winner, loser)
    winner.isRead = winner.isRead && loser.isRead
    winner.isStarred = winner.isStarred || loser.isStarred
    winner.isListened =
      (winner.isListened ?? false) && (loser.isListened ?? false)
    if ((loser.listenProgress ?? 0) > (winner.listenProgress ?? 0)) {
      winner.listenProgress = loser.listenProgress
    }
    tsBuckets.set(tsKey, winner)
  }

  const out: Entry[] = []
  const candidateIndexByKey = new Map<string, number[]>()

  const getCandidateKeys = (entry: Entry): string[] => {
    const titleKey = getLooseNormalizedTitle(entry.title).slice(0, 72)
    const baseBucket = Math.floor((entry.publishedAt || 0) / MATCH_WINDOW_MS)
    const label = titleKey || '__NOTITLE__'
    return [
      `${entry.feedId}|${baseBucket - 1}|${label}`,
      `${entry.feedId}|${baseBucket}|${label}`,
      `${entry.feedId}|${baseBucket + 1}|${label}`,
    ]
  }

  const registerCandidate = (entry: Entry, outIndex: number): void => {
    for (const key of getCandidateKeys(entry)) {
      const arr = candidateIndexByKey.get(key) || []
      arr.push(outIndex)
      if (arr.length > 32) arr.splice(0, arr.length - 32)
      candidateIndexByKey.set(key, arr)
    }
  }

  for (const entry of Array.from(tsBuckets.values()).sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )) {
    const canBeMirrorPair =
      isMirrorSingleForRead(entry) || isRichGalleryForRead(entry)
    let idx = -1

    if (canBeMirrorPair) {
      const checked = new Set<number>()
      for (const key of getCandidateKeys(entry)) {
        const candidates = candidateIndexByKey.get(key)
        if (!candidates) continue
        for (let i = candidates.length - 1; i >= 0; i--) {
          const candidateIndex = candidates[i]
          if (checked.has(candidateIndex)) continue
          checked.add(candidateIndex)
          const existing = out[candidateIndex]
          if (!existing || existing.feedId !== entry.feedId) continue
          const delta = Math.abs(
            (existing.publishedAt || 0) - (entry.publishedAt || 0),
          )
          if (delta > MATCH_WINDOW_MS) continue
          const pairMatches =
            (isMirrorSingleForRead(existing) && isRichGalleryForRead(entry)) ||
            (isMirrorSingleForRead(entry) && isRichGalleryForRead(existing))
          if (!pairMatches) continue
          const titlesOk =
            titlesLikelySameForRead(existing.title, entry.title) ||
            !getLooseNormalizedTitle(entry.title) ||
            !getLooseNormalizedTitle(existing.title)
          if (!titlesOk) continue
          idx = candidateIndex
          break
        }
        if (idx !== -1) break
      }
    }

    if (idx === -1) {
      out.push(entry)
      registerCandidate(entry, out.length - 1)
      continue
    }

    const existing = out[idx]
    const keepIncoming =
      (isRichGalleryForRead(entry) && !isRichGalleryForRead(existing)) ||
      (isRichGalleryForRead(entry) === isRichGalleryForRead(existing) &&
        entryRichnessForRead(entry) >= entryRichnessForRead(existing))
    const winner = keepIncoming ? entry : existing
    const loser = keepIncoming ? existing : entry
    mergeTextFromEntry(winner, loser)
    out[idx] = winner
    if (keepIncoming) registerCandidate(entry, idx)
  }

  return out.filter((entry) => !isMirrorSingleForRead(entry))
}

function cloneEntry(entry: Entry): Entry {
  return {
    ...entry,
    media: entry.media ? entry.media.map((item) => ({ ...item })) : entry.media,
  }
}

function mergeEntriesForReadDisplay(existing: Entry, incoming: Entry): Entry {
  const keepIncoming =
    entryRichnessForRead(incoming) > entryRichnessForRead(existing) ||
    (incoming.publishedAt || 0) > (existing.publishedAt || 0)
  const winner = cloneEntry(keepIncoming ? incoming : existing)
  const loser = keepIncoming ? existing : incoming
  mergeEntryData(winner, loser)
  winner.isRead = existing.isRead && incoming.isRead
  winner.isStarred = existing.isStarred || incoming.isStarred
  winner.isListened =
    (existing.isListened ?? false) && (incoming.isListened ?? false)
  if ((incoming.listenProgress ?? 0) > (existing.listenProgress ?? 0)) {
    winner.listenProgress = incoming.listenProgress
  } else {
    winner.listenProgress = existing.listenProgress
  }
  return winner
}

function dedupeNearDuplicateContentForRead(entries: Entry[]): Entry[] {
  const out: Entry[] = []
  const hashes: Array<{ hash: bigint; entryIndex: number }> = []

  for (const entry of entries) {
    const hash = computeEntrySimHash(entry)
    if (!hash) {
      out.push(entry)
      continue
    }

    let matchIndex = -1
    for (const candidate of hashes) {
      const existing = out[candidate.entryIndex]
      if (!existing) continue
      const delta = Math.abs(
        (existing.publishedAt || 0) - (entry.publishedAt || 0),
      )
      if (delta > NEAR_DUPLICATE_WINDOW_MS) continue
      if (!areEntrySimHashesNearDuplicate(candidate.hash, hash)) continue
      matchIndex = candidate.entryIndex
      break
    }

    if (matchIndex === -1) {
      hashes.push({ hash, entryIndex: out.length })
      out.push(entry)
      continue
    }

    out[matchIndex] = mergeEntriesForReadDisplay(out[matchIndex], entry)
  }

  return out
}

export function dedupeEntriesForRead(
  entries: Entry[],
  markEntriesOrderDirty: () => void,
): Entry[] {
  const brokenEntries: Entry[] = []
  const byKey = new Map<string, Entry>()

  for (const entry of entries) {
    if (isBrokenScraperEntry(entry)) {
      brokenEntries.push(entry)
      continue
    }
    const key = getEntryReadDedupKey(entry)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, entry)
      continue
    }

    const merged = mergeEntryData(existing, entry, {
      onPublishedAtAdvanced: markEntriesOrderDirty,
    })
      ? existing
      : existing
    const keepIncoming =
      entryRichnessForRead(entry) > entryRichnessForRead(existing) ||
      (entry.publishedAt || 0) > (existing.publishedAt || 0)

    if (keepIncoming) {
      byKey.set(key, {
        ...entry,
        media: merged.media || entry.media,
        isRead: existing.isRead && entry.isRead,
        isStarred: existing.isStarred || entry.isStarred,
        isListened:
          (existing.isListened ?? false) && (entry.isListened ?? false),
        listenProgress:
          (entry.listenProgress ?? 0) > (existing.listenProgress ?? 0)
            ? entry.listenProgress
            : existing.listenProgress,
      })
    } else {
      existing.isRead = existing.isRead && entry.isRead
      existing.isStarred = existing.isStarred || entry.isStarred
      existing.isListened =
        (existing.isListened ?? false) && (entry.isListened ?? false)
      if ((entry.listenProgress ?? 0) > (existing.listenProgress ?? 0)) {
        existing.listenProgress = entry.listenProgress
      }
      byKey.set(key, existing)
    }
  }

  const goodEntries = Array.from(byKey.values())
  for (const broken of brokenEntries) {
    let bestMatch: Entry | null = null
    let bestDelta = Infinity
    for (const good of goodEntries) {
      if (good.feedId !== broken.feedId) continue
      if (!titlesLikelySameForRead(good.title, broken.title)) continue
      const delta = Math.abs(
        (good.publishedAt || 0) - (broken.publishedAt || 0),
      )
      if (delta < bestDelta) {
        bestDelta = delta
        bestMatch = good
      }
    }
    if (bestMatch && bestDelta <= MATCH_WINDOW_MS) {
      mergeTextFromEntry(bestMatch, broken)
    }
  }

  return dedupeNearDuplicateContentForRead(
    dedupeMirrorPairsForRead(goodEntries),
  )
}
