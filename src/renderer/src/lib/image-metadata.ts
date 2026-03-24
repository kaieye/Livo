export interface ImageMetadata {
  width: number
  height: number
}

const IMAGE_METADATA_STORAGE_KEY = 'livo:image-metadata:v1'
const IMAGE_METADATA_LIMIT = 1200

const imageMetadataByUrl = new Map<string, ImageMetadata>()
const pendingImageProbeUrls = new Set<string>()

let hasLoadedPersistedImageMetadata = false
let persistImageMetadataTimer: number | null = null

function normalizeImageMetadata(
  input?: Partial<ImageMetadata> | null,
): ImageMetadata | null {
  const width = Math.round(Number(input?.width) || 0)
  const height = Math.round(Number(input?.height) || 0)
  if (width <= 0 || height <= 0) return null
  return { width, height }
}

export function getRememberedImageMetadata(
  url: string,
): ImageMetadata | undefined {
  if (!url) return undefined
  return imageMetadataByUrl.get(url)
}

export function hasRememberedImageMetadata(url: string): boolean {
  return !!getRememberedImageMetadata(url)
}

export function loadPersistedImageMetadata(): void {
  if (hasLoadedPersistedImageMetadata || typeof window === 'undefined') return
  hasLoadedPersistedImageMetadata = true

  try {
    const raw = window.localStorage.getItem(IMAGE_METADATA_STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw) as Record<string, Partial<ImageMetadata>>
    for (const [url, value] of Object.entries(parsed || {})) {
      const normalized = normalizeImageMetadata(value)
      if (!url || !normalized) continue
      imageMetadataByUrl.set(url, normalized)
    }
  } catch {
    // Ignore malformed cache payloads.
  }
}

export function schedulePersistedImageMetadata(): void {
  if (typeof window === 'undefined') return
  if (persistImageMetadataTimer !== null) {
    window.clearTimeout(persistImageMetadataTimer)
  }
  persistImageMetadataTimer = window.setTimeout(() => {
    persistImageMetadataTimer = null
    try {
      const entries = Array.from(imageMetadataByUrl.entries()).slice(
        -IMAGE_METADATA_LIMIT,
      )
      window.localStorage.setItem(
        IMAGE_METADATA_STORAGE_KEY,
        JSON.stringify(Object.fromEntries(entries)),
      )
    } catch {
      // Ignore storage quota / serialization failures.
    }
  }, 120)
}

export function rememberImageMetadata(
  url: string,
  metadata: Partial<ImageMetadata> | null | undefined,
): boolean {
  if (!url) return false
  const normalized = normalizeImageMetadata(metadata)
  if (!normalized) return false
  const prev = imageMetadataByUrl.get(url)
  if (prev?.width === normalized.width && prev?.height === normalized.height)
    return false
  imageMetadataByUrl.set(url, normalized)
  schedulePersistedImageMetadata()
  return true
}

export function probeImageMetadata(
  urls: string[],
  onResolved?: () => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const queue = urls.filter(
    (url) =>
      !!url &&
      !hasRememberedImageMetadata(url) &&
      !pendingImageProbeUrls.has(url),
  )
  if (queue.length === 0) return () => {}

  let cancelled = false
  for (const url of queue) {
    pendingImageProbeUrls.add(url)
    const probe = new window.Image()
    probe.decoding = 'async'
    probe.referrerPolicy = 'no-referrer'
    const finalize = () => {
      pendingImageProbeUrls.delete(url)
    }
    probe.onload = () => {
      if (
        !cancelled &&
        rememberImageMetadata(url, {
          width: probe.naturalWidth,
          height: probe.naturalHeight,
        })
      ) {
        onResolved?.()
      }
      finalize()
    }
    probe.onerror = finalize
    probe.src = url
  }

  return () => {
    cancelled = true
  }
}

export function seedRememberedImageMetadata(
  pairs: Array<{ url: string; width?: number; height?: number }>,
): boolean {
  let changed = false
  for (const pair of pairs) {
    changed = rememberImageMetadata(pair.url, pair) || changed
  }
  return changed
}
