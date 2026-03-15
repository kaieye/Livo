/**
 * JSON-based local database for Livo.
 * Uses simple JSON files - no native compilation needed.
 */
import { app } from "electron"
import { join } from "path"
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync } from "fs"
import type { Feed, Entry } from "../shared/types"
import { FeedViewType } from "../shared/types"

interface DatabaseData {
  feeds: Feed[]
  entries: Entry[]
}

let data: DatabaseData = { feeds: [], entries: [] }
let dbPath = ""
let saveTimer: ReturnType<typeof setTimeout> | null = null
let feedByUrlIndex = new Map<string, Feed>()
let entryByFeedUrlIndex = new Map<string, Entry>()
let entryByFeedIdentityIndex = new Map<string, Entry>()
let entriesByPublishedDesc: Entry[] = []
let entriesOrderDirty = true

function markEntriesOrderDirty(): void {
  entriesOrderDirty = true
}

function isPicnobMirrorHost(host: string): boolean {
  const lower = host.toLowerCase()
  return (
    lower === "media.picnob.info" ||
    lower === "media.pixnoy.com" ||
    lower.includes("piokok.com") ||
    lower.includes("picnob.com") ||
    lower.includes("pixnoy.com") ||
    lower.includes("pixwox.com") ||
    lower.includes("sp1.pixnoy.com") ||
    lower.includes("sp2.pixnoy.com") ||
    lower.includes("sp3.pixnoy.com") ||
    lower.includes("sp4.pixnoy.com") ||
    lower.includes("sp5.pixnoy.com")
  )
}

function getEntriesByPublishedDesc(): Entry[] {
  if (!entriesOrderDirty) return entriesByPublishedDesc
  entriesByPublishedDesc = [...data.entries].sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
  entriesOrderDirty = false
  return entriesByPublishedDesc
}

function makeEntryUrlKey(feedId: string, url: string): string {
  return `${feedId}\n${url}`
}

function normalizeIdentityText(value: string | undefined): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}@#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeIdentityUrl(value: string | undefined): string {
  const raw = (value || "").trim()
  if (!raw) return ""
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase()

    // Picnob media proxy URL carries the real origin in query `url=...`.
    // Normalize by unwrapping to the nested origin URL first.
    if (isPicnobMirrorHost(host) && u.pathname === "/get") {
      const nested = u.searchParams.get("url") || ""
      if (nested) return normalizeIdentityUrl(nested)
    }

    // Canonicalize Picnob/Instagram URLs to a single identity
    // Patterns:
    // - picnob.com/post/{id}
    // - picnob.info/post/{id}
    // - pixnoy.com/post/{id}
    // - pixwox.com/post/{id}
    // - piokok.com/post/{id}
    // - instagram.com/p/{id}
    // - instagram.com/reel/{id}
    if (
      host.includes("picnob") ||
      host.includes("pixnoy") ||
      host.includes("pixwox") ||
      host.includes("piokok") ||
      host.includes("dumpor") ||
      host.includes("instagram.com")
    ) {
      // Extract the shortcode/ID
      // Picnob/Pixnoy: /post/Cy8v... or /user/name/post/Cy8v...
      // Instagram: /p/Cy8v... or /reel/Cy8v...
      const pathParts = u.pathname.split("/").filter(Boolean)
      const postIndex = pathParts.findIndex((p) => p === "post" || p === "p" || p === "reel")
      if (postIndex !== -1 && pathParts[postIndex + 1]) {
        const id = pathParts[postIndex + 1]
        // Normalize to standard Instagram URL.
        // Note: This merges numeric IDs (from some mirrors) with numeric IDs,
        // and shortcodes with shortcodes. It does not map numeric <-> shortcode,
        // but it solves the primary "mirror rotation" duplication issue.
        return `https://www.instagram.com/p/${id}`
      }
    }

    const trackingParams = new Set([
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "si",
      "feature",
      "spm",
      "from",
      "ref",
      "ref_src",
    ])
    const nextSearch = new URLSearchParams()
    for (const [k, v] of u.searchParams.entries()) {
      if (trackingParams.has(k.toLowerCase())) continue
      nextSearch.append(k, v)
    }
    u.hash = ""
    u.search = nextSearch.toString() ? `?${nextSearch.toString()}` : ""
    // Normalize trailing slash for path-like URLs.
    u.pathname = u.pathname.replace(/\/+$/, "") || "/"
    return u.toString()
  } catch {
    return raw.replace(/#.*$/, "")
  }
}

function getPrimaryMediaUrl(entry: Entry): string {
  const mediaUrl = entry.media?.find((m) => !!m.url)?.url || ""
  return mediaUrl || entry.imageUrl || ""
}

function extractInstagramAssetId(input: string | undefined): string {
  const raw = (input || "").trim()
  if (!raw) return ""
  const nested = (() => {
    try {
      const u = new URL(raw)
      if (isPicnobMirrorHost(u.hostname) && u.pathname === "/get") {
        return u.searchParams.get("url") || raw
      }
      if ((u.hostname.includes("pixnoy") || u.hostname.includes("picnob") || u.hostname.includes("piokok")) && u.searchParams.has("o")) {
        const encoded = u.searchParams.get("o") || ""
        if (encoded) {
          const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
          const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
          try {
            const decoded = Buffer.from(padded, "base64").toString("utf-8")
            const nestedUrl = decoded.match(/https?:\/\/\S+/i)?.[0] || decoded
            const nestedId = extractInstagramAssetId(nestedUrl)
            if (nestedId) return nestedId
          } catch {
            // Ignore invalid payload.
          }
        }
      }
    } catch {
      // Ignore parse errors.
    }
    return raw
  })()

  // Try to extract numeric ID first (common in some picnob mirrors)
  const numericMatch = nested.match(/_(\d{14,})_/)
  if (numericMatch?.[1]) return numericMatch[1]
  const directNumericMatch = raw.match(/_(\d{14,})_/)
  if (directNumericMatch?.[1]) return directNumericMatch[1]

  // Try to extract Instagram shortcode (e.g., /p/xxx or /reel/xxx)
  const shortcodeMatch = nested.match(/\/(?:p|reel)\/([a-zA-Z0-9_-]+)/i)
  if (shortcodeMatch?.[1]) return shortcodeMatch[1]
  const directShortcodeMatch = raw.match(/\/(?:p|reel)\/([a-zA-Z0-9_-]+)/i)
  if (directShortcodeMatch?.[1]) return directShortcodeMatch[1]

  // Try to extract post ID from picnob/pixnoy/pixwox/piokok URLs
  // Prefix with "post:" to distinguish from CDN numeric IDs (_NNNN_ pattern).
  // Pixnoy post IDs are Instagram media pks — a different numbering scheme
  // that must not be treated as interchangeable with CDN asset IDs.
  const postMatch = nested.match(/\/post\/([a-zA-Z0-9_-]+)/i)
  if (postMatch?.[1]) return `post:${postMatch[1]}`
  const directPostMatch = raw.match(/\/post\/([a-zA-Z0-9_-]+)/i)
  if (directPostMatch?.[1]) return `post:${directPostMatch[1]}`

  return ""
}

