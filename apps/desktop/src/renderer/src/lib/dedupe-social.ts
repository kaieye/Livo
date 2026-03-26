import type { Entry } from "../../../shared/types"

function stripHtml(input: string): string {
  return (input || "").replace(/<[^>]+>/g, " ")
}

function normalizeText(input: string): string {
  return stripHtml(input)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^\p{L}\p{N}@#]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeTitleLoose(input: string): string {
  return (input || "")
    .normalize("NFKC")
    .toLowerCase()
    // Drop most emoji/symbol noise while keeping letters/numbers/CJK/#/@.
    .replace(/[^\p{L}\p{N}\p{Script=Han}#@]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function isGenericUntitledTitle(input: string): boolean {
  const t = normalizeTitleLoose(input)
  return t === "" || t === "untitled" || t === "无标题"
}

function titlesLikelySame(a: string, b: string): boolean {
  const ta = normalizeTitleLoose(a)
  const tb = normalizeTitleLoose(b)
  if (ta && tb) {
    if (ta === tb) return true
    // Accept close prefix/suffix variants (common in mirrored picnob entries).
    if (ta.length >= 10 && tb.length >= 10 && (ta.includes(tb) || tb.includes(ta))) return true
  }
  // Fallback for emoji-only or symbol-only titles: compare raw trimmed strings
  const rawA = (a || "").normalize("NFKC").replace(/\s+/g, " ").trim()
  const rawB = (b || "").normalize("NFKC").replace(/\s+/g, " ").trim()
  if (!rawA || !rawB) return false
  if (rawA === rawB) return true
  if (rawA.length >= 4 && rawB.length >= 4 && (rawA.startsWith(rawB) || rawB.startsWith(rawA))) return true
  return false
}

function contentPrefixKey(entry: Entry): string {
  const text = normalizeText(entry.content || entry.summary || "")
  return text.replace(/\s+/g, "").slice(0, 140)
}

function normalizeAuthor(author: string): string {
  return (author || "").toLowerCase().replace(/^@+/, "").trim()
}

function normalizeUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const u = new URL(raw)
    const host = u.hostname.toLowerCase().replace(/^www\./, "")
    const path = u.pathname.replace(/\/+$/, "")
    const xHost = host === "x.com" || host === "twitter.com" || host.includes("nitter")
    const status = path.match(/\/status\/(\d+)/i)
    if (xHost && status?.[1]) return `tweet:${status[1]}`
    return `${host}${path}`.toLowerCase()
  } catch {
    return raw.replace(/[?#].*$/, "").toLowerCase()
  }
}

function extractInstagramPostId(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const match = parsed.pathname.match(/\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
    if (match?.[1]) return match[1].toLowerCase()
    return ""
  } catch {
    const match = raw.match(/\/(?:p|reel|tv)\/([a-zA-Z0-9_-]+)/i)
    return match?.[1]?.toLowerCase() || ""
  }
}

function extractInstagramPostIdFromText(input: string): string {
  const urls = (input || "").match(/https?:\/\/\S+/g) || []
  for (const url of urls) {
    const id = extractInstagramPostId(url)
    if (id) return id
  }
  return ""
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

function extractInstagramAssetId(input: string): string {
  const raw = (input || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (isPicnobMirrorHost(host) && parsed.pathname === "/get") {
      const nested = parsed.searchParams.get("url") || ""
      if (nested) {
        const nestedId = extractInstagramAssetId(nested)
        if (nestedId) return nestedId
      }
    }
    if ((host.includes("pixnoy") || host.includes("picnob")) && parsed.searchParams.has("o")) {
      const encoded = parsed.searchParams.get("o") || ""
      if (encoded) {
        const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/")
        const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4)
        try {
          const decoded = atob(padded)
          const nested = decoded.match(/https?:\/\/\S+/i)?.[0] || decoded
          const nestedId = extractInstagramAssetId(nested)
          if (nestedId) return nestedId
        } catch {
          // Ignore.
        }
      }
    }
    // Fallback to current URL after trying nested/origin URLs first.
    const directMatch = raw.match(/_(\d{14,})_/)
    if (directMatch?.[1]) return directMatch[1]
    const decodedRaw = decodeURIComponent(raw)
    const decodedMatch = decodedRaw.match(/_(\d{14,})_/)
    if (decodedMatch?.[1]) return decodedMatch[1]
  } catch {
    // Ignore parse failures and try direct fallback below.
  }
  const directMatch = raw.match(/_(\d{14,})_/)
  if (directMatch?.[1]) return directMatch[1]
  return ""
}

function extractInstagramAssetIdFromEntry(entry: Entry): string {
  const parts: string[] = [entry.url || "", entry.imageUrl || "", entry.content || "", entry.summary || ""]
  for (const m of entry.media || []) {
    parts.push(m.url || "", m.previewUrl || "")
  }
  for (const part of parts) {
    const id = extractInstagramAssetId(part)
    if (id) return id
  }
  return ""
}

function extractPicnobOriginUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase()
    if (!isPicnobMirrorHost(host)) return ""
    if (parsed.pathname !== "/get") return ""
    const qIndex = raw.indexOf("?")
    const rawQuery = qIndex >= 0 ? raw.slice(qIndex + 1) : ""
    const marker = rawQuery.indexOf("url=")
    if (marker < 0) return ""
    const nestedRaw = rawQuery.slice(marker + 4).trim()
    if (!nestedRaw) return ""
    try {
      const decoded = decodeURIComponent(nestedRaw)
      if (/^https?:\/\//i.test(decoded)) return decoded
    } catch {}
    return /^https?:\/\//i.test(nestedRaw) ? nestedRaw : ""
  } catch {
    return ""
  }
}

function normalizeMediaUrl(url: string): string {
  const raw = (url || "").trim()
  if (!raw) return ""
  const nestedPicnob = extractPicnobOriginUrl(raw)
  if (nestedPicnob) return normalizeMediaUrl(nestedPicnob)
  try {
    const parsed = new URL(raw)
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "")
    const path = decodeURIComponent(parsed.pathname).replace(/\/+$/, "")
    if (/cdninstagram|fbcdn\.net|scontent\./i.test(host)) {
      const base = path.split("/").filter(Boolean).at(-1) || path
      if (base) return `igcdn:${base.toLowerCase()}`
    }
    return `${host}${path}`.toLowerCase()
  } catch {
    return raw.split("#")[0].toLowerCase()
  }
}

