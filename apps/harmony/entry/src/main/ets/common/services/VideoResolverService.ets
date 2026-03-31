import http from '@ohos.net.http'
import { buildYouTubeWebFallbackUrl } from '../utils/YouTubePlaybackUrl'
import { resolveFirstNonEmpty } from '../utils/AsyncResolution'
import {
  InvidiousFormatStream,
  PipedStream,
  selectInvidiousPlayableUrl,
  selectPipedPlayableUrl,
} from '../utils/VideoPlayableSelection'

export interface YouTubePlaybackResolution {
  playableUrl: string
  fallbackUrl: string
  sourceLabel: string
}

const INVIDIOUS_INSTANCES: string[] = [
  'https://inv.tux.pizza',
  'https://invidious.privacyredirect.com',
  'https://invidious.nerdvpn.de',
  'https://iv.nbooo.com',
  'https://invidious.protokolla.fi',
]

const PIPED_INSTANCES: string[] = [
  'https://pipedapi.kavin.rocks',
  'https://piped-api.privacy.com.de',
  'https://api.piped.projectsegfau.lt',
]

const DIRECT_PLAYBACK_TIMEOUT_MS: number = 7000
const REQUEST_CONNECT_TIMEOUT_MS: number = 3500
const REQUEST_READ_TIMEOUT_MS: number = 4500

export class VideoResolverService {
  static extractYouTubeVideoId(value: string): string {
    const matched = (value || '').match(
      /(?:youtube\.com\/(?:watch\?(?:[^#\s]*&)?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/i,
    )
    return matched?.[1] ?? ''
  }

  static buildWebFallbackUrl(videoUrl: string): string {
    return buildYouTubeWebFallbackUrl(videoUrl)
  }

  static async resolveYouTubePlayback(videoUrl: string): Promise<YouTubePlaybackResolution> {
    const videoId = VideoResolverService.extractYouTubeVideoId(videoUrl)
    const fallbackUrl = VideoResolverService.buildWebFallbackUrl(videoUrl)

    if (!videoId) {
      return {
        playableUrl: '',
        fallbackUrl: '',
        sourceLabel: 'invalid',
      }
    }

    const directPlayable = await VideoResolverService.resolveDirectPlayableUrl(videoId)
    if (directPlayable) {
      return {
        playableUrl: directPlayable,
        fallbackUrl,
        sourceLabel: 'direct',
      }
    }

    return {
      playableUrl: '',
      fallbackUrl,
      sourceLabel: 'youtube-web',
    }
  }

  private static async resolveDirectPlayableUrl(videoId: string): Promise<string> {
    return Promise.race([
      VideoResolverService.tryResolveDirectPlayableUrl(videoId),
      new Promise<string>((resolve: (value: string) => void) => {
        setTimeout(() => resolve(''), DIRECT_PLAYBACK_TIMEOUT_MS)
      }),
    ])
  }

  private static async tryResolveDirectPlayableUrl(videoId: string): Promise<string> {
    const invidiousPlayable = await VideoResolverService.resolveViaInvidious(videoId)
    if (invidiousPlayable) {
      return invidiousPlayable
    }

    return VideoResolverService.resolveViaPiped(videoId)
  }

  private static async fetchJson(url: string, referer?: string): Promise<string> {
    const request = http.createHttp()
    try {
      const header: Record<string, string> = {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'application/json, text/plain, */*',
      }
      if (referer) {
        header['Referer'] = referer
        header['Origin'] = referer
      }

      const response = await request.request(url, {
        method: http.RequestMethod.GET,
        connectTimeout: REQUEST_CONNECT_TIMEOUT_MS,
        readTimeout: REQUEST_READ_TIMEOUT_MS,
        header,
      })
      return response.responseCode === 200 ? String(response.result) : ''
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }

  private static async resolveViaInvidious(videoId: string): Promise<string> {
    return resolveFirstNonEmpty(INVIDIOUS_INSTANCES.map((instance: string) => {
      return async (): Promise<string> => {
        try {
          const raw = await VideoResolverService.fetchJson(
            `${instance}/api/v1/videos/${videoId}?fields=formatStreams,title`,
            instance,
          )
          if (!raw) {
            return ''
          }

          const payload = JSON.parse(raw) as Record<string, Object>
          const formatStreams = payload['formatStreams'] as InvidiousFormatStream[] | undefined
          if (!formatStreams || formatStreams.length === 0) {
            return ''
          }

          return selectInvidiousPlayableUrl(formatStreams)
        } catch (_) {
          return ''
        }
      }
    }))
  }

  private static async resolveViaPiped(videoId: string): Promise<string> {
    return resolveFirstNonEmpty(PIPED_INSTANCES.map((instance: string) => {
      return async (): Promise<string> => {
        try {
          const raw = await VideoResolverService.fetchJson(`${instance}/streams/${videoId}`, instance)
          if (!raw) {
            return ''
          }

          const payload = JSON.parse(raw) as Record<string, Object | string>
          const hls = typeof payload['hls'] === 'string' ? payload['hls'] : ''
          const videoStreams = payload['videoStreams'] as PipedStream[] | undefined
          return selectPipedPlayableUrl(hls, videoStreams ?? [])
        } catch (_) {
          return ''
        }
      }
    }))
  }
}