function makeEntryIdentityKey(entry: Entry): string | null {
  // IMPORTANT:
  // Do not use raw content/summary for asset-id identity.
  // Social mirror content often contains many media URLs; extracting an arbitrary asset id
  // from HTML can incorrectly merge different posts into one entry.
  const assetIdCandidates: string[] = [entry.url || "", entry.imageUrl || ""]
  for (const m of entry.media || []) {
    assetIdCandidates.push(m.url || "", m.previewUrl || "")
  }
  // Two-pass: prefer stable numeric asset IDs over shortcodes so that
  // mirror entries and direct entries sharing the same CDN numeric ID
  // produce the same identity key and get deduped on insert.
  let fallbackId = ""
  for (const candidate of assetIdCandidates) {
    const id = extractInstagramAssetId(candidate)
    if (id) {
      if (/^\d+$/.test(id)) return `asset:${entry.feedId}:${id}`
      if (!fallbackId) fallbackId = id
    }
  }
  if (fallbackId) return `asset:${entry.feedId}:${fallbackId}`

  let url = normalizeIdentityUrl(entry.url)

  // Retroactive Fix: If entry has no URL (or invalid one), try to find one in the content.
  // This allows existing "broken" entries in the DB to match with new "valid" entries.
  if (!url) {
    const rawContent = entry.content || entry.summary || ""
    const linkMatch = rawContent.match(/https:\/\/(?:www\.)?(?:instagram\.com\/p\/|picnob\.com\/post\/|picnob\.info\/post\/|pixnoy\.com\/post\/|pixwox\.com\/post\/|piokok\.com\/post\/|dumpor\.com\/v\/)[a-zA-Z0-9_-]+/i)
    if (linkMatch) {
      url = normalizeIdentityUrl(linkMatch[0])
    }
  }

  if (url) return `url:${url}`
  // Fallback for feeds that don't provide a stable link URL (common in some image routes).
  const title = normalizeIdentityText(entry.title)
  const author = normalizeIdentityText(entry.author)
  const mediaUrl = normalizeIdentityUrl(getPrimaryMediaUrl(entry))
  const contentSnippet = normalizeIdentityText((entry.content || entry.summary || "").replace(/<[^>]+>/g, "").slice(0, 180))
  const publishedBucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  if (!title && !mediaUrl && !contentSnippet) return null
  if (mediaUrl) return `fallback-media:${entry.feedId}\n${mediaUrl}\n${author}\n${title}\n${contentSnippet}\n${publishedBucket}`
  return `fallback-text:${entry.feedId}\n${title}\n${author}\n${contentSnippet}\n${publishedBucket}`
}

function getPrimaryMediaIdentity(entry: Entry): string {
  for (const m of entry.media || []) {
    const normalized = normalizeIdentityUrl(m.url || m.previewUrl || "")
    if (normalized) return normalized
  }
  return normalizeIdentityUrl(entry.imageUrl || "")
}

function getEntryReadDedupKey(entry: Entry): string {
  // Keep read-dedupe aligned with insert identity rules:
  // avoid content/summary asset extraction to prevent cross-post merges.
  const candidates: string[] = [entry.url || "", entry.imageUrl || ""]
  for (const m of entry.media || []) {
    candidates.push(m.url || "", m.previewUrl || "")
  }
  // Two-pass: prefer stable numeric asset IDs over shortcodes so that
  // mirror entries (picnob proxy URLs) and direct entries (instagram URLs)
  // sharing the same CDN numeric ID produce the same key.
  let fallbackAssetId = ""
  for (const s of candidates) {
    const assetId = extractInstagramAssetId(s)
    if (assetId) {
      if (/^\d+$/.test(assetId)) return `read-asset:${entry.feedId}:${assetId}`
      if (!fallbackAssetId) fallbackAssetId = assetId
    }
  }
  if (fallbackAssetId) return `read-asset:${entry.feedId}:${fallbackAssetId}`

  const title = normalizeIdentityText(entry.title).slice(0, 80)
  const bucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  const media = getPrimaryMediaIdentity(entry)
  if (media) return `read-media:${entry.feedId}:${title}:${bucket}:${media}`

  const text = normalizeIdentityText((entry.content || entry.summary || "").replace(/<[^>]+>/g, "")).slice(0, 120)
  return `read-text:${entry.feedId}:${title}:${bucket}:${text}`
}

function entryRichnessForRead(entry: Entry): number {
  return (entry.media?.length || 0) * 400 + (entry.content?.length || 0) + (entry.summary?.length || 0) + (entry.imageUrl ? 50 : 0)
}

