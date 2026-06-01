import { describe, expect, it } from 'vitest'
import { resolvePreferredEntryVideo } from './entry-video-source'

describe('entry-video-source', () => {
  it('prefers attached video media over entry url for youtube-like entries', () => {
    expect(
      resolvePreferredEntryVideo({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        media: [
          {
            type: 'video',
            url: 'https://cdn.example.com/video.mp4',
          },
        ],
      } as never),
    ).toEqual({
      url: 'https://cdn.example.com/video.mp4',
      type: 'video',
    })
  })

  it('falls back to the entry url when no attached video media exists', () => {
    expect(
      resolvePreferredEntryVideo({
        url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        media: [],
      } as never),
    ).toEqual({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      type: 'video',
    })
  })

  it('returns null when the entry has no supported video source', () => {
    expect(
      resolvePreferredEntryVideo({
        url: 'https://example.com/article',
        media: [{ type: 'photo', url: 'https://example.com/cover.jpg' }],
      } as never),
    ).toBeNull()
  })
})
