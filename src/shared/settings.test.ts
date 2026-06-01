import { describe, expect, it } from 'vitest'

import { mergeSettings, normalizeSettings } from './settings'
import { FeedViewType } from './types'

describe('settings normalization', () => {
  it('fills nested defaults and repairs missing view tabs', () => {
    const normalized = normalizeSettings({
      general: {
        language: 'en',
        viewTabs: [{ id: FeedViewType.Articles, visible: false }],
      } as any,
    })

    expect(normalized.general.language).toBe('en')
    expect(normalized.general.viewTabs).toHaveLength(4)
    expect(
      normalized.general.viewTabs.some((tab) => tab.id === FeedViewType.Videos),
    ).toBe(true)
  })

  it('keeps content width fields in sync', () => {
    const normalized = normalizeSettings({
      general: {
        contentMaxWidth: 920,
        customContentMaxWidth: 400,
      } as any,
    })

    expect(normalized.general.contentMaxWidth).toBe(920)
    expect(normalized.general.customContentMaxWidth).toBe(920)
  })

  it('merges nested sections without dropping unrelated keys', () => {
    const merged = mergeSettings(normalizeSettings(), {
      translation: { enabled: true } as any,
    })

    expect(merged.translation.enabled).toBe(true)
    expect(merged.translation.targetLanguage).toBe('zh-CN')
    expect(merged.ai.model).toBeTruthy()
  })
})