function normalizeTitleLooseForRead(value: string | undefined): string {
  return (value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\p{Script=Han}#@]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function titlesLikelySameForRead(a: string | undefined, b: string | undefined): boolean {
  const ta = normalizeTitleLooseForRead(a)
  const tb = normalizeTitleLooseForRead(b)
  if (!ta || !tb) return false
  if (ta === tb) return true
  return ta.includes(tb) || tb.includes(ta)
}

/**
 * Detect entries produced by broken scrapers — e.g. Instagram pages that returned
 * the website shell instead of post data.  Hallmarks:
 *  - URL uses a raw numeric media-pk instead of the base64 shortcode
 *    (e.g. instagram.com/p/6735542423462773506815/ — always 404)
 *
 * Instagram shortcodes are base64-encoded (letters+digits+_+-).
 * A URL whose post-ID segment is 13+ pure digits is always invalid.
 */
function isBrokenScraperEntry(entry: Entry): boolean {
  return /instagram\.com\/(?:p|reel)\/\d{13,}\/?$/i.test(entry.url || "")
}

/** Merge longer title / summary from `source` into `target` (mutates target). */
function mergeTextFromEntry(target: Entry, source: Entry): boolean {
  let changed = false
  const srcTitle = (source.title || "").normalize("NFKC")
  const tgtTitle = (target.title || "").normalize("NFKC")
  if (srcTitle.length > tgtTitle.length) {
    target.title = source.title
    changed = true
  }
  if ((source.summary || "").length > (target.summary || "").length) {
    target.summary = source.summary
    changed = true
  }
  return changed
}

/** Detect static social-platform assets (icons, logos, UI sprites) that aren't post photos. */
function isStaticSocialAssetUrl(url: string): boolean {
  const lower = url.toLowerCase()
  // Instagram static UI resources (icons, buttons, sprites etc.)
  if (lower.includes("static.cdninstagram.com/rsrc")) return true
  if (lower.includes("instagram.com/static/")) return true
  return false
}

function getMediaIdentityKeysForRead(entry: Entry): string[] {
  const keys: string[] = []
  for (const m of entry.media || []) {
    const rawUrl = m.url || ""
    const rawPreview = m.previewUrl || ""
    if (isStaticSocialAssetUrl(rawUrl) && !rawPreview) continue
    if (isStaticSocialAssetUrl(rawPreview) && !rawUrl) continue
    const url = normalizeIdentityUrl(rawUrl)
    const preview = normalizeIdentityUrl(rawPreview)
    if (url && !isStaticSocialAssetUrl(rawUrl)) keys.push(url)
    if (preview && !isStaticSocialAssetUrl(rawPreview)) keys.push(preview)
  }
  const rawImage = entry.imageUrl || ""
  if (rawImage && !isStaticSocialAssetUrl(rawImage)) {
    const image = normalizeIdentityUrl(rawImage)
    if (image) keys.push(image)
  }
  return Array.from(new Set(keys))
}

function isMirrorSingleForRead(entry: Entry): boolean {
  const mediaCount = getMediaIdentityKeysForRead(entry).length
  if (mediaCount > 1) return false
  const blob = [
    entry.url || "",
    entry.imageUrl || "",
    entry.content || "",
    entry.summary || "",
    ...(entry.media || []).flatMap((m) => [m.url || "", m.previewUrl || ""]),
  ].join("\n").toLowerCase()
  return (
    blob.includes("pixnoy.com")
    || blob.includes("sp1.pixnoy.com")
    || blob.includes("piokok.com")
    || blob.includes("picnob.com")
    || blob.includes("media.picnob.info/get")
    || blob.includes("media.pixnoy.com/get")
    || blob.includes("media.picnob.com/get")
    || blob.includes("media.piokok.com/get")
    || blob.includes("/p/pt_")
    || blob.includes("picnob.info/post/")
    || blob.includes("picnob.com/post/")
  )
}

function isRichGalleryForRead(entry: Entry): boolean {
  const mediaCount = getMediaIdentityKeysForRead(entry).length
  if (mediaCount >= 2) return true
  // Count non-static media items as a fallback
  const realMediaCount = (entry.media || []).filter(
    (m) => !isStaticSocialAssetUrl(m.url || "") || !isStaticSocialAssetUrl(m.previewUrl || ""),
  ).length
  return realMediaCount >= 2
}

function dedupeMirrorPairsForRead(entries: Entry[]): Entry[] {
  // Pre-pass: same-feed same-exact-timestamp entries are almost certainly duplicates
  // (e.g. Instagram posts scraped from multiple mirrors).  Keep the richest entry.
  const tsBuckets = new Map<string, Entry>()
  for (const entry of entries) {
    const tsKey = `${entry.feedId}|${entry.publishedAt || 0}`
    const existing = tsBuckets.get(tsKey)
    if (!existing) {
      tsBuckets.set(tsKey, entry)
      continue
    }
    const keepIncoming = entryRichnessForRead(entry) > entryRichnessForRead(existing)
    const winner = keepIncoming ? entry : existing
    const loser = keepIncoming ? existing : entry
    mergeTextFromEntry(winner, loser)
    winner.isRead = winner.isRead && loser.isRead
    winner.isStarred = winner.isStarred || loser.isStarred
    tsBuckets.set(tsKey, winner)
  }
  const tsDeduped = Array.from(tsBuckets.values())

  const out: Entry[] = []
  const candidateIndexByKey = new Map<string, number[]>()
  const MIRROR_MATCH_WINDOW = 48 * 60 * 60 * 1000
  const mirrorBucketSize = MIRROR_MATCH_WINDOW

  // Media-asset-ID index: maps numeric CDN asset ID → outIndex[]
  // Used to match mirror-single entries with gallery entries sharing a photo,
  // regardless of title or timestamp distance.
  const mediaIdToOutIndex = new Map<string, number[]>()

  const getNumericMediaIds = (entry: Entry): string[] => {
    const ids: string[] = []
    for (const m of entry.media || []) {
      for (const raw of [m.url || "", m.previewUrl || ""]) {
        const id = extractInstagramAssetId(raw)
        if (id && /^\d+$/.test(id)) ids.push(id)
      }
    }
    const imgId = extractInstagramAssetId(entry.imageUrl || "")
    if (imgId && /^\d+$/.test(imgId)) ids.push(imgId)
    return ids
  }

  const getCandidateKeys = (entry: Entry): string[] => {
    const titleKey = normalizeTitleLooseForRead(entry.title).slice(0, 72)
    const baseBucket = Math.floor((entry.publishedAt || 0) / mirrorBucketSize)
    const label = titleKey || "__NOTITLE__"
    return [
      `${entry.feedId}|${baseBucket - 1}|${label}`,
      `${entry.feedId}|${baseBucket}|${label}`,
      `${entry.feedId}|${baseBucket + 1}|${label}`,
    ]
  }

  const registerCandidate = (entry: Entry, outIndex: number): void => {
    const keys = getCandidateKeys(entry)
    for (const key of keys) {
      const arr = candidateIndexByKey.get(key) || []
      arr.push(outIndex)
      // Keep candidate lists short to avoid unbounded scans on huge datasets.
      if (arr.length > 32) arr.splice(0, arr.length - 32)
      candidateIndexByKey.set(key, arr)
    }
    // Register media asset IDs for non-mirror entries so mirror-single
    // entries can find their original counterpart via shared photo IDs.
    if (!isMirrorSingleForRead(entry)) {
      for (const id of getNumericMediaIds(entry)) {
        const arr = mediaIdToOutIndex.get(id) || []
        arr.push(outIndex)
        if (arr.length > 16) arr.splice(0, arr.length - 16)
        mediaIdToOutIndex.set(id, arr)
      }
    }
  }

  for (const entry of tsDeduped.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))) {
    const canBeMirrorPair = isMirrorSingleForRead(entry) || isRichGalleryForRead(entry)
    let idx = -1

    if (canBeMirrorPair) {
      const checked = new Set<number>()
      const keys = getCandidateKeys(entry)
      for (const key of keys) {
        const candidates = candidateIndexByKey.get(key)
        if (!candidates) continue
        for (let i = candidates.length - 1; i >= 0; i--) {
          const candidateIndex = candidates[i]
          if (checked.has(candidateIndex)) continue
          checked.add(candidateIndex)
          const existing = out[candidateIndex]
          if (!existing) continue
          if (existing.feedId !== entry.feedId) continue
          const delta = Math.abs((existing.publishedAt || 0) - (entry.publishedAt || 0))
          if (delta > MIRROR_MATCH_WINDOW) continue
          const pairMatches =
            (isMirrorSingleForRead(existing) && isRichGalleryForRead(entry))
            || (isMirrorSingleForRead(entry) && isRichGalleryForRead(existing))
          if (!pairMatches) continue
          // Allow matching when either entry has no title (mirror scrapers often
          // fail to extract captions from photo-only posts).
          const titlesOk = titlesLikelySameForRead(existing.title, entry.title)
            || !normalizeTitleLooseForRead(entry.title)
            || !normalizeTitleLooseForRead(existing.title)
          if (!titlesOk) continue
          idx = candidateIndex
          break
        }
        if (idx !== -1) break
      }

      // Fallback: match mirror-single entries via shared media asset ID with any
      // non-mirror entry in the same feed, regardless of timestamp or title.
      if (idx === -1 && isMirrorSingleForRead(entry)) {
        const entryMediaIds = getNumericMediaIds(entry)
        for (const mid of entryMediaIds) {
          const candidates = mediaIdToOutIndex.get(mid)
          if (!candidates) continue
          for (let i = candidates.length - 1; i >= 0; i--) {
            const ci = candidates[i]
            if (checked.has(ci)) continue
            const existing = out[ci]
            if (!existing) continue
            if (existing.feedId !== entry.feedId) continue
            idx = ci
            break
          }
          if (idx !== -1) break
        }
      }
    }

    if (idx === -1) {
      out.push(entry)
      registerCandidate(entry, out.length - 1)
      continue
    }
    const existing = out[idx]
    const keepIncoming =
      (isRichGalleryForRead(entry) && !isRichGalleryForRead(existing))
      || (isRichGalleryForRead(entry) === isRichGalleryForRead(existing)
        && entryRichnessForRead(entry) >= entryRichnessForRead(existing))
    const winner = keepIncoming ? entry : existing
    const loser = keepIncoming ? existing : entry
    mergeTextFromEntry(winner, loser)
    out[idx] = winner
    if (keepIncoming) registerCandidate(entry, idx)
  }
  // Drop any surviving mirror-single entries — they're low-quality proxy
  // scrapes (≤1 photo, from picnob/pixnoy/piokok) that add no value beyond
  // the original gallery entry.  If no gallery counterpart was found above,
  // the mirror is standalone junk and should be filtered out.
  return out.filter((e) => !isMirrorSingleForRead(e))
}

