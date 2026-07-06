import type { AppSettings } from './settings-schema'

export const REDACTED_SECRET_VALUE = '__LIVO_SECRET_CONFIGURED__'

function cloneSettings(settings: AppSettings): AppSettings {
  return JSON.parse(JSON.stringify(settings)) as AppSettings
}

export function isRedactedSecretValue(value: unknown): boolean {
  return value === REDACTED_SECRET_VALUE
}

function redactedIfConfigured(value: string | undefined): string {
  return value?.trim() ? REDACTED_SECRET_VALUE : ''
}

function hasUrlCredentials(value: string | undefined): boolean {
  if (!value?.trim()) return false
  try {
    const parsed = new URL(value)
    return !!parsed.username || !!parsed.password
  } catch {
    return /\/\/[^/?#\s]+@/.test(value)
  }
}

export function redactSettingsSecrets(settings: AppSettings): AppSettings {
  const redacted = cloneSettings(settings)

  if (hasUrlCredentials(redacted.general.proxyUrl)) {
    redacted.general.proxyUrl = REDACTED_SECRET_VALUE
  }
  redacted.ai.apiKey = redactedIfConfigured(redacted.ai.apiKey)
  if (redacted.ai.apiKeys) {
    redacted.ai.apiKeys = Object.fromEntries(
      Object.entries(redacted.ai.apiKeys).map(([provider, value]) => [
        provider,
        redactedIfConfigured(value),
      ]),
    )
  }
  redacted.aggregator.apiKey = redactedIfConfigured(redacted.aggregator.apiKey)
  redacted.aggregator.deviceId = redactedIfConfigured(
    redacted.aggregator.deviceId,
  )

  return redacted
}

export function preserveRedactedSettingsSecrets(
  current: AppSettings,
  patch: Partial<AppSettings>,
): Partial<AppSettings> {
  const next = JSON.parse(JSON.stringify(patch)) as Partial<AppSettings>

  if (next.ai) {
    const nextProvider = next.ai.provider ?? current.ai.provider
    if (isRedactedSecretValue(next.ai.apiKey)) {
      next.ai.apiKey =
        current.ai.apiKeys?.[nextProvider] ??
        (nextProvider === current.ai.provider ? current.ai.apiKey : '')
    }
    if (next.ai.apiKeys) {
      next.ai.apiKeys = Object.fromEntries(
        Object.entries(next.ai.apiKeys).map(([provider, value]) => [
          provider,
          isRedactedSecretValue(value)
            ? (current.ai.apiKeys?.[provider] ??
              (provider === current.ai.provider ? current.ai.apiKey : ''))
            : value,
        ]),
      )
    }
  }

  if (next.general && isRedactedSecretValue(next.general.proxyUrl)) {
    next.general.proxyUrl = current.general.proxyUrl
  }

  if (next.aggregator && isRedactedSecretValue(next.aggregator.apiKey)) {
    next.aggregator.apiKey = current.aggregator.apiKey
  }
  if (next.aggregator && isRedactedSecretValue(next.aggregator.deviceId)) {
    next.aggregator.deviceId = current.aggregator.deviceId
  }

  return next
}
