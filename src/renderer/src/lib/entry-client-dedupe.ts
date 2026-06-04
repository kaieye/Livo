/**
 * Client-side entry deduplication.
 *
 * Removes duplicate entries from a list before rendering, using a
 * content-based dedup key rather than relying on server-side identity alone.
 * Social media feeds (Instagram, Twitter/X) often surface the same post
 * through multiple paths — this prevents visual duplicates in the feed.
 */
import type { Entry } from '../../../shared/types'
import { extractInstagramAssetId } from './entry-media-url'

export function getEntryClientDedupKey(entry: Entry): string {
  const candidates: string[] = [
    entry.url || '',
    entry.imageUrl || '',
    entry.content || '',
    entry.summary || '',
  ]
  for (const m of entry.media || [])
    candidates.push(m.url || '', m.previewUrl || '')
  for (const s of candidates) {
    const asset = extractInstagramAssetId(s)
    if (asset) return `asset:${entry.feedId}:${asset}`
  }
  const title = (entry.title || '').toLowerCase().trim().slice(0, 80)
  const bucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  return `fallback:${entry.feedId}:${title}:${bucket}`
}

export function entryClientRichness(entry: Entry): number {
  return (
    (entry.media?.length || 0) * 400 +
    (entry.content?.length || 0) +
    (entry.summary?.length || 0) +
    (entry.imageUrl ? 40 : 0)
  )
}

export function dedupeEntriesForClient(entries: Entry[]): Entry[] {
  const byKey = new Map<string, Entry>()
  for (const entry of entries) {
    const key = getEntryClientDedupKey(entry)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, entry)
      continue
    }
    byKey.set(
      key,
      entryClientRichness(entry) >= entryClientRichness(existing)
        ? entry
        : existing,
    )
  }
  return Array.from(byKey.values()).sort(
    (a, b) => (b.publishedAt || 0) - (a.publishedAt || 0),
  )
}