function dedupeEntriesForRead(entries: Entry[]): Entry[] {
  // Separate broken entries — their text will be merged into matching good entries.
  const brokenEntries: Entry[] = []
  const byKey = new Map<string, Entry>()
  for (const entry of entries) {
    if (isBrokenScraperEntry(entry)) { brokenEntries.push(entry); continue }
    const key = getEntryReadDedupKey(entry)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, entry)
      continue
    }

    const merged = mergeEntryData(existing, entry) ? existing : existing
    const keepIncoming =
      entryRichnessForRead(entry) > entryRichnessForRead(existing) ||
      ((entry.publishedAt || 0) > (existing.publishedAt || 0))

    if (keepIncoming) {
      const winner: Entry = {
        ...entry,
        media: merged.media || entry.media,
        isRead: existing.isRead && entry.isRead,
        isStarred: existing.isStarred || entry.isStarred,
      }
      byKey.set(key, winner)
    } else {
      existing.isRead = existing.isRead && entry.isRead
      existing.isStarred = existing.isStarred || entry.isStarred
      byKey.set(key, existing)
    }
  }
  const goodEntries = Array.from(byKey.values())
  // Merge text from broken entries into closest matching good entry.
  for (const broken of brokenEntries) {
    let bestMatch: Entry | null = null
    let bestDelta = Infinity
    for (const good of goodEntries) {
      if (good.feedId !== broken.feedId) continue
      if (!titlesLikelySameForRead(good.title, broken.title)) continue
      const delta = Math.abs((good.publishedAt || 0) - (broken.publishedAt || 0))
      if (delta < bestDelta) { bestDelta = delta; bestMatch = good }
    }
    if (bestMatch && bestDelta <= 48 * 60 * 60 * 1000) {
      mergeTextFromEntry(bestMatch, broken)
    }
  }
  return dedupeMirrorPairsForRead(goodEntries)
}

