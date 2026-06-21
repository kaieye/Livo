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
})
