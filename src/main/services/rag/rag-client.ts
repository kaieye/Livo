import { session } from 'electron'
import { getBackendBaseUrl } from '../backend/backend-config'
import { sessionStore } from '../auth/session-store'

export interface RagSearchInput {
  query: string
  scope?: 'subscribed' | 'all'
  limit?: number
  categories?: string[]
  publishedAfter?: string
  publishedBefore?: string
}

export interface RagSearchResult {
  documentId: string
  chunkId: string
  title: string
  url?: string | null
  sourceTitle?: string | null
  category?: string | null
  publishedAt?: string | null
  snippet: string
  score: number
}

interface RagSearchResponse {
  results?: RagSearchResult[]
}

export interface RagIndexStatus {
  documents: number
  chunks: number
  jobs: {
    pending: number
    running: number
    failed: number
    succeeded: number
  }
  latestIndexedAt: string | null
  latestFailedError: string | null
}

export interface RagSearchOptions {
  signal?: AbortSignal
}

async function fetchRagApi(
  path: string,
  init: RequestInit,
): Promise<Response | null> {
  const token = sessionStore.getValidToken()
  if (!token) return null

  const headers = {
    ...((init.headers as Record<string, string> | undefined) ?? {}),
    Authorization: `Bearer ${token}`,
  }

  return session.defaultSession.fetch(`${getBackendBaseUrl()}${path}`, {
    ...init,
    headers,
  })
}

export async function searchServerKnowledge(
  input: RagSearchInput,
  options: RagSearchOptions = {},
): Promise<RagSearchResult[]> {
  const response = await fetchRagApi('/api/rag/search', {
    method: 'POST',
    signal: options.signal,
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  })
  if (!response) return []

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return []
    }
    const text = await response.text().catch(() => '')
    throw new Error(
      `RAG search failed: ${response.status}${text ? ` ${text}` : ''}`,
    )
  }

  const payload = (await response.json()) as RagSearchResponse
  return Array.isArray(payload.results) ? payload.results : []
}

export async function getServerKnowledgeStatus(
  options: RagSearchOptions = {},
): Promise<RagIndexStatus | null> {
  const response = await fetchRagApi('/api/rag/status', {
    method: 'GET',
    signal: options.signal,
  })
  if (!response) return null

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      return null
    }
    const text = await response.text().catch(() => '')
    throw new Error(
      `RAG status failed: ${response.status}${text ? ` ${text}` : ''}`,
    )
  }

  return (await response.json()) as RagIndexStatus
}