function getEntryLeadMediaKey(entry: Entry): string {
  const media = entry.media || []
  for (const item of media) {
    const preview = normalizeMediaUrl(item.previewUrl || "")
    if (preview) return preview
    const original = normalizeMediaUrl(item.url || "")
    if (original) return original
  }
  const imageUrl = normalizeMediaUrl(entry.imageUrl || "")
  if (imageUrl) return imageUrl
  const fromContent = (entry.content || entry.summary || "").match(/https?:\/\/\S+/g) || []
  for (const url of fromContent) {
    const normalized = normalizeMediaUrl(url)
    if (normalized && !normalized.includes("instagram.com/") && !normalized.includes("picnob")) return normalized
  }
  return ""
}

function isPixnoySingle(entry: Entry): boolean {
  const mediaCount = countDistinctMedia(entry)
  if (mediaCount > 1) return false
  const signals: string[] = [entry.url || "", entry.imageUrl || "", entry.content || "", entry.summary || ""]
  for (const m of entry.media || []) {
    signals.push(m.url || "", m.previewUrl || "")
  }
  const blob = signals.join("\n").toLowerCase()
  if (!blob.trim()) return false
  if (blob.includes("pixnoy.com") || blob.includes("sp1.pixnoy.com") || blob.includes("piokok.com") || blob.includes("picnob.com")) return true
  if (blob.includes("media.picnob.info/get") || blob.includes("media.pixnoy.com/get") || blob.includes("media.picnob.com/get") || blob.includes("media.piokok.com/get")) return true
  if (blob.includes("/p/pt_")) return true
  if (blob.includes("picnob.info/post/") || blob.includes("picnob.com/post/")) return true
  return false
}

function isRichGallery(entry: Entry): boolean {
  return countDistinctMedia(entry) >= 2 || (entry.media?.length || 0) >= 2
}

