import { describe, expect, it } from 'vitest'
import {
  buildDigestBudgetPlan,
  buildDigestBatchMessages,
  buildDigestReduceMessages,
  buildDigestRerankMessages,
  getDigestArticleCharBudget,
  selectValidDigestRerankIds,
  type DigestCandidate,
} from './ai-digest'

const candidates: DigestCandidate[] = Array.from({ length: 9 }, (_, index) => ({
  id: `entry-${index + 1}`,
  title: `标题 ${index + 1}`,
  summary: `正文 ${index + 1} `.repeat(200),
  feedTitle: '科技',
}))

describe('ai digest tools', () => {
  it('keeps rerank ids inside the candidate set and preserves order', () => {
    const selection = selectValidDigestRerankIds(
      '{"ids":["entry-2","missing","entry-1","entry-2"]}',
      ['entry-1', 'entry-2'],
      5,
    )

    expect(selection).toEqual({
      ids: ['entry-2', 'entry-1'],
      rejectedIds: ['missing'],
    })
  })

  it('supports array shaped rerank output', () => {
    const selection = selectValidDigestRerankIds(
      '```json\n["entry-3","entry-1"]\n```',
      ['entry-1', 'entry-3'],
      1,
    )

    expect(selection.ids).toEqual(['entry-3'])
    expect(selection.rejectedIds).toEqual([])
  })

  it('builds digest batches with at most four articles by default', () => {
    const plan = buildDigestBudgetPlan(candidates, {
      totalContextChars: 10_000,
      promptReserveChars: 1_000,
      maxArticleChars: 2_000,
    })

    expect(plan.batches).toHaveLength(3)
    expect(plan.batches.every((batch) => batch.articles.length <= 4)).toBe(true)
    expect(plan.articleCharBudget).toBe(1000)
    expect(plan.batches[0].articles[0].text.length).toBeLessThanOrEqual(1000)
  })

  it('drops article text when the budget is exhausted', () => {
    const plan = buildDigestBudgetPlan(candidates.slice(0, 1), {
      totalContextChars: 100,
      promptReserveChars: 100,
    })

    expect(plan.articleCharBudget).toBe(0)
    expect(plan.batches[0].articles[0].text).toBe('')
  })

  it('reduces per article budget as candidate count grows', () => {
    expect(
      getDigestArticleCharBudget(3, {
        totalContextChars: 60_000,
        promptReserveChars: 6_000,
      }),
    ).toBe(8000)
    expect(
      getDigestArticleCharBudget(90, {
        totalContextChars: 60_000,
        promptReserveChars: 6_000,
      }),
    ).toBe(600)
  })

  it('builds rerank messages that only ask for candidate ids', () => {
    const messages = buildDigestRerankMessages({
      topic: 'AI 基础设施',
      maxIds: 3,
      candidates: candidates.slice(0, 2),
    })

    expect(messages).toHaveLength(2)
    expect(String(messages[0].content)).toContain('不要编造 id')
    expect(String(messages[1].content)).toContain('"maxIds":3')
    expect(String(messages[1].content)).toContain('entry-1')
  })

  it('builds batch notes messages with source ids', () => {
    const plan = buildDigestBudgetPlan(candidates.slice(0, 2))
    const messages = buildDigestBatchMessages({
      topic: '今日简报',
      presetLabel: '今日简报',
      batch: plan.batches[0],
    })

    expect(messages).toHaveLength(2)
    expect(String(messages[0].content)).toContain('不编造事实')
    expect(String(messages[1].content)).toContain('entry-1')
    expect(String(messages[1].content)).toContain('按主题聚合')
  })

  it('builds reduce messages from batch notes and window bounds', () => {
    const messages = buildDigestReduceMessages({
      topic: '本周趋势',
      presetLabel: '本周趋势',
      windowStartAt: Date.parse('2026-06-01T00:00:00.000Z'),
      windowEndAt: Date.parse('2026-06-02T00:00:00.000Z'),
      batchNotes: ['- 趋势 A（entry-1）'],
    })

    expect(messages).toHaveLength(2)
    expect(String(messages[1].content)).toContain('2026-06-01T00:00:00.000Z')
    expect(String(messages[1].content)).toContain('趋势 A')
    expect(String(messages[1].content)).toContain('不要输出代码块')
  })
})
