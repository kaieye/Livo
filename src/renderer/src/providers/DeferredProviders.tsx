import { type PropsWithChildren, useEffect, useState } from 'react'

/**
 * DeferredProviders wrapper delays initialization of non-critical providers
 * until after the initial render is complete. This improves startup performance
 * by allowing critical UI to render first.
 *
 * Non-critical providers include:
 * - UpdateCheckProvider (can check for updates after app is ready)
 * - QueryVisibilityRefreshProvider (background refresh can wait)
 * - PerformanceMetricsProvider (metrics collection is not blocking)
 */
export function DeferredProviders({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Use requestIdleCallback to defer initialization until browser is idle
    // Falls back to setTimeout if requestIdleCallback is not available
    const scheduleDeferred = () => {
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(() => setIsReady(true), { timeout: 500 })
      } else {
        setTimeout(() => setIsReady(true), 100)
      }
    }

    scheduleDeferred()
  }, [])

  // Render children immediately, but wrapped providers will only initialize when ready
  return <>{isReady ? children : null}</>
}