function mergeEntryData(existing: Entry, incoming: Entry): boolean {
  let changed = false

  // Keep the latest publish time for the same identity entry.
  // Some social feeds update the same post via different mirrors; if we keep
  // the old timestamp, UI sorting/time label appears stale even after refresh.
  if ((incoming.publishedAt || 0) > (existing.publishedAt || 0)) {
    existing.publishedAt = incoming.publishedAt
    changed = true
    markEntriesOrderDirty()
  }

  // Smart Merge: Media
  // Always prefer incoming media from fresh RSS parse when it has items.
  // This ensures carousel images and refreshed CDN URLs are always accepted.
  const incomingMediaCount = incoming.media?.length || 0
  if (incomingMediaCount > 0) {
    const existingMediaSignature = JSON.stringify(
      (existing.media || []).map((m) => `${m.type || ""}|${m.url || ""}`),
    )
    const incomingMediaSignature = JSON.stringify(
      (incoming.media || []).map((m) => `${m.type || ""}|${m.url || ""}`),
    )
    if (existingMediaSignature !== incomingMediaSignature) {
      existing.media = incoming.media
      changed = true
    }
  }

  // Smart Merge: Content
  // Only overwrite if incoming content is LONGER (heuristic for "richer").
  // This prevents an "emoji-stripped" version (shorter) from overwriting the original.
  const existingContentLen = (existing.content || "").length
  const incomingContentLen = (incoming.content || "").length
  if (incomingContentLen > existingContentLen) {
    existing.content = incoming.content
    changed = true
  }

  // Smart Merge: Summary
  const existingSummaryLen = (existing.summary || "").length
  const incomingSummaryLen = (incoming.summary || "").length
  if (incomingSummaryLen > existingSummaryLen) {
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
  // If we matched by identity key but URLs differ (e.g. Picnob vs Instagram), 
  // prefer the one that is "canonical" or just keep the existing one if it's already good.
  // Actually, usually we prefer the incoming URL if it's "better", but here let's just 
  // ensure we have *a* URL.
  if (incoming.url && !existing.url) {
    existing.url = incoming.url
    changed = true
  }

  return changed
}

function dedupeEntriesInPlace(): boolean {
  const seen = new Map<string, Entry>()
  const deduped: Entry[] = []
  let changed = false

  const brokenInPlace: Entry[] = []
  for (const entry of data.entries) {
    // Collect broken scraper entries — their text is merged below before discarding.
    if (isBrokenScraperEntry(entry)) { brokenInPlace.push(entry); changed = true; continue }
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
    if (mergeEntryData(existing, entry)) changed = true
    changed = true
  }
  // Merge text from broken entries into closest matching good entry.
  for (const broken of brokenInPlace) {
    let bestMatch: Entry | null = null
    let bestDelta = Infinity
    for (const good of deduped) {
      if (good.feedId !== broken.feedId) continue
      if (!titlesLikelySameForRead(good.title, broken.title)) continue
      const delta = Math.abs((good.publishedAt || 0) - (broken.publishedAt || 0))
      if (delta < bestDelta) { bestDelta = delta; bestMatch = good }
    }
    if (bestMatch && bestDelta <= 48 * 60 * 60 * 1000) {
      if (mergeTextFromEntry(bestMatch, broken)) changed = true
    }
  }

  if (changed) {
    data.entries = deduped
    markEntriesOrderDirty()
  }
  return changed
}

function rebuildIndexes(): void {
  feedByUrlIndex = new Map()
  for (const feed of data.feeds) {
    feedByUrlIndex.set(feed.url, feed)
  }

  entryByFeedUrlIndex = new Map()
  entryByFeedIdentityIndex = new Map()
  for (const entry of data.entries) {
    if (entry.url) {
      entryByFeedUrlIndex.set(makeEntryUrlKey(entry.feedId, entry.url), entry)
    }
    const identityKey = makeEntryIdentityKey(entry)
    if (identityKey) entryByFeedIdentityIndex.set(identityKey, entry)
  }
  markEntriesOrderDirty()
}

function getDbDir(): string {
  const userDataPath = app.getPath("userData")
  return join(userDataPath, "data")
}

export async function initDatabase(): Promise<void> {
  const dir = getDbDir()
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

  const nextDbPath = join(dir, "livo-data.json")
  const legacyDbPath = join(dir, `${["for", "ss", "-data.json"].join("")}`)
  dbPath = nextDbPath

  const sourceDbPath = existsSync(nextDbPath)
    ? nextDbPath
    : existsSync(legacyDbPath)
      ? legacyDbPath
      : nextDbPath

  if (existsSync(sourceDbPath)) {
    try {
      const raw = readFileSync(sourceDbPath, "utf-8")
      data = JSON.parse(raw)
      if (sourceDbPath !== dbPath && !existsSync(dbPath)) {
        writeFileSync(dbPath, raw)
      }
      if (!data.feeds) data.feeds = []
      if (!data.entries) data.entries = []

      // Migration: ensure all feeds have a view field
      for (const feed of data.feeds) {
        if ((feed as unknown as Record<string, unknown>).view === undefined) {
          (feed as unknown as Record<string, unknown>).view = FeedViewType.Articles
        }
        if ((feed as unknown as Record<string, unknown>).showInAll === undefined) {
          (feed as unknown as Record<string, unknown>).showInAll = true
        }
        // Migration: Instagram feeds should use Pictures view.
        // Handle both Articles (0), SocialMedia (1) and legacy view values.
        const feedView = (feed as unknown as Record<string, unknown>).view as number
        if (
          feedView !== FeedViewType.Pictures
          && /(?:^|\/)(?:instagram|picnob(?:\.info)?|pixnoy|piokok)\/user\//i.test(feed.url || "")
        ) {
          (feed as unknown as Record<string, unknown>).view = FeedViewType.Pictures
        }
      }
      // Migration: fix entry titles.
      // 1. "Untitled" or empty → adopt summary/content text, or ""
      // 2. Truncated title → adopt longer summary that starts with the title
      for (const entry of data.entries) {
        const sp = (entry.summary || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        const cp = (entry.content || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
        const bestText = sp.length >= cp.length ? sp : cp
        const tn = (entry.title || "").replace(/\s+/g, " ").trim()

        if (!tn || tn === "Untitled") {
          // Rule 1: use best available text, or ""
          entry.title = bestText || ""
        } else if (sp.length > tn.length && sp.startsWith(tn)) {
          // Rule 2: truncated title → adopt longer summary
          entry.title = sp
        }
      }

      const deduped = dedupeEntriesInPlace()

      // Migration: remove entries injected by FeedBurner from unrelated domains.
      // When a feed has a siteUrl, drop entries whose hostname doesn't match.
      let foreignRemoved = 0
      const feedSiteHosts = new Map<string, string>()
      for (const feed of data.feeds) {
        if (!feed.siteUrl) continue
        try {
          const host = new URL(feed.siteUrl).hostname.replace(/^www\./, "")
          if (host) feedSiteHosts.set(feed.id, host)
        } catch { /* ignore */ }
      }
      if (feedSiteHosts.size > 0) {
        const beforeLen = data.entries.length
        data.entries = data.entries.filter((e) => {
          const siteHost = feedSiteHosts.get(e.feedId)
          if (!siteHost) return true
          if (!e.url) return true
          try {
            const entryHost = new URL(e.url).hostname.replace(/^www\./, "")
            return entryHost === siteHost || entryHost.endsWith("." + siteHost) || siteHost.endsWith("." + entryHost)
          } catch { return true }
        })
        foreignRemoved = beforeLen - data.entries.length
      }

      if (deduped || foreignRemoved > 0) {
        try {
          writeFileSync(dbPath, JSON.stringify(data), "utf-8")
        } catch {
          // Ignore write failure during startup dedupe.
        }
      }
    } catch {
      data = { feeds: [], entries: [] }
    }
  }

  rebuildIndexes()
}

/** Debounced save to disk */
function scheduleSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      writeFileSync(dbPath, JSON.stringify(data), "utf-8")
    } catch (e) {
      console.error("Failed to save database:", e)
    }
  }, 500)
}

