import type { Entry } from '../../../shared/types'
import {
  isBrokenScraperEntry,
  mergeEntryData,
  mergeTextFromEntry,
} from '../../database/entry-dedupe'
import {
  makeEntryIdentityKey,
  titlesLikelySameForRead,
} from '../../database/entry-identity'

/**
 * The write-path dedup/identity policy, isolated as a pure decision.
 *
 * Given an incoming entry and an in-memory view of the feed's existing entries,
 * `planEntryWrite` decides whether to insert a brand new row, merge into an
 * existing one, or drop the entry entirely — without touching the database.
 * The repository executes the returned plan via raw SQL.
 *
 * Concentrating the decision here (a) makes the insert/merge/replace policy
 * unit-testable without a database and (b) removes the dedup-policy leak from
 * the repository, which previously imported merge/identity helpers directly.
 */

const BROKEN_SCRAPER_MATCH_WINDOW_MS = 48 * 60 * 60 * 1000

export interface InsertPlan {
  type: 'insert'
}

export interface NoopPlan {
  type: 'noop'
}

export interface MergePlan {
  type: 'merge'
  /** id of the existing entry the incoming entry merges into. */
  targetId: string
  /**
   * Applies the merge policy to the *full* existing row (loaded by the
   * executor) and returns whether anything changed. Mutates `existing` in
   * place, mirroring the previous in-repository behavior.
   */
  applyMerge: (existing: Entry) => boolean
}

export type WritePlan = InsertPlan | MergePlan | NoopPlan

/**
 * Matching only needs identity-relevant fields, so a lite projection of the
 * existing entries (truncated content/summary, no readability/AI columns) is
 * sufficient. Merging is deferred to `applyMerge`, which runs against the full
 * row supplied by the executor.
 */
export function planEntryWrite(
  incoming: Entry,
  existingEntries: Entry[],
): WritePlan {
  if (isBrokenScraperEntry(incoming)) {
    let bestMatch: Entry | null = null
    let bestDelta = Infinity
    for (const candidate of existingEntries) {
      if (!titlesLikelySameForRead(candidate.title, incoming.title)) continue
      const delta = Math.abs(
        (candidate.publishedAt || 0) - (incoming.publishedAt || 0),
      )
      if (delta < bestDelta) {
        bestDelta = delta
        bestMatch = candidate
      }
    }
    if (bestMatch && bestDelta <= BROKEN_SCRAPER_MATCH_WINDOW_MS) {
      return {
        type: 'merge',
        targetId: bestMatch.id,
        applyMerge: (existing) => mergeTextFromEntry(existing, incoming),
      }
    }
    // Broken-scraper entries never create their own row.
    return { type: 'noop' }
  }

  const identityKey = makeEntryIdentityKey(incoming)
  if (identityKey) {
    // Fast path: a row sharing the exact same URL.
    if (incoming.url) {
      const urlMatch = existingEntries.find(
        (candidate) => candidate.url === incoming.url,
      )
      if (urlMatch) {
        return {
          type: 'merge',
          targetId: urlMatch.id,
          applyMerge: (existing) =>
            mergeEntryData(existing, incoming, {
              onPublishedAtAdvanced: () => {},
            }),
        }
      }
    }

    // Slower path: a row whose canonical identity key matches.
    for (const candidate of existingEntries) {
      if (makeEntryIdentityKey(candidate) === identityKey) {
        return {
          type: 'merge',
          targetId: candidate.id,
          applyMerge: (existing) =>
            mergeEntryData(existing, incoming, {
              onPublishedAtAdvanced: () => {},
            }),
        }
      }
    }
  }

  return { type: 'insert' }
}
