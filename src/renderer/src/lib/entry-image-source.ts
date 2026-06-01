import type { Entry, MediaItem } from '../../../shared/types'

export type EntryImage = {
  url: string
  previewUrl?: string
  width?: number
  height?: number
}

// Minimal photo extraction for the standalone ImageViewer page.
// Mirrors `entry-video-source.ts` shape — we trust the entry's declared media
// rather than re-running the heavy social-feed dedupe/filter pipeline in
// WideViewContent (which exists to handle Instagram/Picnob carousel quirks
// inside the in-place overlay). Fall back to `entry.imageUrl` so a hero-only
// entry still yields one viewable image. P3 carry-over: unify with the
// WideViewContent extractor once that surface is refactored.
export function resolveEntryImages(
  entry: Pick<Entry, 'imageUrl'> & { media?: MediaItem[] },
): EntryImage[] {
  const photos = (entry.media ?? [])
    .filter((m): m is MediaItem => m.type === 'photo' && !!m.url)
    .map((m) => ({
      url: m.url,
      previewUrl: m.previewUrl,
      width: m.width,
      height: m.height,
    }))

  if (photos.length > 0) return photos

  if (entry.imageUrl) {
    return [{ url: entry.imageUrl }]
  }
  return []
}
