import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildSearchLivoKnowledgeTool } from './rag-tools'
import {
  getServerKnowledgeStatus,
  searchServerKnowledgeResponse,
} from '../../services/rag/rag-client'

vi.mock('../../services/rag/rag-client', () => ({
  getServerKnowledgeStatus: vi.fn(),
  searchServerKnowledgeResponse: vi.fn(),
}))

describe('buildSearchLivoKnowledgeTool', () => {
  beforeEach(() => {
    vi.mocked(searchServerKnowledgeResponse).mockReset()
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
    vi.mocked(searchServerKnowledgeResponse).mockResolvedValue({
      results: [
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
          evidence: [
            {
              chunkId: 'chunk_1',
              quote: 'AI Agent 正在成为工具调用的重要形态。',
              snippet: 'AI Agent 正在成为工具调用的重要形态。',
              score: 0.84,
            },
            {
              chunkId: 'chunk_2',
              quote: '工具调用让 Agent 能连接外部系统。',
              snippet: '工具调用让 Agent 能连接外部系统。',
              score: 0.77,
            },
          ],
          whyMatched: ['关键词命中', '内容质量较高'],
        },
      ],
      trace: {
        traceId: 'trace_1',
        vectorHits: 0,
        textHits: 1,
        returned: 1,
      },
    })
    const tool = buildSearchLivoKnowledgeTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      { query: 'AI Agent', limit: 5, category: 'ai' },
    )

    expect(searchServerKnowledgeResponse).toHaveBeenCalledWith(
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
    expect(result.message).toContain('证据 1 (0.84)')
    expect(result.message).toContain('工具调用让 Agent 能连接外部系统')
    expect(result.message).toContain('匹配原因: 关键词命中、内容质量较高')
    expect(result.message).toContain('trace_1')
    expect(result.data?.count).toBe(1)
    expect(result.data?.traceId).toBe('trace_1')
  })

  it('returns a failed tool result when backend is unavailable', async () => {
    vi.mocked(searchServerKnowledgeResponse).mockRejectedValue(
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
    vi.mocked(searchServerKnowledgeResponse).mockResolvedValue({
      results: [],
      trace: {
        traceId: 'trace_empty',
        returned: 0,
        emptyReason: 'no_retrieval_hits',
      },
    })
    const tool = buildSearchLivoKnowledgeTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      { query: 'AI Agent', category: 'ai' },
    )

    expect(searchServerKnowledgeResponse).toHaveBeenCalledWith(
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
    expect(result.data?.traceId).toBe('trace_empty')
  })

  it('includes index status context when a search has no hits', async () => {
    vi.mocked(searchServerKnowledgeResponse).mockResolvedValue({
      results: [],
    })
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

  it('uses server empty reason when available', async () => {
    vi.mocked(searchServerKnowledgeResponse).mockResolvedValue({
      results: [],
      trace: {
        traceId: 'trace_filtered',
        returned: 0,
        emptyReason: 'filtered_out',
      },
    })
    const tool = buildSearchLivoKnowledgeTool()

    const result = await tool.execute(
      {
        sessionId: 'test',
        now: Date.now(),
        signal: new AbortController().signal,
      },
      { query: 'AI Agent', category: 'ai' },
    )

    expect(result.message).toContain('过滤条件排除了所有已索引内容')
    expect(result.message).toContain('trace_filtered')
    expect(result.data?.trace).toEqual(
      expect.objectContaining({
        emptyReason: 'filtered_out',
      }),
    )
  })

  it('passes published date filters through to the server search client', async () => {
    vi.mocked(searchServerKnowledgeResponse).mockResolvedValue({
      results: [],
    })
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

    expect(searchServerKnowledgeResponse).toHaveBeenCalledWith(
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
