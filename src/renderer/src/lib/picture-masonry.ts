import type { Entry } from "../../../shared/types"

export interface MasonryCardData {
  id: string
  feedId: string
  firstImage: string
  width?: number
  height?: number
  blurhash?: string
  photoCount: number
  publishedAt: number
}

const MASONRY_FALLBACK_ASPECT_RATIO = 4 / 5
const MASONRY_DIMENSION_CACHE_STORAGE_KEY = "livo:masonry-image-dimensions:v1"
const MASONRY_DIMENSION_CACHE_LIMIT = 800

export const rememberedMasonrySizeByUrl = new Map<string, { width: number; height: number }>()
export const pendingMasonryProbeUrls = new Set<string>()

let hasLoadedPersistedMasonrySizes = false
let persistMasonrySizesTimer: number | null = null
const MASONRY_PROBE_CONCURRENCY = 4

export function loadPersistedMasonrySizes() {
  if (hasLoadedPersistedMasonrySizes || typeof window === "undefined") return
  hasLoadedPersistedMasonrySizes = true
  try {
    const raw = window.localStorage.getItem(MASONRY_DIMENSION_CACHE_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, { width?: number; height?: number }>
    for (const [url, size] of Object.entries(parsed || {})) {
      const width = Math.round(Number(size?.width) || 0)
      const height = Math.round(Number(size?.height) || 0)
      if (!url || width <= 0 || height <= 0) continue
      rememberedMasonrySizeByUrl.set(url, { width, height })
    }
  } catch {
    // Ignore malformed local cache.
  }
}

export function schedulePersistedMasonrySizes() {
  if (typeof window === "undefined") return
  if (persistMasonrySizesTimer !== null) window.clearTimeout(persistMasonrySizesTimer)
  persistMasonrySizesTimer = window.setTimeout(() => {
    persistMasonrySizesTimer = null
    try {
      const entries = Array.from(rememberedMasonrySizeByUrl.entries()).slice(-MASONRY_DIMENSION_CACHE_LIMIT)
      const payload = Object.fromEntries(entries)
      window.localStorage.setItem(MASONRY_DIMENSION_CACHE_STORAGE_KEY, JSON.stringify(payload))
    } catch {
      // Ignore storage quota / serialization failures.
    }
  }, 120)
}

export function getMasonryCardAspectRatio(card: MasonryCardData): number {
  if (card.width && card.height) return card.width / card.height
  const remembered = rememberedMasonrySizeByUrl.get(card.firstImage)
  if (remembered?.width && remembered?.height) return remembered.width / remembered.height
  return MASONRY_FALLBACK_ASPECT_RATIO
}

export function buildMasonryColumns(cards: MasonryCardData[], columnCount: number): MasonryCardData[][] {
  const safeColumnCount = Math.max(1, columnCount || 1)
  const cols: MasonryCardData[][] = Array.from({ length: safeColumnCount }, () => [])
  const heights = Array.from({ length: safeColumnCount }, () => 0)

  for (const card of cards) {
    const aspectRatio = Math.max(0.2, getMasonryCardAspectRatio(card))
    const estimatedHeight = 1 / aspectRatio
    let targetIndex = 0
    for (let i = 1; i < safeColumnCount; i += 1) {
      if (heights[i] < heights[targetIndex]) targetIndex = i
    }
    cols[targetIndex].push(card)
    heights[targetIndex] += estimatedHeight
  }

  return cols
}

export function seedRememberedMasonrySizesFromEntries(
  entries: Entry[],
  decodeMediaUrl: (raw: string) => string,
): boolean {
  let changed = false
  for (const entry of entries) {
    for (const media of entry.media || []) {
      if (media.type !== "photo") continue
      const url = decodeMediaUrl(media.previewUrl || media.url || "")
      const width = Math.round(Number(media.width) || 0)
      const height = Math.round(Number(media.height) || 0)
      if (!url || width <= 0 || height <= 0) continue

      const prev = rememberedMasonrySizeByUrl.get(url)
      if (prev?.width === width && prev?.height === height) continue
      rememberedMasonrySizeByUrl.set(url, { width, height })
      changed = true
    }
  }
  return changed
}

export function probeMasonryCardDimensions(
  cards: MasonryCardData[],
  onResolved: () => void,
): () => void {
  if (typeof window === "undefined") return () => {}

  const queue = cards
    .map((card) => card.firstImage)
    .filter((url) => !!url && !rememberedMasonrySizeByUrl.has(url) && !pendingMasonryProbeUrls.has(url))

  if (queue.length === 0) return () => {}

  let cancelled = false
  let active = 0
  let cursor = 0

  const pump = () => {
    if (cancelled) return
    while (active < MASONRY_PROBE_CONCURRENCY && cursor < queue.length) {
      const url = queue[cursor++]!
      pendingMasonryProbeUrls.add(url)
      active += 1

      const probe = new window.Image()
      probe.decoding = "async"
      probe.referrerPolicy = "no-referrer"
      const finalize = () => {
        pendingMasonryProbeUrls.delete(url)
        active -= 1
        pump()
      }
      probe.onload = () => {
        if (!cancelled && probe.naturalWidth > 0 && probe.naturalHeight > 0) {
          rememberedMasonrySizeByUrl.set(url, { width: probe.naturalWidth, height: probe.naturalHeight })
          schedulePersistedMasonrySizes()
          onResolved()
        }
        finalize()
      }
      probe.onerror = finalize
      probe.src = url
    }
  }

  pump()
  return () => {
    cancelled = true
  }
}
