import { beforeEach, describe, expect, it, vi } from 'vitest'

const validateAIConfigMock = vi.hoisted(() => vi.fn())
const createOpenAIClientMock = vi.hoisted(() => vi.fn())
const createCompletionMock = vi.hoisted(() => vi.fn())

vi.mock('./ai-client', () => ({
  validateAIConfig: validateAIConfigMock,
  createOpenAIClient: createOpenAIClientMock,
}))

import {
  buildSemanticFilterMessages,
  judgeSemanticFilter,
  parseSemanticFilterDecision,
} from './ai-filter'

describe('ai semantic filter', () => {
  it('builds a compact title and summary based prompt', () => {
    const messages = buildSemanticFilterMessages({
      condition: '过滤掉明显的广告软文',
      title: '新品发布',
      summary: '这是一段摘要。'.repeat(500),
      feedTitle: '科技观察',
      author: '编辑部',
      url: 'https://example.com/post',
    })

    expect(messages).toHaveLength(2)
    expect(String(messages[1].content)).toContain(
      '过滤条件：过滤掉明显的广告软文',
    )
    expect(String(messages[1].content)).toContain('标题：新品发布')
    expect(String(messages[1].content).length).toBeLessThan(3200)
  })

  it('parses strict JSON decisions and clamps confidence', () => {
    const decision = parseSemanticFilterDecision(
      '{"matched":true,"confidence":1.4,"reason":"标题和摘要都在推广购买"}',
    )

    expect(decision).toEqual({
      matched: true,
      confidence: 1,
      reason: '标题和摘要都在推广购买',
    })
  })

  it('rejects model output without a boolean decision', () => {
    expect(() =>
      parseSemanticFilterDecision('{"confidence":0.8,"reason":"命中"}'),
    ).toThrow('matched')
  })
})

describe('judgeSemanticFilter through the shared completion seam', () => {
  const config = {
    provider: 'deepseek' as const,
    apiKey: 'test-key',
    model: 'deepseek-v4-pro',
    baseUrl: '',
  }
  const input = {
    condition: '过滤掉广告',
    title: '新品发布',
    summary: '这是摘要',
    feedTitle: '科技',
  }

  beforeEach(() => {
    vi.clearAllMocks()
    validateAIConfigMock.mockReturnValue(null)
    createOpenAIClientMock.mockReturnValue({
      chat: { completions: { create: createCompletionMock } },
    })
  })

  it('disables DeepSeek thinking and parses the decision', async () => {
    createCompletionMock.mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: '{"matched":true,"confidence":0.9,"reason":"是广告"}',
          },
        },
      ],
    })

    const decision = await judgeSemanticFilter(input, config)

    expect(decision).toEqual({
      matched: true,
      confidence: 0.9,
      reason: '是广告',
    })
    expect(createCompletionMock.mock.calls[0][0]).toMatchObject({
      model: 'deepseek-v4-pro',
      temperature: 0,
      thinking: { type: 'disabled' },
    })
  })

  it('retries unparseable output then succeeds (max 2 attempts)', async () => {
    createCompletionMock
      .mockResolvedValueOnce({
        choices: [{ message: { content: '抱歉，我无法判断。' } }],
      })
      .mockResolvedValueOnce({
        choices: [
          {
            message: {
              content: '{"matched":false,"confidence":0.2,"reason":"普通文章"}',
            },
          },
        ],
      })

    const decision = await judgeSemanticFilter(input, config)

    expect(decision.matched).toBe(false)
    expect(createCompletionMock).toHaveBeenCalledTimes(2)
  })

  it('throws the config error when validation fails', async () => {
    validateAIConfigMock.mockReturnValueOnce('请先在设置中配置 AI API Key')

    await expect(judgeSemanticFilter(input, config)).rejects.toThrow(
      '请先在设置中配置 AI API Key',
    )
    expect(createCompletionMock).not.toHaveBeenCalled()
  })
})
