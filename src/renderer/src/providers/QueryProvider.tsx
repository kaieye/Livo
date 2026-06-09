import { QueryClientProvider } from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { getRendererQueryClient } from '../lib/query-client'

/**
 * QueryProvider - 提供 React Query 客户端
 *
 * 性能优化：移除了 PersistQueryClientProvider，避免启动时同步读取 localStorage
 * 导致的主线程阻塞（100-300ms）。数据持久化改由 IndexedDB hydrate 机制处理。
 */
export function QueryProvider({ children }: PropsWithChildren) {
  const client = getRendererQueryClient()

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
