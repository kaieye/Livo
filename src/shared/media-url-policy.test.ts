import { describe, expect, it } from 'vitest'
import {
  isAllowedStoredMediaSrcset,
  isAllowedStoredMediaUrl,
} from './media-url-policy'

describe('media URL policy', () => {
  it('allows ordinary public http media URLs', () => {
    expect(isAllowedStoredMediaUrl('https://example.com/video.mp4')).toBe(true)
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
    expect(isAllowedStoredMediaUrl(url)).toBe(false)
  })

  it('blocks unsupported or credentialed media URLs', () => {
    expect(isAllowedStoredMediaUrl('file:///tmp/movie.mp4')).toBe(false)
    expect(isAllowedStoredMediaUrl('data:video/mp4;base64,aaaa')).toBe(false)
    expect(isAllowedStoredMediaUrl('https://user:pass@example.com/a.mp3')).toBe(
      false,
    )
  })

  it('validates every URL in a stored media srcset', () => {
    expect(
      isAllowedStoredMediaSrcset(
        'https://cdn.example.com/a.jpg 1x, https://cdn.example.com/a@2x.jpg 2x',
      ),
    ).toBe(true)
    expect(
      isAllowedStoredMediaSrcset(
        'https://cdn.example.com/a.jpg 1x, http://127.0.0.1/a.jpg 2x',
      ),
    ).toBe(false)
  })
})
