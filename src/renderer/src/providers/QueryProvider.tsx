import { QueryClientProvider } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import type { PropsWithChildren } from 'react'
import {
  getRendererPersistOptions,
  getRendererQueryClient,
} from '../lib/query-client'

export function QueryProvider({ children }: PropsWithChildren) {
  const client = getRendererQueryClient()
  const persistOptions = getRendererPersistOptions()

  if (!persistOptions) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>
  }

  return (
    <PersistQueryClientProvider client={client} persistOptions={persistOptions}>
      {children}
    </PersistQueryClientProvider>
  )
}
