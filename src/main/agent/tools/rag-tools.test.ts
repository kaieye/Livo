import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSearchLivoKnowledgeTool } from './rag-tools'
import {
  getServerKnowledgeStatus,
  searchServerKnowledge,
} from '../../services/rag/rag-client'

vi.mock('../../services/rag/rag-client', () => ({
  getServerKnowledgeStatus: vi.fn(),
  searchServerKnowledge: vi.fn(),
}))

describe('buildSearchLivoKnowledgeTool', () => {
  beforeEach(() => {
    vi.mocked(searchServerKnowledge).mockReset()
    vi.mocked(getServerKnowledgeStatus).mockReset()
    vi.mocked(getServerKnowledgeStatus).mockResolvedValue(null)
  })

  it('registers as a low-risk read tool', () => {
    const tool = buildSearchLivoKnowledgeTool()

    expect(tool.name).toBe('search_livo_knowledge')
    expect(tool.capability).toBe('read')
    expect(tool.risk).toBe('low')
    expect(tool.requiresConfirmation).toBe(false)
  })

  it('returns formatted knowledge snippets with source metadata', async () => {
    vi.mocked(searchServerKnowledge).mockResolvedValue([
      {
        documentId: 'doc_1',
        chunkId: 'chunk_1',
        title: 'AI Agent 观察',
        url: 'https://example.com/post',
        sourceTitle: 'Example Feed',
        category: 'ai',
        publishedAt: '2026-06-20T10:00:00.000Z',
        snippet: 'AI Agent 正在成为工具调用的重要形态。',
        score: 0.82,
      },
    ])
    const tool = buildSearchLivoKnowledgeTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      { query: 'AI Agent', limit: 5, category: 'ai' },
    )

    expect(searchServerKnowledge).toHaveBeenCalledWith(
      {
        query: 'AI Agent',
        limit: 5,
        scope: 'subscribed',
        categories: ['ai'],
      },
      { signal: expect.any(AbortSignal) },
    )
    expect(result.status).toBe('success')
    expect(result.message).toContain('AI Agent 观察')
    expect(result.message).toContain('Example Feed')
    expect(result.data?.count).toBe(1)
  })

  it('returns a failed tool result when backend is unavailable', async () => {
    vi.mocked(searchServerKnowledge).mockRejectedValue(
      new Error('service unavailable'),
    )
    const tool = buildSearchLivoKnowledgeTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      { query: 'AI Agent' },
    )

    expect(result.status).toBe('failed')
    expect(result.message).toContain('服务端知识库暂不可用')
    expect(result.message).toContain('service unavailable')
  })

  it('supports category filtering parameter', async () => {
    vi.mocked(searchServerKnowledge).mockResolvedValue([])
    const tool = buildSearchLivoKnowledgeTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      { query: 'AI Agent', category: 'ai' },
    )

    expect(searchServerKnowledge).toHaveBeenCalledWith(
      {
        query: 'AI Agent',
        limit: 8,
        scope: 'subscribed',
        categories: ['ai'],
      },
      { signal: expect.any(AbortSignal) },
    )
    expect(result.status).toBe('success')
    expect(result.data?.count).toBe(0)
  })

  it('includes index status context when a search has no hits', async () => {
    vi.mocked(searchServerKnowledge).mockResolvedValue([])
    vi.mocked(getServerKnowledgeStatus).mockResolvedValue({
      documents: 0,
      chunks: 0,
      jobs: {
        pending: 2,
        running: 1,
        failed: 0,
        succeeded: 0,
      },
      latestIndexedAt: null,
      latestFailedError: null,
    })
    const tool = buildSearchLivoKnowledgeTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      { query: 'AI Agent' },
    )

    expect(getServerKnowledgeStatus).toHaveBeenCalledWith({
      signal: expect.any(AbortSignal),
    })
    expect(result.message).toContain('仍有 3 个索引任务')
    expect(result.data?.status).toEqual(
      expect.objectContaining({
        chunks: 0,
      }),
    )
  })

  it('passes published date filters through to the server search client', async () => {
    vi.mocked(searchServerKnowledge).mockResolvedValue([])
    const tool = buildSearchLivoKnowledgeTool()

    await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      {
        query: 'AI Agent',
        publishedAfter: '2026-01-01',
        publishedBefore: '2026-06-30T23:59:59.000Z',
      },
    )

    expect(searchServerKnowledge).toHaveBeenCalledWith(
      {
        query: 'AI Agent',
        limit: 8,
        scope: 'subscribed',
        publishedAfter: '2026-01-01',
        publishedBefore: '2026-06-30T23:59:59.000Z',
      },
      { signal: expect.any(AbortSignal) },
    )
  })
})
