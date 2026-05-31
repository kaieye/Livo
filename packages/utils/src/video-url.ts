/**
 * Shared video URL parsing + stream-selection helpers.
 *
 * Previously these regexes and instance lists were duplicated across the
 * desktop main process (`video-proxy.ts`) and several renderer modules
 * (`youtube-playback.ts`, `entry-video-source.ts`, `MediaPlayer.tsx`, ...).
 * Centralising them here keeps detection consistent on both ends and makes the
 * Invidious/Piped selection logic unit-testable in isolation.
 */

// ── YouTube ───────────────────────────────────────────────────────────────

// Matches the 11-char video id from watch / embed / shorts / youtu.be forms.
// `watch\?.*v=` tolerates other query params appearing before `v=`.
const YOUTUBE_ID_RE =
  /(?:youtube\.com\/(?:watch\?.*v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/

/** Extract a YouTube video id from a URL. Returns `null` for non-YouTube URLs. */
export function extractYouTubeId(url: string): string | null {
  const match = (url || '').match(YOUTUBE_ID_RE)
  return match?.[1] ?? null
}

/** Build a privacy-friendly YouTube embed iframe URL for a given video id. */
export function buildYoutubeIframeUrl(videoId: string): string {
  return `https://www.youtube.com/embed/${videoId}?controls=1&autoplay=1&mute=0`
}

// ── Direct / embeddable detection ───────────────────────────────────────────

const DIRECT_VIDEO_RE = /\.(mp4|webm|ogg|mov)(\?|$)/i

/**
 * Whether a URL points at a directly-playable video file (mp4/webm/ogg/mov)
 * that a native `<video>` element can load without an embed shim.
 */
export function isDirectVideoUrl(url: string): boolean {
  return DIRECT_VIDEO_RE.test(url || '')
}

const EMBEDDABLE_VIDEO_RE =
  /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|bilibili\.com\/video\/|b23\.tv\/|vimeo\.com\/\d+|ted\.com\/talks\/|download\.ted\.com\/)/i

/**
 * Whether a URL is from a platform we know how to embed/resolve (YouTube,
 * Bilibili, Vimeo, TED). Used to decide if an entry's own `url` is playable.
 */
export function isEmbeddableVideoUrl(url: string): boolean {
  return EMBEDDABLE_VIDEO_RE.test(url || '')
}

// ── Resolver instances (tried in order, skip to next on failure) ────────────

export const INVIDIOUS_INSTANCES = [
  'https://inv.tux.pizza',
  'https://invidious.privacyredirect.com',
  'https://invidious.nerdvpn.de',
  'https://iv.nbooo.com',
  'https://invidious.protokolla.fi',
]

export const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://api.piped.projectsegfau.lt',
]

// ── Stream shapes + selection ───────────────────────────────────────────────

export interface InvidiousFormatStream {
  url: string
  itag?: string
  type?: string
  quality?: string
  container?: string
  resolution?: string
}

export interface InvidiousVideoResponse {
  formatStreams?: InvidiousFormatStream[]
  adaptiveFormats?: InvidiousFormatStream[]
  title?: string
}

export interface PipedStream {
  url: string
  format?: string
  quality?: string
  mimeType?: string
  videoOnly?: boolean
}

export interface PipedVideoResponse {
  audioStreams?: PipedStream[]
  videoStreams?: PipedStream[]
  title?: string
  /** HLS manifest URL — playable by `<video>` directly. */
  hls?: string
}

export interface SelectedStream {
  url: string
  quality: string
}

/** Parse a quality string like "720p" into a numeric height for comparison. */
export function qualityToNumber(quality: string | undefined): number {
  const match = (quality || '').match(/(\d+)/)
  return match ? Number.parseInt(match[1], 10) : 0
}

/**
 * Pick the best combined (audio+video) mp4 stream from an Invidious response.
 * Prefers mp4 container, highest resolution. Returns `null` if none usable.
 */
export function selectBestInvidiousStream(
  data: InvidiousVideoResponse,
): SelectedStream | null {
  const streams = data.formatStreams ?? []
  if (streams.length === 0) return null

  const mp4Streams = streams
    .filter((s) => s.container === 'mp4' || s.type?.includes('video/mp4'))
    .sort((a, b) => qualityToNumber(b.quality) - qualityToNumber(a.quality))

  const best = mp4Streams[0] ?? streams[0]
  if (!best?.url) return null

  return {
    url: best.url,
    quality: best.quality || best.resolution || 'unknown',
  }
}

/**
 * Pick a playable stream from a Piped response. Prefers the HLS manifest
 * (audio+video), then falls back to the best combined mp4 video stream.
 * Returns `null` if nothing usable is present.
 */
export function selectPipedStream(
  data: PipedVideoResponse,
): SelectedStream | null {
  if (data.hls) {
    return { url: data.hls, quality: 'auto (HLS)' }
  }

  const combined = (data.videoStreams ?? [])
    .filter((s) => !s.videoOnly && s.mimeType?.includes('video/mp4'))
    .sort((a, b) => qualityToNumber(b.quality) - qualityToNumber(a.quality))

  const best = combined[0]
  if (!best?.url) return null

  return { url: best.url, quality: best.quality || 'unknown' }
}
