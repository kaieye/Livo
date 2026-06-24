import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC, unwrapIpcEnvelope } from '../../shared/ipc-contracts'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  run: vi.fn(),
  resume: vi.fn(),
  abort: vi.fn(),
  cancelPending: vi.fn(),
  loadTraces: vi.fn(),
  loadTracesBySession: vi.fn(),
  deleteTrace: vi.fn(),
  clearTraces: vi.fn(),
  loadMemory: vi.fn(),
  clearMemory: vi.fn(),
  getSettings: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.handle,
  },
}))

vi.mock('../agent/service', () => ({
  agentService: {
    run: mocks.run,
    resume: mocks.resume,
    abort: mocks.abort,
    cancelPending: mocks.cancelPending,
  },
}))

vi.mock('../agent/trace-store', () => ({
  AgentTraceStore: {
    loadAll: mocks.loadTraces,
    loadBySession: mocks.loadTracesBySession,
    delete: mocks.deleteTrace,
    clearAll: mocks.clearTraces,
  },
}))

vi.mock('../agent/agent-memory', () => ({
  AgentMemoryStore: {
    loadAll: mocks.loadMemory,
    clearAll: mocks.clearMemory,
  },
}))

vi.mock('../services/system/settings-provider', () => ({
  settingsProvider: {
    get: mocks.getSettings,
  },
}))

vi.mock('../services/ai/provider-protocol', () => ({
  normalizeAIError: (error: unknown) =>
    error instanceof Error ? error.message : String(error),
}))

vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('../agent/default-tools', () => ({}))

type RegisteredHandler = (
  event: {
    sender: {
      isDestroyed: () => boolean
      send: (channel: string, payload: unknown) => void
    }
  },
  ...args: unknown[]
) => Promise<unknown>

function getRegisteredHandler(channel: string): RegisteredHandler {
  const call = mocks.handle.mock.calls.find(
    ([registered]) => registered === channel,
  )
  if (!call) throw new Error(`Missing IPC handler: ${channel}`)
  return call[1] as RegisteredHandler
}

function makeEvent() {
  return {
    sender: {
      isDestroyed: vi.fn(() => false),
      send: vi.fn(),
    },
  }
}

describe('registerAgentHandlers', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getSettings.mockReturnValue({ ai: { provider: 'openai' } })
    mocks.run.mockResolvedValue({
      text: 'done',
      status: 'completed',
      toolRounds: [],
      metrics: { totalMs: 0, llmMs: 0, toolMs: 0, rounds: [] },
    })
    mocks.resume.mockResolvedValue({
      text: 'resumed',
      status: 'completed',
      toolRounds: [],
      metrics: { totalMs: 0, llmMs: 0, toolMs: 0, rounds: [] },
    })
    mocks.abort.mockReturnValue(true)
    mocks.cancelPending.mockReturnValue(true)
    mocks.loadTraces.mockReturnValue([])
    mocks.loadTracesBySession.mockReturnValue([])
    mocks.deleteTrace.mockReturnValue(true)
    mocks.loadMemory.mockReturnValue([])
  })

  it('registers pending cancellation through IPC envelopes', async () => {
    const { registerAgentHandlers } = await import('./agent-handlers')
    registerAgentHandlers()

    const cancelPending = getRegisteredHandler(IPC.AGENT_CANCEL_PENDING)
    const result = unwrapIpcEnvelope(
      await cancelPending(makeEvent(), 'pending-agent-1'),
    )

    expect(result).toEqual({ success: true })
    expect(mocks.cancelPending).toHaveBeenCalledWith('pending-agent-1')
  })

  it('relays run tool events with the active request id', async () => {
    mocks.run.mockImplementationOnce(async (request) => {
      request.onToolEvent({
        type: 'tool_started',
        toolCallId: 'call-1',
        toolName: 'get_today_updates',
        args: '{}',
      })
      return {
        text: 'done',
        status: 'completed',
        toolRounds: [],
        metrics: { totalMs: 0, llmMs: 0, toolMs: 0, rounds: [] },
      }
    })
    const { registerAgentHandlers } = await import('./agent-handlers')
    registerAgentHandlers()

    const event = makeEvent()
    const run = getRegisteredHandler(IPC.AGENT_RUN)
    const result = unwrapIpcEnvelope(
      await run(event, { requestId: 'agent-1', prompt: 'today' }),
    )

    expect(result).toMatchObject({ success: true, text: 'done' })
    expect(event.sender.send).toHaveBeenCalledWith('agent:tool-event', {
      requestId: 'agent-1',
      type: 'tool_started',
      toolCallId: 'call-1',
      toolName: 'get_today_updates',
      args: '{}',
    })
  })

  it('lists traces by session when a session filter is provided', async () => {
    const { registerAgentHandlers } = await import('./agent-handlers')
    registerAgentHandlers()

    const listTraces = getRegisteredHandler(IPC.AGENT_TRACES_LIST)
    const result = unwrapIpcEnvelope(
      await listTraces(makeEvent(), { sessionId: 'agent-session-1' }),
    )

    expect(result).toEqual([])
    expect(mocks.loadTracesBySession).toHaveBeenCalledWith('agent-session-1')
    expect(mocks.loadTraces).not.toHaveBeenCalled()
  })

  it('deletes one trace through IPC envelopes', async () => {
    const { registerAgentHandlers } = await import('./agent-handlers')
    registerAgentHandlers()

    const deleteTrace = getRegisteredHandler(IPC.AGENT_TRACES_DELETE)
    const result = unwrapIpcEnvelope(
      await deleteTrace(makeEvent(), 'trace-agent-1'),
    )

    expect(result).toEqual({ success: true })
    expect(mocks.deleteTrace).toHaveBeenCalledWith('trace-agent-1')
  })

  it('lists and clears agent memory through IPC envelopes', async () => {
    mocks.loadMemory.mockReturnValueOnce([
      {
        topic: '阅读偏好',
        content: '优先科技文章',
        source: 'user_confirmed',
        updatedAt: 1,
      },
    ])
    const { registerAgentHandlers } = await import('./agent-handlers')
    registerAgentHandlers()

    const listMemory = getRegisteredHandler(IPC.AGENT_MEMORY_LIST)
    const clearMemory = getRegisteredHandler(IPC.AGENT_MEMORY_CLEAR)

    expect(unwrapIpcEnvelope(await listMemory(makeEvent()))).toEqual([
      {
        topic: '阅读偏好',
        content: '优先科技文章',
        source: 'user_confirmed',
        updatedAt: 1,
      },
    ])
    expect(unwrapIpcEnvelope(await clearMemory(makeEvent()))).toEqual({
      success: true,
    })
    expect(mocks.clearMemory).toHaveBeenCalledOnce()
  })
})
