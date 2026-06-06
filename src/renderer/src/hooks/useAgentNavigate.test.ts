import { beforeEach, describe, expect, it, vi } from 'vitest'

import { openEntryDetailFromAgent } from './useAgentNavigate'
import { useAIChatStore } from '../store/ai-chat-store'
import { useDiscoverStore } from '../store/discover-store'
import { useSettingsStore } from '../store/settings-store'

function stubLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => store.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      store.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      store.delete(key)
    }),
    clear: vi.fn(() => {
      store.clear()
    }),
  })
}

describe('openEntryDetailFromAgent', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
    stubLocalStorage()
    useSettingsStore.setState({ isOpen: false })
    useDiscoverStore.setState({ isOpen: false })
    useAIChatStore.setState({ isPanelOpen: false, messages: [] })
  })

  it('opens a fully focused entry detail view from an agent navigation action', () => {
    const navigate = vi.fn()
    useSettingsStore.setState({ isOpen: true })
    useDiscoverStore.setState({ isOpen: true })
    useAIChatStore.setState({ isPanelOpen: true, messages: [] })

    openEntryDetailFromAgent(' feed/entry ?part#1 ', navigate)

    expect(navigate).toHaveBeenCalledWith('/entry/feed%2Fentry%20%3Fpart%231')
    expect(useSettingsStore.getState().isOpen).toBe(false)
    expect(useDiscoverStore.getState().isOpen).toBe(false)
    expect(useAIChatStore.getState().isPanelOpen).toBe(false)
  })

  it('ignores empty entry ids', () => {
    const navigate = vi.fn()

    openEntryDetailFromAgent('   ', navigate)

    expect(navigate).not.toHaveBeenCalled()
  })
})