export function forceSave(): void {
  if (saveTimer) clearTimeout(saveTimer)
  try {
    writeFileSync(dbPath, JSON.stringify(data), "utf-8")
  } catch (e) {
    console.error("Failed to save database:", e)
  }
}

// ---- Feed operations ----

export function getAllFeeds(): Feed[] {
  return data.feeds
}

export function getFeedById(id: string): Feed | undefined {
  return data.feeds.find((f) => f.id === id)
}

export function getFeedByUrl(url: string): Feed | undefined {
  return feedByUrlIndex.get(url)
}

export function insertFeed(feed: Feed): void {
  if (feedByUrlIndex.has(feed.url)) return
  const normalizedFeed: Feed = {
    ...feed,
    showInAll: feed.showInAll ?? true,
  }
  data.feeds.push(normalizedFeed)
  feedByUrlIndex.set(normalizedFeed.url, normalizedFeed)
  scheduleSave()
}

export function updateFeed(id: string, updates: Partial<Feed>): void {
  const idx = data.feeds.findIndex((f) => f.id === id)
  if (idx === -1) return
  const prev = data.feeds[idx]
  data.feeds[idx] = { ...prev, ...updates }
  if (prev.url !== data.feeds[idx].url) {
    feedByUrlIndex.delete(prev.url)
    feedByUrlIndex.set(data.feeds[idx].url, data.feeds[idx])
  } else {
    feedByUrlIndex.set(data.feeds[idx].url, data.feeds[idx])
  }
  scheduleSave()
}

export function deleteFeed(id: string): void {
  const removed = data.feeds.find((f) => f.id === id)
  data.feeds = data.feeds.filter((f) => f.id !== id)
  data.entries = data.entries.filter((e) => e.feedId !== id)
  if (removed) feedByUrlIndex.delete(removed.url)
  rebuildIndexes()
  scheduleSave()
}

// ---- Entry operations ----

