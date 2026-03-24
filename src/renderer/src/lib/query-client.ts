import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import { QueryClient } from '@tanstack/react-query'
import type { PersistQueryClientOptions } from '@tanstack/react-query-persist-client'

const DEFAULT_STALE_TIME_MS = 30_000
const DEFAULT_GC_TIME_MS = 5 * 60_000
const QUERY_PERSIST_KEY = 'livo.react-query-cache.v1'
const QUERY_PERSIST_MAX_AGE_MS = 12 * 60 * 60 * 1000
const DO_NOT_RETRY_STATUS_CODES = new Set([400, 401, 403, 404, 422])

let rendererQueryClient: QueryClient | null = null
let rendererPersistOptions: Omit<
  PersistQueryClientOptions,
  'queryClient'
> | null = null
let rendererPersistOptionsInitialized = false

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      persist?: boolean
    }
  }
}

function getErrorStatusCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null

  const record = error as Record<string, unknown>
  const candidates = [
    record['status'],
    record['statusCode'],
    typeof record['response'] === 'object' && record['response']
      ? (record['response'] as Record<string, unknown>)['status']
      : null,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'number' && Number.isFinite(candidate)) {
      return candidate
    }
  }

  return null
}

export function getRendererQueryClient(): QueryClient {
  if (!rendererQueryClient) {
    rendererQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: DEFAULT_STALE_TIME_MS,
          gcTime: DEFAULT_GC_TIME_MS,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
          retry(failureCount, error) {
            const statusCode = getErrorStatusCode(error)
            if (
              statusCode !== null &&
              DO_NOT_RETRY_STATUS_CODES.has(statusCode)
            ) {
              return false
            }
            return failureCount < 2
          },
        },
      },
    })
  }

  return rendererQueryClient
}

export function getRendererPersistOptions(): Omit<
  PersistQueryClientOptions,
  'queryClient'
> | null {
  if (rendererPersistOptionsInitialized) {
    return rendererPersistOptions
  }
  rendererPersistOptionsInitialized = true

  if (typeof window === 'undefined') {
    rendererPersistOptions = null
    return rendererPersistOptions
  }

  rendererPersistOptions = {
    persister: createSyncStoragePersister({
      storage: window.localStorage,
      key: QUERY_PERSIST_KEY,
    }),
    maxAge: QUERY_PERSIST_MAX_AGE_MS,
    dehydrateOptions: {
      shouldDehydrateQuery: (query) => {
        if (!query.meta?.persist) return false
        if (query.state.status !== 'success') return false

        const data = query.state.data as { pages?: unknown[] } | undefined
        return !Array.isArray(data?.pages)
      },
    },
  }

  return rendererPersistOptions
}
