import { type PropsWithChildren } from 'react'

/**
 * DeferredProviders - renders children immediately for faster interactivity.
 * Non-critical providers are lazy-loaded via React.lazy in parent.
 */
export function DeferredProviders({ children }: PropsWithChildren) {
  return <>{children}</>
}
