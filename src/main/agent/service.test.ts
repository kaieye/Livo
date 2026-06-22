import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_AGENT_MAX_ROUNDS,
  DEFAULT_AGENT_RUN_TIMEOUT_SECONDS,
} from '../../shared/types'
import type { AIConfig, AgentRunMetrics } from '../../shared/types'
import type { AgentRunResult, AgentRunOptions } from './loop'

const mocks = vi.hoisted(() => ({
  getSettings: vi.fn(),
  runAgentCore: vi.fn(),
  resumeAgentCore: vi.fn(),
  saveTrace: vi.fn(),
}))

vi.mock('../services/system/settings-provider', () => ({
  settingsProvider: {
    get: mocks.getSettings,
  },
}))

vi.mock('./loop', () => ({
  runAgentCore: mocks.runAgentCore,
  resumeAgentCore: mocks.resumeAgentCore,
  agentRunFailureToolRounds: (error: unknown) =>
    (error as { agentToolRounds?: unknown[] } | undefined)?.agentToolRounds ??
    [],
}))

vi.mock('./trace-store', () => ({
  AgentTraceStore: {
    save: mocks.saveTrace,
  },
}))

const fakeAIConfig: AIConfig = {
  provider: 'openai',
  apiKey: 'test-key',
  baseUrl: 'https://api.example.com/v1',
  model: 'gpt-test',
}

const fakeAgentPermissions = {
  allowRead: true,
  allowNavigate: true,
  allowMutate: true,
  allowDestructive: true,
  allowExternal: true,
}

const emptyMetrics = (): AgentRunMetrics => ({
  totalMs: 0,
  llmMs: 0,
  toolMs: 0,
  rounds: [],
})

const completedResult = (
  overrides: Partial<AgentRunResult> = {},
): AgentRunResult => ({
  text: 'done',
  status: 'completed',
  toolRounds: [],
  metrics: emptyMetrics(),
  ...overrides,
})

const confirmationResult = (
  overrides: Partial<AgentRunResult> = {},
): AgentRunResult => ({
  text: '需要确认',
  status: 'confirmation_required',
  toolRounds: [
    {
      name: 'do_mutate',
      args: '{}',
      resultSummary: '需要确认',
      status: 'confirmation_required',
      elapsedMs: 3,
    },
  ],
  confirmation: {
    toolCallId: 'call-1',
    toolName: 'do_mutate',
    args: '{}',
    confirmation: {
      toolName: 'do_mutate',
      title: '确认执行',
      message: '写入工具需要用户确认',
      risk: 'medium',
      argsPreview: '无参数',
    },
  },
  continuation: {
    messages: [],
    pendingToolCall: {
      id: 'call-1',
      name: 'do_mutate',
      arguments: '{}',
    },
    remainingToolCalls: [],
    toolRounds: [],
    nextRound: 1,
  },
  metrics: emptyMetrics(),
  ...overrides,
})

async function loadService() {
  const module = await import('./service')
  return module.agentService
}

