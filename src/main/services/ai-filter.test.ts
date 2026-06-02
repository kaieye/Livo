import { describe, expect, it } from 'vitest'
import {
  buildSemanticFilterMessages,
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
