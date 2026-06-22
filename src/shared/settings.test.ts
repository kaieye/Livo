import { describe, expect, it } from 'vitest'

import { mergeSettings, normalizeSettings } from './settings'
import {
  DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
  DEFAULT_AGENT_MAX_TOKENS,
  DEFAULT_AGENT_TEMPERATURE,
  DEFAULT_SETTINGS,
  FEED_COLUMN_DEFAULTS,
  FeedViewType,
  MAX_AGENT_MAX_TOKENS,
  MAX_AGENT_RUN_TIMEOUT_SECONDS,
  MAX_AGENT_TEMPERATURE,
} from './types'

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

  it('normalizes numeric settings to safe runtime ranges', () => {
    const normalized = normalizeSettings({
      agent: {
        runTimeoutSeconds: 0,
      } as any,
      ai: {
        agentTemperature: 99,
        agentMaxTokens: Number.POSITIVE_INFINITY,
      } as any,
      general: {
        refreshInterval: Number.POSITIVE_INFINITY,
        fontSize: -1,
        contentMaxWidth: 999_999,
        customContentMaxWidth: 0,
        contentLineHeight: 99,
      } as any,
      data: {
        entriesPerFeed: -10,
        maxEntryAgeDays: Number.NaN,
        freshnessTTL: 1.5,
        refreshConcurrency: 999,
        cacheSizeLimitMB: -1,
        codeCacheLimitMB: Number.POSITIVE_INFINITY,
      } as any,
    })

    expect(normalized.agent.runTimeoutSeconds).toBe(
      DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
    )
    expect(normalized.ai.agentTemperature).toBe(MAX_AGENT_TEMPERATURE)
    expect(normalized.ai.agentMaxTokens).toBe(DEFAULT_AGENT_MAX_TOKENS)
    expect(normalized.general.refreshInterval).toBe(30)
    expect(normalized.general.fontSize).toBe(12)
    expect(normalized.general.contentMaxWidth).toBe(1400)
    expect(normalized.general.customContentMaxWidth).toBe(1400)
    expect(normalized.general.contentLineHeight).toBe(2.5)
    expect(normalized.data.entriesPerFeed).toBe(0)
    expect(normalized.data.maxEntryAgeDays).toBe(90)
    expect(normalized.data.freshnessTTL).toBe(1)
    expect(normalized.data.refreshConcurrency).toBe(20)
    expect(normalized.data.cacheSizeLimitMB).toBe(0)
    expect(normalized.data.codeCacheLimitMB).toBe(100)
  })

  it('keeps valid custom agent timeout seconds and caps excessive values', () => {
    expect(
      normalizeSettings({
        agent: { runTimeoutSeconds: 45.9 },
      } as any).agent.runTimeoutSeconds,
    ).toBe(45)

    expect(
      normalizeSettings({
        agent: { runTimeoutSeconds: Number.MAX_SAFE_INTEGER },
      } as any).agent.runTimeoutSeconds,
    ).toBe(MAX_AGENT_RUN_TIMEOUT_SECONDS)
  })

  it('keeps valid custom agent model parameters and caps excessive values', () => {
    const normalized = normalizeSettings({
      ai: {
        agentTemperature: 1.25,
        agentMaxTokens: 4096.9,
      } as any,
    })
    expect(normalized.ai.agentTemperature).toBe(1.25)
    expect(normalized.ai.agentMaxTokens).toBe(4096)

    const capped = normalizeSettings({
      ai: {
        agentTemperature: Number.MAX_SAFE_INTEGER,
        agentMaxTokens: Number.MAX_SAFE_INTEGER,
      } as any,
    })
    expect(capped.ai.agentTemperature).toBe(MAX_AGENT_TEMPERATURE)
    expect(capped.ai.agentMaxTokens).toBe(MAX_AGENT_MAX_TOKENS)
  })

  it('merges nested sections without dropping unrelated keys', () => {
    const merged = mergeSettings(normalizeSettings(), {
      translation: { enabled: true } as any,
    })

    expect(merged.translation.enabled).toBe(true)
    expect(merged.translation.targetLanguage).toBe('zh-CN')
    expect(merged.ai.model).toBeTruthy()
  })

  it('keeps per-provider AI connection history fields', () => {
    const normalized = mergeSettings(normalizeSettings(), {
      ai: {
        provider: 'custom',
        apiKey: 'sk-current',
        apiKeys: { custom: 'sk-current', deepseek: 'sk-deepseek' },
        baseUrl: 'https://gw.example.com/v1/chat/completions',
        baseUrls: {
          custom: 'https://gw.example.com/v1/chat/completions',
          deepseek: 'https://api.deepseek.com/v1',
        },
        model: 'custom-model',
        models: { custom: 'custom-model', deepseek: 'deepseek-chat' },
      } as any,
    })

    expect(normalized.ai.apiKeys?.deepseek).toBe('sk-deepseek')
    expect(normalized.ai.baseUrls?.custom).toBe(
      'https://gw.example.com/v1/chat/completions',
    )
    expect(normalized.ai.models?.deepseek).toBe('deepseek-chat')
  })

  it('derives default feed columns from the shared column defaults', () => {
    expect(DEFAULT_SETTINGS.agent.runTimeoutSeconds).toBe(
      DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
    )
    expect(DEFAULT_SETTINGS.ai.agentTemperature).toBe(DEFAULT_AGENT_TEMPERATURE)
    expect(DEFAULT_SETTINGS.ai.agentMaxTokens).toBe(DEFAULT_AGENT_MAX_TOKENS)
    expect(DEFAULT_SETTINGS.general.feedColumns).toEqual(FEED_COLUMN_DEFAULTS)
    expect(DEFAULT_SETTINGS.general.feedColumns).not.toBe(FEED_COLUMN_DEFAULTS)
  })
})
