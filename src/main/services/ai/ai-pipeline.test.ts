import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIDigestRun } from '../../../shared/types'
import { generateAIDigest, runAISummarizeTask } from './ai-pipeline'

const getDbMock = vi.hoisted(() => vi.fn())
const settingsProviderGetMock = vi.hoisted(() => vi.fn())
const validateAIConfigMock = vi.hoisted(() => vi.fn())
const createOpenAIClientMock = vi.hoisted(() => vi.fn())
const createCompletionMock = vi.hoisted(() => vi.fn())

vi.mock('../../database', () => ({
  getDb: getDbMock,
}))

vi.mock('../system/settings-provider', () => ({
  settingsProvider: { get: settingsProviderGetMock },
}))

vi.mock('./ai-client', () => ({
  validateAIConfig: validateAIConfigMock,
  createOpenAIClient: createOpenAIClientMock,
}))

vi.mock('../system/event-bus', () => ({
  getEventBus: () => ({ send: vi.fn() }),
}))

function makeDigestRun(overrides: Partial<AIDigestRun> = {}): AIDigestRun {
  return {
    id: 'digest-1',
    preset: 'today',
    title: '今日简报',
    status: 'running',
    windowStartAt: 1000,
    windowEndAt: 2000,
    sourceEntryIds: [],
    candidateCount: 2,
    content: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

describe('generateAIDigest', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsProviderGetMock.mockReturnValue({
      ai: {
        provider: 'deepseek',
        apiKey: 'test-key',
        model: 'deepseek-v4-pro',
        baseUrl: '',
      },
    })
    validateAIConfigMock.mockReturnValue(null)
    createOpenAIClientMock.mockReturnValue({
      chat: {
        completions: {
          create: createCompletionMock,
        },
      },
    })
    createCompletionMock
      .mockResolvedValueOnce({
        choices: [{ message: { content: '我会选择 entry-1 作为重点候选。' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '- 重点（entry-1）' } }],
      })
      .mockResolvedValueOnce({
        choices: [{ message: { content: '# 今日简报\n\n- 重点（entry-1）' } }],
      })

    let run = makeDigestRun()
    getDbMock.mockReturnValue({
      digests: {
        getDigestWindow: vi.fn(() => ({
          windowStartAt: 1000,
          windowEndAt: 2000,
        })),
        listDigestCandidates: vi.fn(() => [
          {
            id: 'entry-1',
            title: '第一篇',
            summary: '第一篇正文 '.repeat(100),
            feedTitle: '科技',
            publishedAt: 1900,
          },
          {
            id: 'entry-2',
            title: '第二篇',
            summary: '第二篇正文 '.repeat(100),
            feedTitle: '科技',
            publishedAt: 1800,
          },
        ]),
        upsertAIDigestRun: vi.fn((input) => {
          run = makeDigestRun(input)
          return run
        }),
        updateAIDigestRun: vi.fn((_id, updates) => {
          run = { ...run, ...updates, updatedAt: run.updatedAt + 1 }
          return run
        }),
      },
    })
  })

  it('disables DeepSeek thinking for every digest chat completion', async () => {
    const result = await generateAIDigest({ preset: 'today' })

    expect(result.success).toBe(true)
    expect(createCompletionMock).toHaveBeenCalledTimes(3)
    expect(
      createCompletionMock.mock.calls.map(([payload]) => payload.thinking),
    ).toEqual([
      { type: 'disabled' },
      { type: 'disabled' },
      { type: 'disabled' },
    ])
  })
})

describe('runAISummarizeTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    settingsProviderGetMock.mockReturnValue({
      ai: {
        provider: 'openai',
        apiKey: 'test-key',
        model: 'gpt-test',
        baseUrl: '',
        summaryPrompt: '',
      },
      general: { language: 'zh-CN' },
    })
    validateAIConfigMock.mockReturnValue(null)
    createOpenAIClientMock.mockReturnValue({
      chat: {
        completions: {
          create: createCompletionMock,
        },
      },
    })
  })

  it('persists running draft and succeeded states for streamed summary sessions', async () => {
    const updateSession = vi.fn()
    const updateEntry = vi.fn()
    getDbMock.mockReturnValue({
      aiSummarySessions: { updateSession },
      entries: { updateEntry },
    })
    async function* stream() {
      yield { choices: [{ delta: { content: '摘要' } }] }
      yield { choices: [{ delta: { content: '内容' } }] }
    }
    createCompletionMock.mockResolvedValueOnce(stream())

    await expect(
      runAISummarizeTask(
        {
          content: 'article content',
          language: 'zh-CN',
          requestId: 'request-1',
          entryId: 'entry-1',
          sessionId: 'session-1',
          sourceHash: 'hash-1',
        },
        {
          runId: 'run-1',
          taskName: 'entry.ai_summary',
          reportProgress: vi.fn(),
        },
      ),
    ).resolves.toEqual({ success: true, summary: '摘要内容' })

    expect(updateSession.mock.calls.map(([, patch]) => patch)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: 'running',
          model: 'gpt-test',
          sourceHash: 'hash-1',
          runId: 'run-1',
        }),
        expect.objectContaining({
          status: 'running',
          draftText: '摘要',
        }),
        expect.objectContaining({
          status: 'running',
          draftText: '摘要内容',
        }),
        expect.objectContaining({
          status: 'succeeded',
          draftText: '摘要内容',
          finalText: '摘要内容',
          errorCode: undefined,
          errorMessage: undefined,
          rawErrorMessage: undefined,
        }),
      ]),
    )
    expect(updateEntry).toHaveBeenCalledWith(
      'entry-1',
      expect.objectContaining({
        aiSummary: '摘要内容',
        aiSummaryError: undefined,
      }),
    )
  })

  it('persists failed summary session state when AI config is invalid', async () => {
    const updateSession = vi.fn()
    const updateEntry = vi.fn()
    getDbMock.mockReturnValue({
      aiSummarySessions: { updateSession },
      entries: { updateEntry },
    })
    validateAIConfigMock.mockReturnValueOnce('No API key')

    await expect(
      runAISummarizeTask({
        content: 'article content',
        language: 'zh-CN',
        entryId: 'entry-1',
        sessionId: 'session-1',
      }),
    ).rejects.toThrow('No API key')

    expect(updateSession).toHaveBeenCalledWith(
      'session-1',
      expect.objectContaining({
        status: 'failed',
        errorCode: 'provider_error',
        errorMessage: 'No API key',
        rawErrorMessage: 'No API key',
      }),
    )
  })
})
