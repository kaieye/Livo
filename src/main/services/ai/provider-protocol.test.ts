import { describe, it, expect } from 'vitest'
import type { AIConfig } from '../../../shared/types/index'
import {
  detectProviderFormat,
  isOpenAICompatible,
  normalizeAIError,
  supportsStreaming,
  supportsToolCalls,
  supportsUsage,
} from './provider-protocol'

function config(overrides: Partial<AIConfig> = {}): AIConfig {
  return {
    provider: 'openai',
    apiKey: 'sk-test',
    model: 'gpt-4o-mini',
    ...overrides,
  }
}

describe('detectProviderFormat', () => {
  it('treats OpenAI-family providers as openai-chat', () => {
    expect(detectProviderFormat(config())).toBe('openai-chat')
    expect(detectProviderFormat(config({ provider: 'deepseek' }))).toBe(
      'openai-chat',
    )
  })

  it('detects native Anthropic provider as anthropic', () => {
    expect(detectProviderFormat(config({ provider: 'anthropic' }))).toBe(
      'anthropic',
    )
  })

  it('detects anthropic from a /v1/messages baseUrl', () => {
    expect(
      detectProviderFormat(
        config({ provider: 'custom', baseUrl: 'https://x/v1/messages' }),
      ),
    ).toBe('anthropic')
  })

  it('treats an OpenAI-compatible gateway as openai-chat even for anthropic', () => {
    expect(
      detectProviderFormat(
        config({
          provider: 'anthropic',
          baseUrl: 'https://gw.example.com/v1/chat/completions',
        }),
      ),
    ).toBe('openai-chat')
  })
})

describe('isOpenAICompatible', () => {
  it('is false for native Anthropic', () => {
    expect(isOpenAICompatible(config({ provider: 'anthropic' }))).toBe(false)
  })
  it('is true for an OpenAI-compatible anthropic gateway', () => {
    expect(
      isOpenAICompatible(
        config({
          provider: 'anthropic',
          baseUrl: 'https://gw/v1/chat/completions',
        }),
      ),
    ).toBe(true)
  })
})

describe('provider capabilities', () => {
  it('allows tool calls and streaming for OpenAI-compatible endpoints', () => {
    expect(supportsToolCalls(config())).toBe(true)
    expect(supportsStreaming(config())).toBe(true)
  })

  it('disables tool calls and streaming for native Anthropic', () => {
    const nativeAnthropic = config({ provider: 'anthropic' })
    expect(supportsToolCalls(nativeAnthropic)).toBe(false)
    expect(supportsStreaming(nativeAnthropic)).toBe(false)
  })

  it('requests usage metadata only for the first-party OpenAI provider', () => {
    expect(supportsUsage(config())).toBe(true)
    expect(supportsUsage(config({ provider: 'deepseek' }))).toBe(false)
    expect(supportsUsage(config({ provider: 'anthropic' }))).toBe(false)
  })
})

describe('normalizeAIError', () => {
  it('maps HTTP status codes to friendly messages', () => {
    expect(normalizeAIError({ status: 401 }, config())).toMatch(/API Key/)
    expect(normalizeAIError({ status: 429 }, config())).toMatch(/频繁|额度/)
    expect(normalizeAIError({ status: 503 }, config())).toMatch(/暂时不可用/)
    expect(normalizeAIError({ status: 404 }, config())).toMatch(/模型|地址/)
  })

  it('warns when the config is native Anthropic', () => {
    expect(
      normalizeAIError({ status: 404 }, config({ provider: 'anthropic' })),
    ).toMatch(/OpenAI 兼容/)
  })

  it('maps connection errors without a status', () => {
    expect(normalizeAIError({ code: 'ECONNREFUSED' }, config())).toMatch(
      /无法连接/,
    )
  })

  it('passes plain error messages through', () => {
    expect(normalizeAIError(new Error('确认请求已过期'), config())).toBe(
      '确认请求已过期',
    )
  })
})