export function getEntries(options: {
  feedId?: string
  feedIds?: string[]
  starred?: boolean
  unreadOnly?: boolean
  limit?: number
  offset?: number
  compact?: boolean
  maxContentLength?: number
  skipDedupe?: boolean
}): Entry[] {
  const offset = options.offset || 0
  const limit = options.limit || 1000
  const skipDedupe = !!options.skipDedupe
  const preDedupeWindow = Math.max((offset + limit) * 6, 1200)
  const preWindow = skipDedupe ? Math.max((offset + limit) * 2, 800) : preDedupeWindow
  const validFeedIds = new Set(data.feeds.map((f) => f.id))
  const requestedFeedIds = !options.feedId && options.feedIds && options.feedIds.length > 0
    ? new Set(options.feedIds)
    : null

  let result: Entry[] = []
  const orderedEntries = getEntriesByPublishedDesc()
  for (const entry of orderedEntries) {
    if (!validFeedIds.has(entry.feedId)) continue
    if (options.feedId && entry.feedId !== options.feedId) continue
    if (requestedFeedIds && !requestedFeedIds.has(entry.feedId)) continue
    if (options.starred && !entry.isStarred) continue
    if (options.unreadOnly && entry.isRead) continue
    result.push(entry)
    if (result.length >= preWindow) break
  }
  if (!skipDedupe) {
    result = dedupeEntriesForRead(result)
    result.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
  }
  const page = result.slice(offset, offset + limit)
  if (!options.compact) return page

  const trimCompactContent = (value: string | undefined, maxLen: number): string => {
    const raw = value || ""
    if (!raw) return ""
    let next = raw
      .replace(/&lt;\s*(img|video|iframe|audio|picture|source)\b[\s\S]*?(?:&gt;|$)/gi, " ")
      .replace(/<\s*(img|video|iframe|audio|picture|source)\b[^>]*(?:>|$)/gi, " ")
    if (next.length <= maxLen) return next

    let sliced = next.slice(0, maxLen)
    const lastLt = sliced.lastIndexOf("<")
    const lastGt = sliced.lastIndexOf(">")
    if (lastLt > lastGt) {
      const nextGt = next.indexOf(">", maxLen)
      if (nextGt !== -1 && nextGt - maxLen <= 240) {
        sliced = next.slice(0, nextGt + 1)
      } else {
        sliced = sliced.slice(0, lastLt)
      }
    }
    return sliced
  }

  const maxContentLength = Math.max(160, Math.min(options.maxContentLength ?? 1600, 10000))
  const maxSummaryLength = Math.max(120, Math.min(Math.floor(maxContentLength / 2), 2400))
  return page.map((entry) => ({
    ...entry,
    content: trimCompactContent(entry.content, maxContentLength),
    summary: trimCompactContent(entry.summary, maxSummaryLength),
    media: entry.media || [],
  }))
}

export function getEntryById(id: string): Entry | undefined {
  return data.entries.find((e) => e.id === id)
}

export function insertEntry(entry: Entry): boolean {
  const result = upsertEntry(entry)
  if (result.changed) scheduleSave()
  return result.added
}

export function insertEntries(entries: Entry[]): number {
  let added = 0
  let changed = false
  for (const entry of entries) {
    const result = upsertEntry(entry)
    if (result.added) added++
    if (result.changed) changed = true
  }
  if (changed) scheduleSave()
  return added
}

export function replaceEntriesForFeed(feedId: string, entries: Entry[]): number {
  const stateByKey = new Map<string, { isRead: boolean; isStarred: boolean }>()
  const makeKeepKey = (entry: Entry): string => {
    const title = normalizeIdentityText(entry.title).slice(0, 140)
    const bucket = Math.floor((entry.publishedAt || 0) / (60 * 60 * 1000))
    return `${title}|${bucket}`
  }

  for (const entry of data.entries) {
    if (entry.feedId !== feedId) continue
    const key = makeKeepKey(entry)
    const existing = stateByKey.get(key)
    if (!existing) {
      stateByKey.set(key, { isRead: !!entry.isRead, isStarred: !!entry.isStarred })
      continue
    }
    existing.isRead = existing.isRead || !!entry.isRead
    existing.isStarred = existing.isStarred || !!entry.isStarred
  }

  data.entries = data.entries.filter((entry) => entry.feedId !== feedId)
  markEntriesOrderDirty()
  rebuildIndexes()

  let added = 0
  for (const entry of entries) {
    const keep = stateByKey.get(makeKeepKey(entry))
    const incoming: Entry = keep
      ? { ...entry, isRead: entry.isRead || keep.isRead, isStarred: entry.isStarred || keep.isStarred }
      : entry
    const result = upsertEntry(incoming)
    if (result.added) added += 1
  }
  scheduleSave()
  return added
}

function upsertEntry(entry: Entry): { added: boolean; changed: boolean } {
  // Broken scraper entries (invalid numeric Instagram URLs) are not inserted,
  // but their text is merged into the closest matching good entry if possible.
  if (isBrokenScraperEntry(entry)) {
    let bestMatch: Entry | null = null
    let bestDelta = Infinity
    for (const e of data.entries) {
      if (e.feedId !== entry.feedId) continue
      if (!titlesLikelySameForRead(e.title, entry.title)) continue
      const delta = Math.abs((e.publishedAt || 0) - (entry.publishedAt || 0))
      if (delta < bestDelta) { bestDelta = delta; bestMatch = e }
    }
    if (bestMatch && bestDelta <= 48 * 60 * 60 * 1000) {
      return { added: false, changed: mergeTextFromEntry(bestMatch, entry) }
    }
    return { added: false, changed: false }
  }
  // Deduplicate by URL when available; otherwise by a content fingerprint per feed.
  const identityKey = makeEntryIdentityKey(entry)
  if (identityKey) {
    const existing = entryByFeedIdentityIndex.get(identityKey)
    if (existing) {
      return { added: false, changed: mergeEntryData(existing, entry) }
    }
  }
  data.entries.push(entry)
  markEntriesOrderDirty()
  if (entry.url) {
    entryByFeedUrlIndex.set(makeEntryUrlKey(entry.feedId, entry.url), entry)
  }
  if (identityKey) {
    entryByFeedIdentityIndex.set(identityKey, entry)
  }
  return { added: true, changed: true }
}

export function updateEntry(id: string, updates: Partial<Entry>): void {
  const idx = data.entries.findIndex((e) => e.id === id)
  if (idx === -1) return
  const previous = data.entries[idx]
  const next = { ...previous, ...updates }
  data.entries[idx] = next

  if (previous.url && previous.url !== next.url) {
    entryByFeedUrlIndex.delete(makeEntryUrlKey(previous.feedId, previous.url))
  }
  if (next.url) {
    entryByFeedUrlIndex.set(makeEntryUrlKey(next.feedId, next.url), next)
  }

  const previousIdentityKey = makeEntryIdentityKey(previous)
  const nextIdentityKey = makeEntryIdentityKey(next)
  if (previousIdentityKey && previousIdentityKey !== nextIdentityKey) {
    entryByFeedIdentityIndex.delete(previousIdentityKey)
  }
  if (nextIdentityKey) {
    entryByFeedIdentityIndex.set(nextIdentityKey, next)
  }

  if (updates.publishedAt !== undefined) markEntriesOrderDirty()
  scheduleSave()
}