function getMediaSignature(entry: Entry): string {
  const keys: string[] = []

  for (const item of entry.media || []) {
    const preview = normalizeMediaUrl(item.previewUrl || "")
    const original = normalizeMediaUrl(item.url || "")
    if (preview) keys.push(preview)
    if (original) keys.push(original)
  }

  const imageKey = normalizeMediaUrl(entry.imageUrl || "")
  if (imageKey) keys.push(imageKey)

  // Preserve order and cap size to avoid an overly long key.
  const uniq: string[] = []
  for (const k of keys) {
    if (!k || uniq.includes(k)) continue
    uniq.push(k)
    if (uniq.length >= 4) break
  }
  return uniq.join("|")
}

function hasInstagramLikeSignal(entry: Entry): boolean {
  const urls: string[] = []
  urls.push(entry.url || "", entry.imageUrl || "")
  for (const m of entry.media || []) {
    urls.push(m.url || "", m.previewUrl || "")
  }
  const text = `${entry.content || ""}\n${entry.summary || ""}`
  urls.push(...(text.match(/https?:\/\/\S+/g) || []))

  return urls.some((u) => /instagram\.com|picnob|pixnoy|cdninstagram|fbcdn\.net/i.test(u))
}

function countDistinctMedia(entry: Entry): number {
  const keys = getEntryMediaKeys(entry)
  return keys.length
}

function getMediaRenderWeight(url: string): number {
  const raw = (url || "").toLowerCase()
  if (!raw) return 0
  if (raw.includes("media.picnob.info/get") || raw.includes("media.picnob.com/get") || raw.includes("media.piokok.com/get")) return 0
  if (/sp\d+\.pixnoy\.com\/p\/pt/i.test(raw)) return 4
  if (raw.includes("pixnoy.com/p/pt")) return 3
  if (raw.includes("media.pixnoy.com/get")) return 2
  if (/cdninstagram|fbcdn\.net|scontent\./i.test(raw)) return 1
  if (/\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(raw)) return 1
  return 0
}

function renderabilityScore(entry: Entry): number {
  const keys = getEntryMediaKeys(entry)
  let score = 0
  for (const key of keys) score += getMediaRenderWeight(key)
  return score
}

function getEntryMediaKeys(entry: Entry): string[] {
  const keys: string[] = []
  for (const m of entry.media || []) {
    const a = normalizeMediaUrl(m.url || "")
    const b = normalizeMediaUrl(m.previewUrl || "")
    if (a) keys.push(a)
    if (b) keys.push(b)
  }
  const imageKey = normalizeMediaUrl(entry.imageUrl || "")
  if (imageKey) keys.push(imageKey)
  return Array.from(new Set(keys.filter(Boolean)))
}

function mergeEntries(existing: Entry, incoming: Entry): Entry {
  const mergedMedia = [...(existing.media || [])]
  const mediaKeySet = new Set(
    mergedMedia.map((m) => `${normalizeMediaUrl(m.url || "")}|${normalizeMediaUrl(m.previewUrl || "")}|${m.type || ""}`),
  )
  for (const m of incoming.media || []) {
    const key = `${normalizeMediaUrl(m.url || "")}|${normalizeMediaUrl(m.previewUrl || "")}|${m.type || ""}`
    if (!mediaKeySet.has(key)) {
      mediaKeySet.add(key)
      mergedMedia.push(m)
    }
  }

  const richer = richness(incoming) > richness(existing) ? incoming : existing
  return {
    ...richer,
    id: richer.id,
    media: mergedMedia,
    imageUrl: richer.imageUrl || existing.imageUrl || incoming.imageUrl || "",
    content: richer.content || existing.content || incoming.content,
    summary: richer.summary || existing.summary || incoming.summary,
    url: richer.url || existing.url || incoming.url,
    publishedAt: Math.max(existing.publishedAt || 0, incoming.publishedAt || 0),
  }
}

