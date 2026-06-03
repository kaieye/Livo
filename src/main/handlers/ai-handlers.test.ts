import { beforeEach, describe, expect, it, vi } from 'vitest'
import { IPC, unwrapIpcEnvelope } from '../../shared/ipc-contracts'
import {
  AI_SUMMARIZE_TASK,
  AI_TRANSLATE_TASK,
} from '../services/system/task-contracts'

const mocks = vi.hoisted(() => ({
  handle: vi.fn(),
  eventSend: vi.fn(),
  getSettings: vi.fn(),
  validateAIConfig: vi.fn(),
  createOpenAIClient: vi.fn(),
  createCompletion: vi.fn(),
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: mocks.handle,
  },
}))

vi.mock('./settings-handlers', () => ({
  getSettings: mocks.getSettings,
}))

vi.mock('../services/ai/ai-client', () => ({
  validateAIConfig: mocks.validateAIConfig,
  createOpenAIClient: mocks.createOpenAIClient,
}))

vi.mock('../services/system/event-bus', () => ({
  getEventBus: () => ({
    send: mocks.eventSend,
  }),
}))

vi.mock('../services/system/logger', () => ({
  logError: vi.fn(),
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

vi.mock('../database', () => ({
  getDigestWindow: vi.fn(),
  listAIDigestRuns: vi.fn(),
  listDigestCandidates: vi.fn(),
  updateAIDigestRun: vi.fn(),
  upsertAIDigestRun: vi.fn(),
}))

type RegisteredHandler = (
  event: Record<string, never>,
  ...args: unknown[]
) => Promise<unknown>

function getRegisteredHandler(channel: string): RegisteredHandler {
  const call = mocks.handle.mock.calls.find(
    ([registered]) => registered === channel,
  )
  if (!call) throw new Error(`Missing IPC handler: ${channel}`)
  return call[1] as RegisteredHandler
}

describe('registerAIHandlers', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const { resetLocalTaskRunnerForTest } =
      await import('../services/system/task-runner-service')
    resetLocalTaskRunnerForTest()
    mocks.getSettings.mockReturnValue({
      ai: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-test',
        baseUrl: '',
        summaryPrompt: '',
        translationPrompt: '',
      },
      general: { language: 'zh-CN' },
    })
    mocks.validateAIConfig.mockReturnValue(null)
    mocks.createCompletion.mockResolvedValue({
      choices: [{ message: { content: '摘要内容' } }],
    })
    mocks.createOpenAIClient.mockReturnValue({
      chat: {
        completions: {
          create: mocks.createCompletion,
        },
      },
    })
  })

  it('records summarize requests in the local Task Runner', async () => {
    const { registerAIHandlers } = await import('./ai-handlers')
    registerAIHandlers()

    const summarize = getRegisteredHandler(IPC.AI_SUMMARIZE)
    const result = unwrapIpcEnvelope(
      await summarize({}, 'article content', 'zh-CN'),
    )

    expect(result).toMatchObject({
      success: true,
      summary: '摘要内容',
      runId: expect.stringContaining('ai-summarize'),
    })
    const runRecords = mocks.eventSend.mock.calls
      .filter(([channel]) => channel === 'tasks:run-updated')
      .map(([, record]) => record)
    expect(runRecords.at(-1)).toMatchObject({
      taskName: AI_SUMMARIZE_TASK.name,
      status: 'succeeded',
      metadata: {
        operationKey: 'ai.summarize',
        language: 'zh-CN',
        contentLength: 'article content'.length,
      },
    })
  })

  it('records translate requests in the local Task Runner', async () => {
    mocks.createCompletion.mockResolvedValueOnce({
      choices: [{ message: { content: 'translated content' } }],
    })
    const { registerAIHandlers } = await import('./ai-handlers')
    registerAIHandlers()

    const translate = getRegisteredHandler(IPC.AI_TRANSLATE)
    const result = unwrapIpcEnvelope(
      await translate({}, 'article content', 'en-US'),
    )

    expect(result).toMatchObject({
      success: true,
      translation: 'translated content',
      runId: expect.stringContaining('ai-translate'),
    })
    const runRecords = mocks.eventSend.mock.calls
      .filter(([channel]) => channel === 'tasks:run-updated')
      .map(([, record]) => record)
    expect(runRecords.at(-1)).toMatchObject({
      taskName: AI_TRANSLATE_TASK.name,
      status: 'succeeded',
      metadata: {
        operationKey: 'ai.translate',
        targetLanguage: 'en-US',
        contentLength: 'article content'.length,
      },
    })
  })
})
