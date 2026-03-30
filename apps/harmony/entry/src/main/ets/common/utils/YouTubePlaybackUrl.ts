function extractYouTubeVideoId(value: string): string {
  const matched = (value || '').match(
    /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
  )
  return matched?.[1] ?? ''
}

export function buildYouTubeWebFallbackUrl(videoUrl: string): string {
  const videoId = extractYouTubeVideoId(videoUrl)
  if (!videoId) {
    return ''
  }
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?controls=1&autoplay=1&mute=0&playsinline=1&rel=0`
}
