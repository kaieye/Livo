import { describe, expect, it } from 'vitest'
import type { AppSettings } from './settings-schema'
import { cloneDefaultSettings } from './settings'
import {
  REDACTED_SECRET_VALUE,
  preserveRedactedSettingsSecrets,
  redactSettingsSecrets,
  stripSettingsSecretsForPersistence,
} from './settings-secrets'

describe('settings secret redaction', () => {
  it('redacts configured AI and aggregator secrets', () => {
    const settings = cloneDefaultSettings()
    settings.ai.apiKey = 'sk-active'
    settings.ai.apiKeys = {
      openai: 'sk-openai',
      deepseek: '',
    }
    settings.general.proxyUrl = 'http://user:pass@127.0.0.1:7890'
    settings.aggregator.apiKey = 'aggregator-secret'
    settings.aggregator.deviceId = 'device-secret'

    const redacted = redactSettingsSecrets(settings)

    expect(redacted.general.proxyUrl).toBe(REDACTED_SECRET_VALUE)
    expect(redacted.ai.apiKey).toBe(REDACTED_SECRET_VALUE)
    expect(redacted.ai.apiKeys).toEqual({
      openai: REDACTED_SECRET_VALUE,
      deepseek: '',
    })
    expect(redacted.aggregator.apiKey).toBe(REDACTED_SECRET_VALUE)
    expect(redacted.aggregator.deviceId).toBe(REDACTED_SECRET_VALUE)
    expect(JSON.stringify(redacted)).not.toContain('sk-active')
    expect(JSON.stringify(redacted)).not.toContain('aggregator-secret')
    expect(JSON.stringify(redacted)).not.toContain('device-secret')
    expect(JSON.stringify(redacted)).not.toContain('user:pass')
  })

  it('preserves existing secrets when renderer submits redacted sentinels', () => {
    const current = cloneDefaultSettings()
    current.ai.provider = 'openai'
    current.ai.apiKey = 'sk-openai'
    current.ai.apiKeys = {
      openai: 'sk-openai',
      deepseek: 'sk-deepseek',
    }
    current.general.proxyUrl = 'http://user:pass@127.0.0.1:7890'
    current.aggregator.apiKey = 'aggregator-secret'
    current.aggregator.deviceId = 'device-secret'

    const patchInput = {
      general: {
        proxyUrl: REDACTED_SECRET_VALUE,
      },
      ai: {
        provider: 'deepseek',
        apiKey: REDACTED_SECRET_VALUE,
        apiKeys: {
          openai: REDACTED_SECRET_VALUE,
          deepseek: REDACTED_SECRET_VALUE,
        },
      },
      aggregator: {
        apiKey: REDACTED_SECRET_VALUE,
        deviceId: REDACTED_SECRET_VALUE,
      },
    } as unknown as Partial<AppSettings>
    const patch = preserveRedactedSettingsSecrets(current, patchInput)

    expect(patch.general?.proxyUrl).toBe('http://user:pass@127.0.0.1:7890')
    expect(patch.ai?.apiKey).toBe('sk-deepseek')
    expect(patch.ai?.apiKeys).toEqual({
      openai: 'sk-openai',
      deepseek: 'sk-deepseek',
    })
    expect(patch.aggregator?.apiKey).toBe('aggregator-secret')
    expect(patch.aggregator?.deviceId).toBe('device-secret')
  })

  it('strips durable settings secrets while preserving non-secret settings', () => {
    const settings = cloneDefaultSettings()
    settings.general.proxyUrl = 'http://user:pass@127.0.0.1:7890'
    settings.ai.apiKey = 'sk-active'
    settings.ai.apiKeys = {
      openai: 'sk-openai',
      deepseek: 'sk-deepseek',
    }
    settings.aggregator.apiKey = 'aggregator-secret'
    settings.aggregator.deviceId = 'device-secret'

    const stripped = stripSettingsSecretsForPersistence(settings)

    expect(stripped.general.proxyUrl).toBe('')
    expect(stripped.ai.apiKey).toBe('')
    expect(stripped.ai.apiKeys).toEqual({ openai: '', deepseek: '' })
    expect(stripped.aggregator.apiKey).toBe('')
    expect(stripped.aggregator.deviceId).toBe('')
    expect(JSON.stringify(stripped)).not.toContain('sk-active')
    expect(JSON.stringify(stripped)).not.toContain('aggregator-secret')
    expect(JSON.stringify(stripped)).not.toContain('device-secret')
    expect(JSON.stringify(stripped)).not.toContain('user:pass')
  })

  it('keeps non-credentialed proxy URLs when stripping persistent secrets', () => {
    const settings = cloneDefaultSettings()
    settings.general.proxyUrl = 'http://127.0.0.1:7890'

    expect(stripSettingsSecretsForPersistence(settings).general.proxyUrl).toBe(
      'http://127.0.0.1:7890',
    )
  })
})