function dedupeKey(entry: Entry): string {
  const feedScope = `f:${entry.feedId}`
  const author = normalizeAuthor(entry.author || "")
  const normalizedText = normalizeText(entry.content || entry.summary || entry.title || "")

  // For Instagram/Picnob style feeds, prefer post-level identity (same across all
  // carousel photos) over asset-level identity (unique per photo in a carousel).
  if (hasInstagramLikeSignal(entry)) {
    const postIdFromUrl = extractInstagramPostId(entry.url || "")
    if (postIdFromUrl) return `${feedScope}\nig:${postIdFromUrl}`

    const postIdFromMedia = extractInstagramPostIdFromText(
      `${entry.imageUrl || ""}\n${(entry.media || []).map((m) => `${m.url || ""}\n${m.previewUrl || ""}`).join("\n")}`,
    )
    if (postIdFromMedia) return `${feedScope}\nig:${postIdFromMedia}`

    const postIdFromContent = extractInstagramPostIdFromText(entry.content || entry.summary || "")
    if (postIdFromContent) return `${feedScope}\nig:${postIdFromContent}`

    // Asset ID is unique per carousel photo — only use when no post ID is available
    // (e.g. picnob mirror entries that lack the original Instagram post URL).
    const assetId = extractInstagramAssetIdFromEntry(entry)
    if (assetId) return `${feedScope}\niga:${assetId}`

    // Picnob/Instagram mixed feeds sometimes emit both:
    // - a single-image item
    // - a multi-image aggregated item
    // with different URL/text but the same lead media.
    const leadMediaKey = getEntryLeadMediaKey(entry)
    if (leadMediaKey) return `${feedScope}\nigl:${author}\n${leadMediaKey}`

    const textPrefix = normalizedText.replace(/\s+/g, "").slice(0, 90)
    if (textPrefix) return `${feedScope}\nigt:${author}\n${textPrefix}`

    // Fallback for emoji-only content: use raw title/content (preserving emojis)
    const rawTitle = (entry.title || "").normalize("NFKC").replace(/\s+/g, "").trim().slice(0, 60)
    if (rawTitle && rawTitle !== "untitled" && rawTitle !== "Untitled") {
      return `${feedScope}\nigr:${author}\n${rawTitle}`
    }

    const mediaSignature = getMediaSignature(entry)
    if (mediaSignature) return `${feedScope}\nigm:${author}\n${mediaSignature}`
  }

  const postIdFromUrl = extractInstagramPostId(entry.url || "")
  if (postIdFromUrl) return `${feedScope}\nig:${postIdFromUrl}`

  const postIdFromMedia = extractInstagramPostIdFromText(
    `${entry.imageUrl || ""}\n${(entry.media || []).map((m) => `${m.url || ""}\n${m.previewUrl || ""}`).join("\n")}`,
  )
  if (postIdFromMedia) return `${feedScope}\nig:${postIdFromMedia}`

  const postIdFromContent = extractInstagramPostIdFromText(entry.content || entry.summary || "")
  if (postIdFromContent) return `${feedScope}\nig:${postIdFromContent}`

  const normalizedUrl = normalizeUrl(entry.url || "")
  if (normalizedUrl) return `${feedScope}\nu:${normalizedUrl}`
  const text = normalizedText.slice(0, 220)
  const bucket = Math.floor((entry.publishedAt || 0) / (5 * 60 * 1000))
  return `${feedScope}\nt:${author}\n${text}\n${bucket}`
}

function richness(entry: Entry): number {
  const mediaCount = entry.media?.length || 0
  const contentLen = (stripHtml(entry.content || "").trim().length)
  const summaryLen = (entry.summary || "").trim().length
  const imageBonus = entry.imageUrl ? 40 : 0
  return mediaCount * 400 + contentLen + summaryLen + imageBonus
}

