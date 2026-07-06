import { describe, expect, it } from 'vitest'
import {
  isAllowedPlaybackMediaSrcset,
  isAllowedPlaybackMediaUrl,
} from './media-source-policy'

describe('media-source-policy', () => {
  it('allows ordinary public http media URLs', () => {
    expect(isAllowedPlaybackMediaUrl('https://example.com/video.mp4')).toBe(
      true,
    )
  })

  it.each([
    'http://127.0.0.1/audio.mp3',
    'http://localhost/audio.mp3',
    'http://10.0.0.5/audio.mp3',
    'http://172.16.0.10/audio.mp3',
    'http://192.168.1.20/audio.mp3',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/video.mp4',
    'http://[::ffff:127.0.0.1]/video.mp4',
  ])('blocks private or loopback media URL %s', (url) => {
    expect(isAllowedPlaybackMediaUrl(url)).toBe(false)
  })

  it('blocks unsupported or credentialed media URLs', () => {
    expect(isAllowedPlaybackMediaUrl('file:///tmp/movie.mp4')).toBe(false)
    expect(isAllowedPlaybackMediaUrl('data:video/mp4;base64,aaaa')).toBe(false)
    expect(
      isAllowedPlaybackMediaUrl('https://user:pass@example.com/a.mp3'),
    ).toBe(false)
  })

  it('validates every URL in a playback media srcset', () => {
    expect(
      isAllowedPlaybackMediaSrcset(
        'https://cdn.example.com/a.jpg 1x, https://cdn.example.com/a@2x.jpg 2x',
      ),
    ).toBe(true)
    expect(
      isAllowedPlaybackMediaSrcset(
        'https://cdn.example.com/a.jpg 1x, http://127.0.0.1/a.jpg 2x',
      ),
    ).toBe(false)
  })
})
