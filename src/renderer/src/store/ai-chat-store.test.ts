import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

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

async function loadAIChatStore() {
  vi.resetModules()
  const storage = createMemoryStorage()
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
  const api = {
    agent: {
      run: vi.fn(),
      resume: vi.fn(),
      abort: vi.fn(),
      cancelPending: vi.fn(async () => ({ success: true })),
      onToolEvent: vi.fn(() => () => undefined),
    },
  }

  vi.stubGlobal('localStorage', storage)
  vi.stubGlobal('window', { api, localStorage: storage })

  const mod = await import('./ai-chat-store')
  return { useAIChatStore: mod.useAIChatStore, api, storage, warn }
}

describe('useAIChatStore.cancelPending', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('notifies main, clears pending confirmation, and marks the tool cancelled', async () => {
    const { useAIChatStore, api, storage } = await loadAIChatStore()

    useAIChatStore.setState({
      messages: [
        {
          id: 'msg-user',
          role: 'user',
          content: 'Add this feed',
          timestamp: 1000,
        },
      ],
      toolStatusItems: [
        {
          key: 'call-add-feed',
          label: '添加订阅源',
          name: 'add_feed',
          status: 'confirmation_required',
          message: '需要确认',
        },
      ],
      pendingConfirmation: {
        toolCallId: 'call-add-feed',
        toolName: 'add_feed',
        title: '添加订阅源',
        message: '确认添加？',
        risk: 'medium',
        argsPreview: '{"url":"https://example.com/feed.xml"}',
      },
      pendingId: 'pending-agent-1',
      isConfirming: true,
      showToolBanner: true,
      currentSessionId: 'session-test',
    })

    useAIChatStore.getState().cancelPending()

    expect(api.agent.cancelPending).toHaveBeenCalledWith('pending-agent-1')

    const state = useAIChatStore.getState()
    expect(state.pendingConfirmation).toBeNull()
    expect(state.pendingId).toBeNull()
    expect(state.isConfirming).toBe(false)
    expect(state.toolStatusItems[0]).toMatchObject({
      key: 'call-add-feed',
      status: 'cancelled',
      message: '用户取消执行',
    })
    expect(state.messages.at(-1)).toMatchObject({
      role: 'assistant',
      content: '已取消执行「添加订阅源」。',
    })
    expect(storage.setItem).toHaveBeenCalledWith(
      'livo-chat-sessions',
      expect.stringContaining('已取消执行'),
    )
  })

  it('does nothing when there is no pending confirmation', async () => {
    const { useAIChatStore, api } = await loadAIChatStore()

    useAIChatStore.getState().cancelPending()

    expect(api.agent.cancelPending).not.toHaveBeenCalled()
    expect(useAIChatStore.getState().messages).toEqual([])
  })

  it('warns when main no longer has the pending confirmation but still clears UI state', async () => {
    const { useAIChatStore, api, warn } = await loadAIChatStore()
    api.agent.cancelPending.mockResolvedValueOnce({ success: false })

    useAIChatStore.setState({
      pendingConfirmation: {
        toolCallId: 'call-add-feed',
        toolName: 'add_feed',
        title: '添加订阅源',
        message: '确认添加？',
        risk: 'medium',
        argsPreview: '{}',
      },
      pendingId: 'pending-gone',
      toolStatusItems: [
        {
          key: 'call-add-feed',
          label: '添加订阅源',
          name: 'add_feed',
          status: 'confirmation_required',
        },
      ],
    })

    useAIChatStore.getState().cancelPending()
    await Promise.resolve()

    expect(warn).toHaveBeenCalledWith(
      'Agent pending confirmation was already gone',
      'pending-gone',
    )
    expect(useAIChatStore.getState().pendingConfirmation).toBeNull()
    expect(useAIChatStore.getState().toolStatusItems[0]?.status).toBe(
      'cancelled',
    )
  })

  it('releases parked confirmations when clearing or switching conversations', async () => {
    const { useAIChatStore, api } = await loadAIChatStore()

    useAIChatStore.setState({
      pendingConfirmation: {
        toolCallId: 'call-1',
        toolName: 'add_feed',
        title: '添加订阅源',
        message: '确认添加？',
        risk: 'medium',
        argsPreview: '{}',
      },
      pendingId: 'pending-clear',
      messages: [
        {
          id: 'msg-user',
          role: 'user',
          content: 'Add this feed',
          timestamp: 1000,
        },
      ],
    })

    useAIChatStore.getState().clearMessages()

    expect(api.agent.cancelPending).toHaveBeenCalledWith('pending-clear')

    useAIChatStore.setState({
      pendingConfirmation: {
        toolCallId: 'call-2',
        toolName: 'remove_subscription',
        title: '删除订阅源',
        message: '确认删除？',
        risk: 'high',
        argsPreview: '{}',
      },
      pendingId: 'pending-load',
    })

    useAIChatStore.getState().loadSession({
      id: 'session-next',
      title: 'Next',
      messages: [],
      createdAt: 2000,
      updatedAt: 2000,
    })

    expect(api.agent.cancelPending).toHaveBeenCalledWith('pending-load')
    expect(useAIChatStore.getState().pendingConfirmation).toBeNull()
    expect(useAIChatStore.getState().pendingId).toBeNull()
  })
})