describe('agentService', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.getSettings.mockReturnValue({
      ai: fakeAIConfig,
      agentPermissions: fakeAgentPermissions,
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('passes the default 120s run timeout to the core when the setting is missing', async () => {
    mocks.runAgentCore.mockResolvedValueOnce(completedResult())
    const agentService = await loadService()

    await agentService.run({
      requestId: 'request-timeout-default',
      prompt: '默认超时',
    })

    expect(mocks.runAgentCore).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: DEFAULT_AGENT_RUN_TIMEOUT_SECONDS * 1000,
      }),
    )
  })

  it('passes the default max rounds to the core when the setting is missing', async () => {
    mocks.runAgentCore.mockResolvedValueOnce(completedResult())
    const agentService = await loadService()

    await agentService.run({
      requestId: 'request-rounds-default',
      prompt: '默认轮次',
    })

    expect(mocks.runAgentCore).toHaveBeenCalledWith(
      expect.objectContaining({
        maxRounds: DEFAULT_AGENT_MAX_ROUNDS,
      }),
    )
  })

  it('passes a custom run timeout to new and resumed agent runs', async () => {
    mocks.getSettings.mockReturnValue({
      ai: fakeAIConfig,
      agent: { runTimeoutSeconds: 45, maxRounds: 12 },
      agentPermissions: fakeAgentPermissions,
    })
    mocks.runAgentCore.mockResolvedValueOnce(confirmationResult())
    mocks.resumeAgentCore.mockResolvedValueOnce(completedResult())
    const agentService = await loadService()

    const first = await agentService.run({
      requestId: 'request-timeout-custom-1',
      prompt: '自定义超时',
    })
    await agentService.resume({
      requestId: 'request-timeout-custom-2',
      pendingId: first.pendingId!,
    })

    expect(mocks.runAgentCore).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 45_000, maxRounds: 12 }),
    )
    expect(mocks.resumeAgentCore).toHaveBeenCalledWith(
      expect.objectContaining({ timeoutMs: 45_000, maxRounds: 12 }),
    )
  })

  it.each([0, -5, Number.NaN, Number.POSITIVE_INFINITY])(
    'falls back to the default run timeout for invalid setting value %s',
    async (runTimeoutSeconds) => {
      mocks.getSettings.mockReturnValue({
        ai: fakeAIConfig,
        agent: { runTimeoutSeconds },
        agentPermissions: fakeAgentPermissions,
      })
      mocks.runAgentCore.mockResolvedValueOnce(completedResult())
      const agentService = await loadService()

      await agentService.run({
        requestId: `request-timeout-invalid-${String(runTimeoutSeconds)}`,
        prompt: '非法超时',
      })

      expect(mocks.runAgentCore).toHaveBeenCalledWith(
        expect.objectContaining({
          timeoutMs: DEFAULT_AGENT_RUN_TIMEOUT_SECONDS * 1000,
        }),
      )
    },
  )

  it('parks confirmation continuations and saves a confirmation trace', async () => {
    const metrics = {
      ...emptyMetrics(),
      totalMs: 12,
      llmMs: 10,
      toolMs: 2,
      tokens: { totalTokens: 42 },
    }
    mocks.runAgentCore.mockResolvedValueOnce(confirmationResult({ metrics }))
    const agentService = await loadService()

    const result = await agentService.run({
      requestId: 'request-1',
      prompt: '执行写入',
    })

    expect(result.status).toBe('confirmation_required')
    expect(result.pendingId).toMatch(/^pending-request-1-/)
    expect(mocks.saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'request-1',
        promptSummary: '执行写入',
        status: 'confirmation_required',
        toolCalls: [
          expect.objectContaining({
            toolName: 'do_mutate',
            status: 'confirmation_required',
          }),
        ],
        metricsSnapshot: metrics,
      }),
    )
  })

  it('resumes a parked continuation once and consumes the pending id', async () => {
    mocks.runAgentCore.mockResolvedValueOnce(confirmationResult())
    mocks.resumeAgentCore.mockResolvedValueOnce(completedResult())
    const agentService = await loadService()

    const first = await agentService.run({
      requestId: 'request-2',
      prompt: '执行写入',
    })

    expect(first.pendingId).toBeDefined()
    const resumed = await agentService.resume({
      requestId: 'request-3',
      pendingId: first.pendingId!,
    })

    expect(resumed.status).toBe('completed')
    const confirmationTrace = mocks.saveTrace.mock.calls[0]?.[0]
    const completedTrace = mocks.saveTrace.mock.calls.at(-1)?.[0]
    expect(completedTrace).toMatchObject({
      traceId: confirmationTrace.traceId,
      sessionId: 'request-2',
      promptSummary: '执行写入',
      status: 'completed',
    })
    expect(mocks.resumeAgentCore).toHaveBeenCalledWith(
      expect.objectContaining({
        continuation: expect.objectContaining({
          pendingToolCall: expect.objectContaining({ id: 'call-1' }),
        }),
        aiConfig: fakeAIConfig,
        sessionId: 'request-3',
      }),
    )

    await expect(
      agentService.resume({
        requestId: 'request-4',
        pendingId: first.pendingId!,
      }),
    ).rejects.toThrow(/确认请求已过期/)
  })

  it('cancels a parked continuation and records a cancelled trace', async () => {
    mocks.runAgentCore.mockResolvedValueOnce(confirmationResult())
    const agentService = await loadService()

    const first = await agentService.run({
      requestId: 'request-cancel-1',
      prompt: '取消写入',
    })

    expect(first.pendingId).toBeDefined()
    const confirmationTrace = mocks.saveTrace.mock.calls[0]?.[0]
    mocks.saveTrace.mockClear()
    expect(agentService.cancelPending(first.pendingId!)).toBe(true)
    expect(mocks.saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: confirmationTrace.traceId,
        sessionId: 'request-cancel-1',
        promptSummary: '取消写入',
        status: 'cancelled',
        finalText: '用户取消执行等待确认的 Agent 工具调用。',
      }),
    )
    await expect(
      agentService.resume({
        requestId: 'request-cancel-2',
        pendingId: first.pendingId!,
      }),
    ).rejects.toThrow(/确认请求已过期/)
    expect(agentService.cancelPending(first.pendingId!)).toBe(false)
  })

  it('evicts expired pending confirmations without recording cancelled traces', async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    mocks.runAgentCore.mockResolvedValueOnce(confirmationResult())
    const agentService = await loadService()

    const first = await agentService.run({
      requestId: 'request-expired-cancel-1',
      prompt: '过期写入',
    })

    expect(first.pendingId).toBeDefined()
    mocks.saveTrace.mockClear()
    vi.setSystemTime(new Date('2026-01-01T00:11:00Z'))

    expect(agentService.cancelPending(first.pendingId!)).toBe(false)
    expect(mocks.saveTrace).not.toHaveBeenCalled()
    await expect(
      agentService.resume({
        requestId: 'request-expired-cancel-2',
        pendingId: first.pendingId!,
      }),
    ).rejects.toThrow(/确认请求已过期/)

    vi.useRealTimers()
  })

  it('aborts active runs and clears the active aborter after completion', async () => {
    let capturedSignal: AbortSignal | undefined
    let resolveRun: ((result: AgentRunResult) => void) | undefined
    mocks.runAgentCore.mockImplementationOnce((options: AgentRunOptions) => {
      capturedSignal = options.signal
      return new Promise<AgentRunResult>((resolve) => {
        resolveRun = resolve
      })
    })
    const agentService = await loadService()

    const runPromise = agentService.run({
      requestId: 'request-5',
      prompt: '长任务',
    })
    await vi.waitFor(() => expect(capturedSignal).toBeDefined())

    expect(agentService.abort('request-5')).toBe(true)
    expect(capturedSignal?.aborted).toBe(true)
    resolveRun?.(completedResult())
    await expect(runPromise).resolves.toMatchObject({ status: 'completed' })
    expect(agentService.abort('request-5')).toBe(false)
  })

  it('saves a failed trace when the core throws before finalize', async () => {
    mocks.runAgentCore.mockRejectedValueOnce(new Error('model failed'))
    const agentService = await loadService()

    await expect(
      agentService.run({
        requestId: 'request-6',
        prompt: '失败任务',
      }),
    ).rejects.toThrow('model failed')
    expect(mocks.saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'request-6',
        promptSummary: '失败任务',
        finalText: expect.stringContaining('model failed'),
        status: 'failed',
        toolCalls: [],
      }),
    )
    expect(agentService.abort('request-6')).toBe(false)
  })

  it('saves failed traces with tool rounds captured before the failure', async () => {
    const error = new Error(
      'Agent 运行超时（已达到 1 秒上限）。请在「设置 > AI」调高 Run timeout，或缩短本次请求后重试。',
    ) as Error & {
      agentToolRounds: AgentRunResult['toolRounds']
    }
    error.name = 'AgentRunDeadlineError'
    error.agentToolRounds = [
      {
        name: 'search_and_open_entry',
        args: '{"query":"Rust async"}',
        resultSummary: '已打开最匹配文章',
        status: 'success',
        elapsedMs: 42,
      },
    ]
    mocks.runAgentCore.mockRejectedValueOnce(error)
    const agentService = await loadService()

    await expect(
      agentService.run({
        requestId: 'request-timeout-after-tool',
        prompt: '搜索后总结',
      }),
    ).rejects.toThrow('Agent 运行超时')

    expect(mocks.saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        sessionId: 'request-timeout-after-tool',
        promptSummary: '搜索后总结',
        finalText: expect.stringContaining('Agent 运行超时'),
        status: 'failed',
        toolCalls: [
          expect.objectContaining({
            toolName: 'search_and_open_entry',
            argsPreview: '{"query":"Rust async"}',
            status: 'success',
            resultSummary: '已打开最匹配文章',
            elapsedMs: 42,
          }),
        ],
      }),
    )
  })

  it('saves failed resume traces under the original request and trace id', async () => {
    mocks.runAgentCore.mockResolvedValueOnce(confirmationResult())
    mocks.resumeAgentCore.mockRejectedValueOnce(new Error('resume failed'))
    const agentService = await loadService()

    const first = await agentService.run({
      requestId: 'request-resume-fail-1',
      prompt: '继续失败',
    })
    const confirmationTrace = mocks.saveTrace.mock.calls[0]?.[0]
    mocks.saveTrace.mockClear()

    await expect(
      agentService.resume({
        requestId: 'request-resume-fail-2',
        pendingId: first.pendingId!,
      }),
    ).rejects.toThrow('resume failed')

    expect(mocks.saveTrace).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: confirmationTrace.traceId,
        sessionId: 'request-resume-fail-1',
        promptSummary: '继续失败',
        finalText: expect.stringContaining('resume failed'),
        status: 'failed',
      }),
    )
  })
})