function hasSocialMediaSignal(entry: Entry): boolean {
  if (entry.imageUrl) return true
  const content = `${entry.content || ""}\n${entry.summary || ""}`.toLowerCase()
  if (/<img\b/i.test(content)) return true
  if (/https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp|gif|bmp|avif)(?:\?[^\s"'<>]*)?/i.test(content)) return true
  for (const media of entry.media || []) {
    if (media.type === "photo") return true
    const url = (media.url || "").toLowerCase()
    const preview = (media.previewUrl || "").toLowerCase()
    if (/\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(url)) return true
    if (/\.(jpg|jpeg|png|webp|gif|bmp|avif)(\?|$)/i.test(preview)) return true
    if (url.includes("pbs.twimg.com") || preview.includes("pbs.twimg.com")) return true
  }
  return false
}

function dedupeSocialEntriesFast(entries: Entry[]): Entry[] {
  const byKey = new Map<string, Entry>()
  for (const entry of entries) {
    const key = dedupeKey(entry)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, entry)
      continue
    }
    const merged = mergeEntries(existing, entry)
    const existingMedia = countDistinctMedia(existing)
    const incomingMedia = countDistinctMedia(entry)
    const existingRenderable = renderabilityScore(existing)
    const incomingRenderable = renderabilityScore(entry)
    const keepIncoming =
      incomingRenderable > existingRenderable ||
      (incomingRenderable === existingRenderable && incomingMedia > existingMedia) ||
      (incomingRenderable === existingRenderable && incomingMedia === existingMedia && (
        richness(entry) > richness(existing) ||
        ((entry.publishedAt || 0) > (existing.publishedAt || 0))
      ))
    byKey.set(key, keepIncoming ? { ...merged, ...entry, media: merged.media } : { ...merged, ...existing, media: merged.media })
  }
  const firstPass = Array.from(byKey.values()).sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))

  // Second pass: collapse same-feed entries with matching titles/content
  const titleCollapsed: Entry[] = []
  for (const entry of firstPass) {
    const idx = titleCollapsed.findIndex((existing) => {
      if (existing.feedId !== entry.feedId) return false
      const delta = Math.abs((existing.publishedAt || 0) - (entry.publishedAt || 0))
      if (delta > 30 * 24 * 60 * 60 * 1000) return false
      return titlesLikelySame(existing.title || "", entry.title || "")
    })
    if (idx === -1) {
      titleCollapsed.push(entry)
      continue
    }
    const existing = titleCollapsed[idx]
    const merged = mergeEntries(existing, entry)
    const existingRenderable = renderabilityScore(existing)
    const incomingRenderable = renderabilityScore(entry)
    const existingMediaCount = countDistinctMedia(existing)
    const incomingMediaCount = countDistinctMedia(entry)
    const keepIncoming =
      incomingRenderable > existingRenderable ||
      (incomingRenderable === existingRenderable && incomingMediaCount > existingMediaCount) ||
      (incomingRenderable === existingRenderable && incomingMediaCount === existingMediaCount && (
        richness(entry) > richness(existing) ||
        ((entry.publishedAt || 0) > (existing.publishedAt || 0))
      ))
    titleCollapsed[idx] = keepIncoming
      ? { ...merged, ...entry, media: merged.media }
      : { ...merged, ...existing, media: merged.media }
  }
  return titleCollapsed.sort((a, b) => (b.publishedAt || 0) - (a.publishedAt || 0))
}

