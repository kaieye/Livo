import type { Entry } from '../../shared/types'
import {
  entryRichnessForRead,
  getEntryReadDedupKey,
  getLooseNormalizedTitle,
  isMirrorSingleForRead,
  isRichGalleryForRead,
  makeEntryIdentityKey,
  titlesLikelySameForRead,
} from './entry-identity'

const MATCH_WINDOW_MS = 48 * 60 * 60 * 1000

export function isBrokenScraperEntry(entry: Entry): boolean {
  return /instagram\.com\/(?:p|reel)\/\d{13,}\/?$/i.test(entry.url || '')
}

export function mergeTextFromEntry(target: Entry, source: Entry): boolean {
  let changed = false
  const srcTitle = (source.title || '').normalize('NFKC')
  const tgtTitle = (target.title || '').normalize('NFKC')
  if (srcTitle.length > tgtTitle.length) {
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

  if ((incoming.publishedAt || 0) > (existing.publishedAt || 0)) {
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

  if ((incoming.content || '').length > (existing.content || '').length) {
    existing.content = incoming.content
    changed = true
  }
  if ((incoming.summary || '').length > (existing.summary || '').length) {
    existing.summary = incoming.summary
    changed = true
  }
  if (incoming.authorAvatar && !existing.authorAvatar) {
    existing.authorAvatar = incoming.authorAvatar
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
      })
    } else {
      existing.isRead = existing.isRead && entry.isRead
      existing.isStarred = existing.isStarred || entry.isStarred
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

  return dedupeMirrorPairsForRead(goodEntries)
}

export function dedupeEntriesInPlace(
  entries: Entry[],
  options: { markEntriesOrderDirty: () => void },
): { entries: Entry[]; changed: boolean } {
  const seen = new Map<string, Entry>()
  const deduped: Entry[] = []
  let changed = false
  const brokenEntries: Entry[] = []

  for (const entry of entries) {
    if (isBrokenScraperEntry(entry)) {
      brokenEntries.push(entry)
      changed = true
      continue
    }
    const key = makeEntryIdentityKey(entry)
    if (!key) {
      deduped.push(entry)
      continue
    }
    const existing = seen.get(key)
    if (!existing) {
      seen.set(key, entry)
      deduped.push(entry)
      continue
    }
    if (
      mergeEntryData(existing, entry, {
        onPublishedAtAdvanced: options.markEntriesOrderDirty,
      })
    ) {
      changed = true
    }
    changed = true
  }

  for (const broken of brokenEntries) {
    let bestMatch: Entry | null = null
    let bestDelta = Infinity
    for (const good of deduped) {
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
      if (mergeTextFromEntry(bestMatch, broken)) {
        changed = true
      }
    }
  }

  return { entries: deduped, changed }
}
