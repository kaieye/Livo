import { describe, expect, it } from 'vitest'
import {
  resolveOpenAIChatCompletionsUrl,
  resolveOpenAICompatibleBaseUrl,
} from './ai-endpoint'

describe('AI endpoint resolver', () => {
  it('uses a full chat completions URL as the final request URL', () => {
    expect(
      resolveOpenAIChatCompletionsUrl(
        'https://apihub.agnes-ai.com/v1/chat/completions',
      ),
    ).toBe('https://apihub.agnes-ai.com/v1/chat/completions')
  })

  it('accepts a service root URL without creating duplicate slashes', () => {
    expect(
      resolveOpenAIChatCompletionsUrl('https://apihub.agnes-ai.com/v1/'),
    ).toBe('https://apihub.agnes-ai.com/v1/chat/completions')
  })

  it('converts a full chat completions URL into the SDK base URL', () => {
    expect(
      resolveOpenAICompatibleBaseUrl(
        'https://apihub.agnes-ai.com/v1/chat/completions',
      ),
    ).toBe('https://apihub.agnes-ai.com/v1')
  })

  it('normalizes a root URL for the SDK', () => {
    expect(
      resolveOpenAICompatibleBaseUrl('https://apihub.agnes-ai.com/v1/'),
    ).toBe('https://apihub.agnes-ai.com/v1')
  })
})
