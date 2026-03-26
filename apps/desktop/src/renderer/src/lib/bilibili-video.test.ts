import { describe, expect, it } from 'vitest'
import {
  buildBilibiliInAppPlayerUrl,
  normalizeBilibiliVideoUrl,
  resolveBilibiliVideoPageUrl,
} from './bilibili-video'

describe('bilibili-video', () => {
  it('normalizes BV and av page URLs', () => {
    expect(
      normalizeBilibiliVideoUrl(
        'https://www.bilibili.com/video/BV1xx411c7mD?p=2',
      ),
    ).toBe('https://www.bilibili.com/video/BV1xx411c7mD')
    expect(
      normalizeBilibiliVideoUrl(
        'https://www.bilibili.com/video/av170001?foo=1',
      ),
    ).toBe('https://www.bilibili.com/video/av170001')
  })

  it('builds in-app player URLs with optional flags', () => {
    expect(
      buildBilibiliInAppPlayerUrl(
        'https://www.bilibili.com/video/BV1xx411c7mD',
        {
          includeOutsideFlag: true,
        },
      ),
    ).toContain('isOutside=true')

    expect(
      buildBilibiliInAppPlayerUrl('https://www.bilibili.com/video/av170001', {
        muted: true,
      }),
    ).toContain('muted=true')
  })

  it('falls back to normalized page URLs when requested', () => {
    expect(
      buildBilibiliInAppPlayerUrl('https://b23.tv/abc123', {
        fallbackToPage: true,
      }),
    ).toBe('https://b23.tv/abc123')
  })

  it('resolves the first bilibili video URL from an entry', () => {
    expect(
      resolveBilibiliVideoPageUrl({
        url: '',
        media: [
          { type: 'photo', url: 'https://example.com/a.jpg' },
          {
            type: 'video',
            url: 'https://www.bilibili.com/video/BV1xx411c7mD?p=2',
          },
        ],
      } as never),
    ).toBe('https://www.bilibili.com/video/BV1xx411c7mD')
  })
})
