import type { Entry } from '../../../shared/types'
import {
  getRememberedImageMetadata,
  loadPersistedImageMetadata,
  probeImageMetadata,
  seedRememberedImageMetadata,
} from './image-metadata'

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
export const rememberedMasonrySizeByUrl = {
  get: (url: string) => getRememberedImageMetadata(url),
  has: (url: string) => !!getRememberedImageMetadata(url),
}

export function loadPersistedMasonrySizes() {
  loadPersistedImageMetadata()
}

export function schedulePersistedMasonrySizes() {
  // Persistence is handled centrally by image-metadata.ts.
}

export function getMasonryCardAspectRatio(card: MasonryCardData): number {
  if (card.width && card.height) return card.width / card.height
  const remembered = getRememberedImageMetadata(card.firstImage)
  if (remembered?.width && remembered?.height)
    return remembered.width / remembered.height
  return MASONRY_FALLBACK_ASPECT_RATIO
}

export function buildMasonryColumns(
  cards: MasonryCardData[],
  columnCount: number,
): MasonryCardData[][] {
  const safeColumnCount = Math.max(1, columnCount || 1)
  const cols: MasonryCardData[][] = Array.from(
    { length: safeColumnCount },
    () => [],
  )
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
  const pairs: Array<{ url: string; width?: number; height?: number }> = []
  for (const entry of entries) {
    for (const media of entry.media || []) {
      if (media.type !== 'photo') continue
      const url = decodeMediaUrl(media.previewUrl || media.url || '')
      const width = Math.round(Number(media.width) || 0)
      const height = Math.round(Number(media.height) || 0)
      if (!url || width <= 0 || height <= 0) continue
      pairs.push({ url, width, height })
    }
  }
  return seedRememberedImageMetadata(pairs)
}

export function probeMasonryCardDimensions(
  cards: MasonryCardData[],
  onResolved: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {}

  const queue = cards
    .map((card) => card.firstImage)
    .filter((url) => !!url && !rememberedMasonrySizeByUrl.has(url))

  return probeImageMetadata(queue, onResolved)
}
