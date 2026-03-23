import { QueryClientProvider } from "@tanstack/react-query"
import type { PropsWithChildren } from "react"
import { getRendererQueryClient } from "../lib/query-client"

export function QueryProvider({ children }: PropsWithChildren) {
  return <QueryClientProvider client={getRendererQueryClient()}>{children}</QueryClientProvider>
}
