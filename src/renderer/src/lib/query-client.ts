import { QueryClient } from "@tanstack/react-query"

let rendererQueryClient: QueryClient | null = null

export function getRendererQueryClient(): QueryClient {
  if (!rendererQueryClient) {
    rendererQueryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 30_000,
          gcTime: 5 * 60_000,
          retry: 1,
          refetchOnWindowFocus: false,
          refetchOnReconnect: false,
        },
      },
    })
  }

  return rendererQueryClient
}
