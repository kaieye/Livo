import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getServerKnowledgeStatus, searchServerKnowledge } from './rag-client'

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  getValidToken: vi.fn(),
}))

vi.mock('electron', () => ({
  session: {
    defaultSession: {
      fetch: mocks.fetch,
    },
  },
}))

vi.mock('../auth/session-store', () => ({
  sessionStore: {
    getValidToken: mocks.getValidToken,
  },
}))

vi.mock('../backend/backend-config', () => ({
  getBackendBaseUrl: () => 'https://server.example',
}))

describe('searchServerKnowledge', () => {
  beforeEach(() => {
    mocks.fetch.mockReset()
    mocks.getValidToken.mockReset()
  })

  it('posts the query with the current bearer token', async () => {
    mocks.getValidToken.mockReturnValue('token_1')
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          results: [
            {
              documentId: 'doc_1',
              chunkId: 'chunk_1',
              title: 'AI Agent',
              snippet: 'Relevant snippet',
              score: 0.9,
            },
          ],
        }),
        { status: 200 },
      ),
    )

    const results = await searchServerKnowledge({
      query: 'AI Agent',
      limit: 5,
    })

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://server.example/api/rag/search',
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer token_1',
        },
        body: JSON.stringify({ query: 'AI Agent', limit: 5 }),
      }),
    )
    expect(results).toHaveLength(1)
  })

  it('returns empty results without a valid session token', async () => {
    mocks.getValidToken.mockReturnValue(null)

    await expect(searchServerKnowledge({ query: 'AI Agent' })).resolves.toEqual(
      [],
    )
    expect(mocks.fetch).not.toHaveBeenCalled()
  })

  it('returns empty results when the server rejects authorization', async () => {
    mocks.getValidToken.mockReturnValue('token_1')
    mocks.fetch.mockResolvedValue(new Response('', { status: 403 }))

    await expect(searchServerKnowledge({ query: 'AI Agent' })).resolves.toEqual(
      [],
    )
  })

  it('throws with detail when server returns other errors', async () => {
    mocks.getValidToken.mockReturnValue('token_1')
    mocks.fetch.mockResolvedValue(
      new Response('search backend broken', {
        status: 500,
        statusText: 'Internal Server Error',
      }),
    )

    await expect(searchServerKnowledge({ query: 'AI Agent' })).rejects.toThrow(
      'RAG search failed: 500',
    )
  })

  it('gets server knowledge index status with the current bearer token', async () => {
    mocks.getValidToken.mockReturnValue('token_1')
    mocks.fetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          documents: 2,
          chunks: 5,
          jobs: {
            pending: 0,
            running: 1,
            failed: 0,
            succeeded: 2,
          },
          latestIndexedAt: '2026-06-28T09:00:00.000Z',
          latestFailedError: null,
        }),
        { status: 200 },
      ),
    )

    const status = await getServerKnowledgeStatus()

    expect(mocks.fetch).toHaveBeenCalledWith(
      'https://server.example/api/rag/status',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Authorization: 'Bearer token_1',
        },
      }),
    )
    expect(status?.chunks).toBe(5)
  })

  it('returns null knowledge status without authorization', async () => {
    mocks.getValidToken.mockReturnValue('token_1')
    mocks.fetch.mockResolvedValue(new Response('', { status: 403 }))

    await expect(getServerKnowledgeStatus()).resolves.toBeNull()
  })
})