export function dedupeSocialEntries(entries: Entry[]): Entry[] {
  // Large social/picture timelines can freeze the renderer with the full multi-pass pipeline.
  // Use a linear-time path first to keep tab switching responsive.
  if (entries.length > 180) {
    return dedupeSocialEntriesFast(entries)
  }

  const byKey = new Map<string, Entry>()
  for (const entry of entries) {
    const key = dedupeKey(entry)
    const existing = byKey.get(key)
    if (!existing) {
      byKey.set(key, entry)
      continue
    }
    const merged = mergeEntries(existing, entry)
    const existingHasMedia = hasSocialMediaSignal(existing)
    const incomingHasMedia = hasSocialMediaSignal(entry)
    const existingMediaCount = countDistinctMedia(existing)
    const incomingMediaCount = countDistinctMedia(entry)
    const keepIncoming =
      (incomingHasMedia && !existingHasMedia) ||
      (incomingHasMedia === existingHasMedia && incomingMediaCount > existingMediaCount) ||
      (incomingHasMedia === existingHasMedia && (
        richness(entry) > richness(existing) ||
        ((entry.publishedAt || 0) > (existing.publishedAt || 0))
      ))
    byKey.set(key, keepIncoming ? { ...merged, ...entry, media: merged.media } : { ...merged, ...existing, media: merged.media })
  }
  const firstPass = Array.from(byKey.values())

  // Second pass: aggressively collapse entries sharing the same lead media.
  // This handles mixed Picnob/Instagram variants where URL/text keys differ.
  const byLeadMedia = new Map<string, Entry>()
  for (const entry of firstPass) {
    const lead = getEntryLeadMediaKey(entry)
    if (!lead) {
      byLeadMedia.set(`no-media:${entry.id}`, entry)
      continue
    }
    const key = `lead:${entry.feedId}:${lead}`
    const existing = byLeadMedia.get(key)
    if (!existing) {
      byLeadMedia.set(key, entry)
      continue
    }
    const merged = mergeEntries(existing, entry)
    const existingMediaCount = countDistinctMedia(existing)
    const incomingMediaCount = countDistinctMedia(entry)
    const keepIncoming =
      incomingMediaCount > existingMediaCount ||
      (incomingMediaCount === existingMediaCount && (
        richness(entry) > richness(existing) ||
        ((entry.publishedAt || 0) > (existing.publishedAt || 0))
      ))
    byLeadMedia.set(key, keepIncoming ? { ...merged, ...entry, media: merged.media } : { ...merged, ...existing, media: merged.media })
  }

  const secondPass = Array.from(byLeadMedia.values())

  // Third pass: merge entries that share at least one normalized media URL.
  // This catches cases where lead media differs but the galleries overlap.
  const mediaKeyToRep = new Map<string, Entry>()
  const reps: Entry[] = []
  for (const entry of secondPass) {
    const mediaKeys = getEntryMediaKeys(entry)
    const matchedRep = mediaKeys.map((k) => mediaKeyToRep.get(`${entry.feedId}:${k}`)).find(Boolean) || null
    if (!matchedRep) {
      reps.push(entry)
      for (const key of mediaKeys) mediaKeyToRep.set(`${entry.feedId}:${key}`, entry)
      continue
    }

    const merged = mergeEntries(matchedRep, entry)
    const matchedMediaCount = countDistinctMedia(matchedRep)
    const incomingMediaCount = countDistinctMedia(entry)
    const keepIncoming =
      incomingMediaCount > matchedMediaCount ||
      (incomingMediaCount === matchedMediaCount && (
        richness(entry) > richness(matchedRep) ||
        ((entry.publishedAt || 0) > (matchedRep.publishedAt || 0))
      ))
    const winner = keepIncoming
      ? { ...merged, ...entry, media: merged.media }
      : { ...merged, ...matchedRep, media: merged.media }

    const repIndex = reps.findIndex((r) => r.id === matchedRep.id)
    if (repIndex >= 0) reps[repIndex] = winner
    for (const key of mediaKeys) mediaKeyToRep.set(`${entry.feedId}:${key}`, winner)
    for (const key of getEntryMediaKeys(winner)) mediaKeyToRep.set(`${winner.feedId}:${key}`, winner)
  }

  const thirdPass = reps.sort((a, b) => b.publishedAt - a.publishedAt)

  // Fourth pass: collapse mixed-source Picnob duplicates
  // (single-image pixnoy proxy item + richer multi-image picnob item).
  const final: Entry[] = []
  for (const entry of thirdPass) {
    const idx = final.findIndex((existing) => {
      if (existing.feedId !== entry.feedId) return false
      const delta = Math.abs((existing.publishedAt || 0) - (entry.publishedAt || 0))
      if (delta > 18 * 60 * 60 * 1000) return false
      const pairMatches =
        (isPixnoySingle(existing) && isRichGallery(entry)) ||
        (isPixnoySingle(entry) && isRichGallery(existing))
      if (!pairMatches) return false

      // Prefer explicit title match, but allow generic mirrored "Untitled" pairs.
      if (titlesLikelySame(existing.title || "", entry.title || "")) return true
      if (isGenericUntitledTitle(existing.title || "") && isGenericUntitledTitle(entry.title || "")) return true
      return false
    })
    if (idx === -1) {
      final.push(entry)
      continue
    }
    const existing = final[idx]
    const merged = mergeEntries(existing, entry)
    const keepIncoming =
      (isRichGallery(entry) && !isRichGallery(existing)) ||
      (isRichGallery(entry) === isRichGallery(existing) && (
        richness(entry) > richness(existing) ||
        ((entry.publishedAt || 0) > (existing.publishedAt || 0))
      ))
    final[idx] = keepIncoming ? { ...merged, ...entry, media: merged.media } : { ...merged, ...existing, media: merged.media }
  }

  const finalSorted = final.sort((a, b) => b.publishedAt - a.publishedAt)

  // Fifth pass: collapse same-feed entries with matching titles/content.
  // Instagram/Picnob mirrors often emit the same post as separate entries
  // with different URLs/media but identical or overlapping titles.
  const titleCollapsed: Entry[] = []
  for (const entry of finalSorted) {
    const idx = titleCollapsed.findIndex((existing) => {
      if (existing.feedId !== entry.feedId) return false
      const delta = Math.abs((existing.publishedAt || 0) - (entry.publishedAt || 0))
      if (delta > 30 * 24 * 60 * 60 * 1000) return false

      const titleMatch = titlesLikelySame(existing.title || "", entry.title || "")
      const aContent = contentPrefixKey(existing)
      const bContent = contentPrefixKey(entry)
      const contentMatch = !!aContent && !!bContent && (aContent.includes(bContent) || bContent.includes(aContent))
      return titleMatch || contentMatch
    })
    if (idx === -1) {
      titleCollapsed.push(entry)
      continue
    }
    const existing = titleCollapsed[idx]
    const merged = mergeEntries(existing, entry)
    const existingRenderable = renderabilityScore(existing)
    const incomingRenderable = renderabilityScore(entry)
    const existingMedia = countDistinctMedia(existing)
    const incomingMedia = countDistinctMedia(entry)
    const keepIncoming =
      incomingRenderable > existingRenderable ||
      (incomingRenderable === existingRenderable && incomingMedia > existingMedia) ||
      (incomingRenderable === existingRenderable && incomingMedia === existingMedia && (
        richness(entry) > richness(existing) ||
        ((entry.publishedAt || 0) > (existing.publishedAt || 0))
      ))
    titleCollapsed[idx] = keepIncoming
      ? { ...merged, ...entry, media: merged.media }
      : { ...merged, ...existing, media: merged.media }
  }

  const fifthPass = titleCollapsed.sort((a, b) => b.publishedAt - a.publishedAt)

  // Sixth pass: collapse near-duplicate rich variants from the same feed
  // (e.g. same post emitted twice with different media counts like 11 vs 36).
  const collapsed: Entry[] = []
  for (const entry of fifthPass) {
    const idx = collapsed.findIndex((existing) => {
      if (existing.feedId !== entry.feedId) return false
      const delta = Math.abs((existing.publishedAt || 0) - (entry.publishedAt || 0))
      if (delta > 24 * 60 * 60 * 1000) return false

      const titleMatch = titlesLikelySame(existing.title || "", entry.title || "")
      const aContent = contentPrefixKey(existing)
      const bContent = contentPrefixKey(entry)
      const contentMatch = !!aContent && !!bContent && (aContent.includes(bContent) || bContent.includes(aContent))
      if (!titleMatch && !contentMatch) return false

      const aMedia = countDistinctMedia(existing)
      const bMedia = countDistinctMedia(entry)
      return Math.max(aMedia, bMedia) >= Math.max(6, Math.min(aMedia, bMedia) * 2)
    })
    if (idx === -1) {
      collapsed.push(entry)
      continue
    }

    const existing = collapsed[idx]
    const merged = mergeEntries(existing, entry)
    const existingMedia = countDistinctMedia(existing)
    const incomingMedia = countDistinctMedia(entry)
    const existingRenderable = renderabilityScore(existing)
    const incomingRenderable = renderabilityScore(entry)
    const keepIncoming =
      incomingRenderable > existingRenderable ||
      (incomingRenderable === existingRenderable && incomingMedia > existingMedia) ||
      (incomingRenderable === existingRenderable && incomingMedia === existingMedia && (
        richness(entry) > richness(existing) ||
        ((entry.publishedAt || 0) > (existing.publishedAt || 0))
      ))
    collapsed[idx] = keepIncoming
      ? { ...merged, ...entry, media: merged.media }
      : { ...merged, ...existing, media: merged.media }
  }

  return collapsed.sort((a, b) => b.publishedAt - a.publishedAt)
}


