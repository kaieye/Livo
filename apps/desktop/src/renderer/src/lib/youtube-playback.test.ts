import { describe, expect, it, vi } from 'vitest'

import { resolveYoutubePlayback } from './youtube-playback'

describe('resolveYoutubePlayback', () => {
  it('uses youtube iframe directly when the account is already linked', async () => {
    const resolve = vi.fn()
    const result = await resolveYoutubePlayback(
      {
        ytStatus: vi.fn().mockResolvedValue({ loggedIn: true, name: 'Livo' }),
        resolve,
      },
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    )

    expect(resolve).not.toHaveBeenCalled()
    expect(result).toEqual({
      kind: 'iframe',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=1&autoplay=1&mute=0',
    })
  })

  it('prefers the resolved direct media url when the account is not linked', async () => {
    const result = await resolveYoutubePlayback(
      {
        ytStatus: vi.fn().mockResolvedValue({ loggedIn: false, name: null }),
        resolve: vi.fn().mockResolvedValue({
          success: true,
          url: 'https://cdn.example.com/video.mp4',
        }),
      },
      'https://youtu.be/dQw4w9WgXcQ',
    )

    expect(result).toEqual({
      kind: 'direct',
      url: 'https://cdn.example.com/video.mp4',
    })
  })

  it('falls back to the youtube iframe when direct resolution fails', async () => {
    const result = await resolveYoutubePlayback(
      {
        ytStatus: vi.fn().mockResolvedValue({ loggedIn: false, name: null }),
        resolve: vi.fn().mockResolvedValue({
          success: false,
          error: 'proxy unavailable',
        }),
      },
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    )

    expect(result).toEqual({
      kind: 'iframe',
      url: 'https://www.youtube.com/embed/dQw4w9WgXcQ?controls=1&autoplay=1&mute=0',
    })
  })
})