export function markAllRead(feedId?: string): void {
  for (const entry of data.entries) {
    if (!feedId || entry.feedId === feedId) {
      entry.isRead = true
    }
  }
  scheduleSave()
}

export function searchEntries(query: string, limit = 50): Entry[] {
  const q = query.toLowerCase()
  const validFeedIds = new Set(data.feeds.map((f) => f.id))
  const result = data.entries
    .filter((e) => validFeedIds.has(e.feedId))
    .filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        (e.content && e.content.toLowerCase().includes(q)) ||
        (e.summary && e.summary.toLowerCase().includes(q))
    )
  return dedupeEntriesForRead(result)
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, limit)
}

export function getUnreadCount(feedId: string): number {
  if (!data.feeds.some((f) => f.id === feedId)) return 0
  return data.entries.filter((e) => e.feedId === feedId && !e.isRead).length
}

export function getUnreadCountMap(): Map<string, number> {
  const validFeedIds = new Set(data.feeds.map((f) => f.id))
  const unreadByFeed = new Map<string, number>()

  for (const entry of data.entries) {
    if (entry.isRead) continue
    if (!validFeedIds.has(entry.feedId)) continue
    unreadByFeed.set(entry.feedId, (unreadByFeed.get(entry.feedId) || 0) + 1)
  }

  return unreadByFeed
}

// ---- Data maintenance / cleanup ----

export interface CleanupOptions {
  /** Max entries to keep per feed (0 = unlimited) */
  entriesPerFeed: number
  /** Delete entries older than this many days by publishedAt (0 = no age limit) */
  maxEntryAgeDays: number
}

export interface CleanupStats {
  /** Total entries removed */
  removed: number
  /** Entries removed because over per-feed cap */
  removedByCap: number
  /** Entries removed because too old */
  removedByAge: number
  /** Total entries remaining */
  remaining: number
}

/**
 * Clean up old/excess entries with combined retention:
 * - Entries are removed only when BOTH conditions are true:
 *   1) the entry is older than maxEntryAgeDays
 *   2) the feed has more than entriesPerFeed entries (and this entry is outside newest N)
 */
export function cleanupEntries(options: CleanupOptions): CleanupStats {
  const { entriesPerFeed, maxEntryAgeDays } = options
  const now = Date.now()
  const ageCutoff = maxEntryAgeDays > 0 ? now - maxEntryAgeDays * 24 * 60 * 60 * 1000 : 0
  let removed = 0
  let removedByCap = 0
  let removedByAge = 0

  // Build per-feed cap lookup: per-feed maxEntries overrides global entriesPerFeed.
  const feedCapMap = new Map<string, number>()
  for (const feed of data.feeds) {
    feedCapMap.set(feed.id, (feed.maxEntries != null && feed.maxEntries > 0) ? feed.maxEntries : entriesPerFeed)
  }

  // AND semantics: if either limiter is disabled, no entry can satisfy "both".
  // Per-feed caps are checked individually, so even if global is 0, feeds with
  // their own maxEntries still get cleaned when the age condition also holds.
  const hasAnyCapLimit = entriesPerFeed > 0 || data.feeds.some((f) => f.maxEntries != null && f.maxEntries > 0)
  if (ageCutoff > 0 && hasAnyCapLimit) {
    // Group by feed and sort by publishedAt DESC.
    const byFeed = new Map<string, typeof data.entries>()
    for (const e of data.entries) {
      let arr = byFeed.get(e.feedId)
      if (!arr) {
        arr = []
        byFeed.set(e.feedId, arr)
      }
      arr.push(e)
    }

    const overCapIds = new Set<string>()
    const overAgeIds = new Set<string>()
    for (const [feedId, entries] of byFeed) {
      const cap = feedCapMap.get(feedId) ?? entriesPerFeed
      entries.sort((a, b) => b.publishedAt - a.publishedAt)
      if (cap > 0 && entries.length > cap) {
        for (let i = cap; i < entries.length; i++) {
          overCapIds.add(entries[i].id)
        }
      }
      for (const entry of entries) {
        if (entry.publishedAt < ageCutoff) overAgeIds.add(entry.id)
      }
    }

    const toRemoveIds = new Set<string>()
    for (const id of overCapIds) {
      if (overAgeIds.has(id)) toRemoveIds.add(id)
    }

    if (toRemoveIds.size > 0) {
      data.entries = data.entries.filter((e) => !toRemoveIds.has(e.id))
      removed = toRemoveIds.size
      // Under AND policy, every removed entry satisfies both conditions.
      removedByCap = toRemoveIds.size
      removedByAge = toRemoveIds.size
    }
  }

  if (removed > 0) {
    rebuildIndexes()
    scheduleSave()
  }

  return {
    removed,
    removedByCap,
    removedByAge,
    remaining: data.entries.length,
  }
}

/** Get database statistics */
export function getDatabaseStats(): { totalFeeds: number; totalEntries: number; readEntries: number; starredEntries: number; cacheSizeBytes: number } {
  let cacheSizeBytes = 0
  try {
    if (dbPath && existsSync(dbPath)) {
      cacheSizeBytes = statSync(dbPath).size
    } else {
      cacheSizeBytes = Buffer.byteLength(JSON.stringify(data), "utf-8")
    }
  } catch {
    cacheSizeBytes = Buffer.byteLength(JSON.stringify(data), "utf-8")
  }
  return {
    totalFeeds: data.feeds.length,
    totalEntries: data.entries.length,
    readEntries: data.entries.filter((e) => e.isRead).length,
    starredEntries: data.entries.filter((e) => e.isStarred).length,
    cacheSizeBytes,
  }
}

export function getDatabase(): { close: () => void } {
  return {
    close: () => {
      forceSave()
    },
  }
}
