function extractYouTubeVideoId(value: string): string {
  const matched = (value || '').match(
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  )
  return matched?.[1] ?? ''
}

const INVIDIOUS_EMBED_INSTANCE = 'https://invidious.fdn.fr'

export function buildYouTubeWebFallbackUrl(videoUrl: string): string {
  const videoId = extractYouTubeVideoId(videoUrl)
  if (!videoId) {
    return ''
  }
  return `${INVIDIOUS_EMBED_INSTANCE}/embed/${encodeURIComponent(videoId)}?autoplay=1&local=true`
}
