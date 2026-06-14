import type { Entry } from '../../shared/types'
import {
  entryRichnessForRead,
  getEntryReadDedupKey,
  getLooseNormalizedTitle,
  isMirrorSingleForRead,
  isRichGalleryForRead,
  titlesLikelySameForRead,
} from './entry-identity'
import {
  areEntrySimHashesNearDuplicate,
  computeEntrySimHash,
} from './entry-simhash'

const MATCH_WINDOW_MS = 48 * 60 * 60 * 1000
const NEAR_DUPLICATE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000
const SOCIAL_QUOTE_CARD_CLASS = 'social-quote-card'

export function isBrokenScraperEntry(entry: Entry): boolean {
  return /instagram\.com\/(?:p|reel)\/\d{13,}\/?$/i.test(entry.url || '')
}

function hasSocialQuoteCard(content: string | undefined): boolean {
  return String(content || '').includes(SOCIAL_QUOTE_CARD_CLASS)
}

function isNitterRetweetDisplayTitle(title: string | undefined): boolean {
  return /^RT\s+@[a-zA-Z0-9_]{1,15}\s*$/.test(String(title || '').trim())
}

function isLegacyNitterRetweetTitle(title: string | undefined): boolean {
  return /^RT by @[a-zA-Z0-9_]{1,15}:\s*/i.test(String(title || '').trim())
}

function shouldUpgradeNitterRetweetPresentation(
  existing: Entry,
  incoming: Entry,
): boolean {
  if (!isNitterRetweetDisplayTitle(incoming.title)) return false
  if (!hasSocialQuoteCard(incoming.content)) return false
  if (isLegacyNitterRetweetTitle(existing.title)) return true
  return !!incoming.url && incoming.url === existing.url
}

export function mergeTextFromEntry(target: Entry, source: Entry): boolean {
  let changed = false
  const srcTitle = (source.title || '').normalize('NFKC')
  const tgtTitle = (target.title || '').normalize('NFKC')

  const isStatLikeTitle = (value: string): boolean => {
    const normalized = (value || '').normalize('NFKC').trim()
    if (!normalized) return true
    if (/[\p{Script=Han}A-Za-z]/u.test(normalized)) return false
    return /^(?:\d+(?:\.\d+)?(?:万|亿)?)+(?::\d{1,2}){1,2}$/u.test(normalized)
  }

  const shouldPreferSourceTitle =
    srcTitle.length > tgtTitle.length ||
    (isStatLikeTitle(tgtTitle) && !isStatLikeTitle(srcTitle))

  if (shouldPreferSourceTitle && srcTitle && srcTitle !== tgtTitle) {
    target.title = source.title
    changed = true
  }
  if ((source.summary || '').length > (target.summary || '').length) {
    target.summary = source.summary
    changed = true
  }
  return changed
}

export function mergeEntryData(
  existing: Entry,
  incoming: Entry,
  options?: { onPublishedAtAdvanced?: () => void },
): boolean {
  let changed = false

  const preferredTitleBeforeMerge = existing.title
  if (mergeTextFromEntry(existing, incoming)) {
    changed = true
  }

  const shouldUpgradeNitterRetweet = shouldUpgradeNitterRetweetPresentation(
    existing,
    incoming,
  )

  if (shouldUpgradeNitterRetweet && existing.title !== incoming.title) {
    existing.title = incoming.title
    changed = true
  }

  if ((incoming.publishedAt || 0) > (existing.publishedAt || 0)) {
    existing.publishedAt = incoming.publishedAt
    changed = true
    options?.onPublishedAtAdvanced?.()
  } else if (
    existing.title !== preferredTitleBeforeMerge &&
    incoming.publishedAt &&
    incoming.publishedAt !== existing.publishedAt
  ) {
    existing.publishedAt = incoming.publishedAt
    changed = true
    options?.onPublishedAtAdvanced?.()
  }

  if ((incoming.media?.length || 0) > 0) {
    const existingMediaSignature = JSON.stringify(
      (existing.media || []).map((m) => `${m.type || ''}|${m.url || ''}`),
    )
    const incomingMediaSignature = JSON.stringify(
      (incoming.media || []).map((m) => `${m.type || ''}|${m.url || ''}`),
    )
    if (existingMediaSignature !== incomingMediaSignature) {
      existing.media = incoming.media
      changed = true
    }
  }

  if (shouldUpgradeNitterRetweet && incoming.content !== existing.content) {
    existing.content = incoming.content
    changed = true
  } else if (
    (incoming.content || '').length > (existing.content || '').length
  ) {
    existing.content = incoming.content
    changed = true
  }
  if ((incoming.summary || '').length > (existing.summary || '').length) {
    existing.summary = incoming.summary
    changed = true
  }
  if (
    incoming.readabilityContent &&
    (!existing.readabilityContent ||
      (incoming.readabilityFetchedAt || 0) >
        (existing.readabilityFetchedAt || 0))
  ) {
    existing.readabilityContent = incoming.readabilityContent
    existing.readabilityTitle = incoming.readabilityTitle
    existing.readabilityExcerpt = incoming.readabilityExcerpt
    existing.readabilitySiteName = incoming.readabilitySiteName
    existing.readabilityLength = incoming.readabilityLength
    existing.readabilityFetchedAt = incoming.readabilityFetchedAt
    existing.readabilityError = incoming.readabilityError
    changed = true
  }
  if (
    incoming.aiSummary &&
    (!existing.aiSummary ||
      (incoming.aiSummaryGeneratedAt || 0) >
        (existing.aiSummaryGeneratedAt || 0))
  ) {
    existing.aiSummary = incoming.aiSummary
    existing.aiSummaryGeneratedAt = incoming.aiSummaryGeneratedAt
    existing.aiSummaryError = incoming.aiSummaryError
    changed = true
  }
  if (
    incoming.notifiedAt &&
    (!existing.notifiedAt || incoming.notifiedAt > existing.notifiedAt)
  ) {
    existing.notifiedAt = incoming.notifiedAt
    changed = true
  }
  if (incoming.authorAvatar && !existing.authorAvatar) {
    existing.authorAvatar = incoming.authorAvatar
    changed = true
  }
  if (
    shouldUpgradeNitterRetweet &&
    incoming.authorAvatar &&
    incoming.authorAvatar !== existing.authorAvatar
  ) {
    existing.authorAvatar = incoming.authorAvatar
    changed = true
  }
  if (
    (incoming.author || '').trim() &&
    (!(existing.author || '').trim() ||
      (existing.author || '').includes('投稿视频') ||
      (existing.author || '').includes('视频分享')) &&
    incoming.author !== existing.author
  ) {
    existing.author = incoming.author
    changed = true
  }
  if (
    shouldUpgradeNitterRetweet &&
    (incoming.author || '').trim() &&
    incoming.author !== existing.author
  ) {
    existing.author = incoming.author
    changed = true
  }
  if (incoming.imageUrl && incoming.imageUrl !== existing.imageUrl) {
    existing.imageUrl = incoming.imageUrl
    changed = true
  }
  if (incoming.url && !existing.url) {
    existing.url = incoming.url
    changed = true
  }

  return changed
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
