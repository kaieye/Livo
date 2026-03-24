import { describe, expect, it } from 'vitest'
import { formatFeedTitle } from './feed-title'

describe('formatFeedTitle', () => {
  it('normalizes bilibili titles with a dangling separator', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/video/123',
        '丁汇实录 - bilibili space',
      ),
    ).toBe('丁汇实录 - Bilibili')
  })

  it('keeps a single separator for regular bilibili titles', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/video/123',
        '丁汇实录 bilibili space',
      ),
    ).toBe('丁汇实录 - Bilibili')
  })

  it('removes a dangling chinese possessive from bilibili titles', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/dynamic/123',
        '倪海毅 的 bilibili space',
      ),
    ).toBe('倪海毅 - Bilibili')
  })

  it('normalizes already formatted bilibili titles with an extra 的', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/dynamic/123',
        '倪海毅 的 - Bilibili',
      ),
    ).toBe('倪海毅 - Bilibili')
  })

  it('normalizes bilibili space page titles that include 投稿视频', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/video/25876945',
        '极客湾Geekerwan投稿视频 - 极客湾Geekerwan视频分享 - 哔哩哔哩视频',
      ),
    ).toBe('极客湾Geekerwan - Bilibili')
  })

  it('collapses duplicated bilibili names after 投稿视频 fragments are stripped', () => {
    expect(
      formatFeedTitle(
        'https://rsshub.app/bilibili/user/video/179125203',
        '丁汇实录投稿视频-丁汇实录',
      ),
    ).toBe('丁汇实录 - Bilibili')
  })
})
