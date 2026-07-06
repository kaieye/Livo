import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  cloneDefaultSettings,
  mergeSettings,
  normalizeSettings,
} from '../../../shared/settings'
import {
  DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
  type AppSettings,
} from '../../../shared/types'
import { REDACTED_SECRET_VALUE } from '../../../shared/settings-secrets'

const SETTINGS_CACHE_KEY = 'livo-settings-cache'

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial))
  return {
    get length() {
      return entries.size
    },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(entries.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      entries.delete(key)
    }),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value)
    }),
  }
}

function createSettingsApi(initial = cloneDefaultSettings()) {
  let current = initial
  return {
    get: vi.fn(async () => current),
    set: vi.fn(async (updates: Partial<AppSettings>) => {
      current = normalizeSettings(mergeSettings(current, updates))
      return { success: true, settings: current }
    }),
  }
}

async function loadSettingsStore(options: {
  storage: Storage
  settingsApi?: ReturnType<typeof createSettingsApi>
}) {
  vi.resetModules()
  const settingsApi = options.settingsApi ?? createSettingsApi()

  vi.stubGlobal('localStorage', options.storage)
  vi.stubGlobal('window', {
    api: {
      settings: settingsApi,
    },
    localStorage: options.storage,
  })

  const mod = await import('./settings-store')
  return { useSettingsStore: mod.useSettingsStore, settingsApi }
}

describe('useSettingsStore agent timeout settings', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('normalizes cached settings missing the agent section at startup', async () => {
    const cached = cloneDefaultSettings() as Partial<AppSettings>
    delete cached.agent
    const storage = createMemoryStorage({
      [SETTINGS_CACHE_KEY]: JSON.stringify(cached),
    })

    const { useSettingsStore } = await loadSettingsStore({ storage })

    expect(useSettingsStore.getState().settings.agent.runTimeoutSeconds).toBe(
      DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
    )
  })

  it('updates the agent timeout section through the settings API', async () => {
    const storage = createMemoryStorage()
    const settingsApi = createSettingsApi()
    const { useSettingsStore } = await loadSettingsStore({
      storage,
      settingsApi,
    })

    await useSettingsStore
      .getState()
      .updateSettingsSection('agent', { runTimeoutSeconds: 45 })

    expect(settingsApi.set).toHaveBeenCalledWith({
      agent: { runTimeoutSeconds: 45 },
    })
    expect(useSettingsStore.getState().settings.agent.runTimeoutSeconds).toBe(
      45,
    )
  })

  it('stores only redacted settings secrets in localStorage cache', async () => {
    const initial = cloneDefaultSettings()
    initial.general.proxyUrl = 'http://user:pass@127.0.0.1:7890'
    initial.ai.apiKey = 'sk-live'
    initial.ai.apiKeys = { openai: 'sk-live' }
    initial.aggregator.apiKey = 'aggregator-secret'
    initial.aggregator.deviceId = 'device-secret'

    const storage = createMemoryStorage()
    const { useSettingsStore } = await loadSettingsStore({
      storage,
      settingsApi: createSettingsApi(initial),
    })

    await useSettingsStore.getState().loadSettings()

    const cached = storage.getItem(SETTINGS_CACHE_KEY)
    expect(cached).not.toContain('sk-live')
    expect(cached).not.toContain('aggregator-secret')
    expect(cached).not.toContain('device-secret')
    expect(cached).not.toContain('user:pass')
    expect(JSON.parse(cached || '{}')).toMatchObject({
      general: { proxyUrl: REDACTED_SECRET_VALUE },
      ai: {
        apiKey: REDACTED_SECRET_VALUE,
        apiKeys: { openai: REDACTED_SECRET_VALUE },
      },
      aggregator: {
        apiKey: REDACTED_SECRET_VALUE,
        deviceId: REDACTED_SECRET_VALUE,
      },
    })
  })
})
