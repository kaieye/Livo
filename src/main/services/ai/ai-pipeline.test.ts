import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AIDigestRun } from '../../../shared/types'
import { generateAIDigest } from './ai-pipeline'

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
