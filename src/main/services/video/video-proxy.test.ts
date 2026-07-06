import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  selectBestInvidiousStream,
  selectPipedStream,
  type InvidiousVideoResponse,
  type PipedVideoResponse,
} from '@shared/video-url'

const mocks = vi.hoisted(() => ({
  assertNetworkFetchUrl: vi.fn(async (url: string) => url),
}))

// `video-proxy` imports `electron` for its default `net`-backed fetcher; the
// tests always inject a mock fetcher, so a stub module is enough.
vi.mock('electron', () => ({ net: { request: vi.fn() } }))

vi.mock('../system/network-url-policy', () => ({
  assertNetworkFetchUrl: mocks.assertNetworkFetchUrl,
}))

import { resolveVideoUrl, type JsonFetcher } from './video-proxy'

const YT_URL = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'

describe('selectBestInvidiousStream', () => {
  it('prefers the highest-quality mp4 stream', () => {
    const data: InvidiousVideoResponse = {
      title: 'T',
      formatStreams: [
        { url: 'a', container: 'mp4', quality: '360p' },
        { url: 'b', container: 'mp4', quality: '720p' },
        { url: 'c', container: 'webm', quality: '1080p' },
      ],
    }
    expect(selectBestInvidiousStream(data)).toEqual({
      url: 'b',
      quality: '720p',
    })
  })

  it('falls back to the first stream when no mp4 present', () => {
    const data: InvidiousVideoResponse = {
      formatStreams: [{ url: 'x', container: 'webm', quality: '480p' }],
    }
    expect(selectBestInvidiousStream(data)).toEqual({
      url: 'x',
      quality: '480p',
    })
  })

  it('returns null when there are no formatStreams', () => {
    expect(selectBestInvidiousStream({ formatStreams: [] })).toBeNull()
    expect(selectBestInvidiousStream({})).toBeNull()
  })
})

describe('selectPipedStream', () => {
  it('prefers the HLS manifest', () => {
    const data: PipedVideoResponse = {
      hls: 'https://piped/hls.m3u8',
      videoStreams: [
        { url: 'v', mimeType: 'video/mp4', quality: '720p', videoOnly: false },
      ],
    }
    expect(selectPipedStream(data)).toEqual({
      url: 'https://piped/hls.m3u8',
      quality: 'auto (HLS)',
    })
  })

  it('falls back to best combined mp4 video stream when no HLS', () => {
    const data: PipedVideoResponse = {
      videoStreams: [
        { url: 'lo', mimeType: 'video/mp4', quality: '360p', videoOnly: false },
        {
          url: 'hi',
          mimeType: 'video/mp4',
          quality: '1080p',
          videoOnly: false,
        },
        { url: 'vo', mimeType: 'video/mp4', quality: '2160p', videoOnly: true },
      ],
    }
    expect(selectPipedStream(data)).toEqual({ url: 'hi', quality: '1080p' })
  })

  it('returns null when only video-only streams exist', () => {
    const data: PipedVideoResponse = {
      videoStreams: [
        { url: 'vo', mimeType: 'video/mp4', quality: '720p', videoOnly: true },
      ],
    }
    expect(selectPipedStream(data)).toBeNull()
  })
})

describe('resolveVideoUrl', () => {
  beforeEach(() => {
    mocks.assertNetworkFetchUrl.mockReset()
    mocks.assertNetworkFetchUrl.mockImplementation(async (url: string) => url)
  })

  it('rejects non-YouTube URLs without fetching', async () => {
    const fetcher = vi.fn()
    const result = await resolveVideoUrl('https://example.com/page', fetcher)
    expect(result.success).toBe(false)
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('resolves via the first healthy Invidious instance', async () => {
    const fetcher: JsonFetcher = vi.fn(
      async () =>
        ({
          title: 'Hello',
          formatStreams: [
            {
              url: 'https://inv/stream.mp4',
              container: 'mp4',
              quality: '720p',
            },
          ],
        }) as unknown as never,
    )
    const result = await resolveVideoUrl(YT_URL, fetcher)
    expect(result).toMatchObject({
      success: true,
      url: 'https://inv/stream.mp4',
      quality: '720p',
      title: 'Hello',
    })
    // First instance succeeded — only one call.
    expect((fetcher as ReturnType<typeof vi.fn>).mock.calls.length).toBe(1)
  })

  it('skips failing Invidious instances and uses a later one', async () => {
    const calls: string[] = []
    const fetcher: JsonFetcher = vi.fn(async (url: string) => {
      calls.push(url)
      if (calls.length < 3) throw new Error('HTTP 503')
      return {
        title: 'Late',
        formatStreams: [
          { url: 'https://inv3/s.mp4', container: 'mp4', quality: '480p' },
        ],
      } as unknown as never
    })
    const result = await resolveVideoUrl(YT_URL, fetcher)
    expect(result.success).toBe(true)
    expect(result.url).toBe('https://inv3/s.mp4')
    expect(calls.length).toBe(3)
  })

  it('skips selected streams blocked by network policy', async () => {
    mocks.assertNetworkFetchUrl.mockImplementation(async (url: string) => {
      if (url.includes('127.0.0.1')) throw new Error('blocked')
      return url
    })
    const fetcher: JsonFetcher = vi.fn(async (url: string) => {
      if (url.includes('/api/v1/videos/')) {
        return {
          title: 'Policy',
          formatStreams: [
            {
              url:
                (fetcher as ReturnType<typeof vi.fn>).mock.calls.length === 1
                  ? 'https://127.0.0.1/stream.mp4'
                  : 'https://cdn.example/stream.mp4',
              container: 'mp4',
              quality: '720p',
            },
          ],
        } as unknown as never
      }
      throw new Error('unexpected fallback')
    })

    const result = await resolveVideoUrl(YT_URL, fetcher)

    expect(result).toMatchObject({
      success: true,
      url: 'https://cdn.example/stream.mp4',
      quality: '720p',
    })
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('falls back to Piped when all Invidious instances fail', async () => {
    const fetcher: JsonFetcher = vi.fn(async (url: string) => {
      if (url.includes('/api/v1/videos/')) throw new Error('invidious down')
      // Piped streams endpoint
      return {
        title: 'Piped',
        hls: 'https://piped/manifest.m3u8',
      } as unknown as never
    })
    const result = await resolveVideoUrl(YT_URL, fetcher)
    expect(result).toMatchObject({
      success: true,
      url: 'https://piped/manifest.m3u8',
      quality: 'auto (HLS)',
    })
  })

  it('reports failure when both Invidious and Piped fail', async () => {
    const fetcher: JsonFetcher = vi.fn(async () => {
      throw new Error('network')
    })
    const result = await resolveVideoUrl(YT_URL, fetcher)
    expect(result.success).toBe(false)
    expect(result.error).toContain('Could not resolve video')
  })
})
