import { buildYoutubeIframeUrl, extractYouTubeId } from '@livo/utils'

type YoutubeStatusApi = {
  ytStatus: () => Promise<{ loggedIn: boolean; name: string | null }>
  resolve: (
    url: string,
  ) => Promise<{ success: boolean; url?: string; error?: string }>
}

type YoutubePlaybackResult =
  | { kind: 'direct'; url: string }
  | { kind: 'iframe'; url: string }

// Backwards-compatible alias — call sites historically used this name.
const extractYoutubeVideoId = extractYouTubeId

export async function resolveYoutubePlayback(
  api: YoutubeStatusApi,
  url: string,
): Promise<YoutubePlaybackResult> {
  const videoId = extractYoutubeVideoId(url)
  if (!videoId) {
    throw new Error(`Invalid YouTube URL: ${url}`)
  }

  const iframeUrl = buildYoutubeIframeUrl(videoId)

  try {
    const status = await api.ytStatus()
    if (status.loggedIn) {
      return { kind: 'iframe', url: iframeUrl }
    }
  } catch {
    // Ignore login-state probe failures and continue with direct resolution.
  }

  try {
    const result = await api.resolve(url)
    if (result.success && result.url) {
      return { kind: 'direct', url: result.url }
    }
  } catch {
    // Fall back to iframe below.
  }

  return { kind: 'iframe', url: iframeUrl }
}

export { buildYoutubeIframeUrl, extractYoutubeVideoId }
