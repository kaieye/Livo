import { useEffect } from 'react'
import { recordAppMetric } from '../lib/performance-metrics'

export function PerformanceMetricsProvider() {
  useEffect(() => {
    const navEntry = performance.getEntriesByType('navigation')[0] as
      | PerformanceNavigationTiming
      | undefined
    if (navEntry) {
      recordAppMetric(
        'navigation.domContentLoaded',
        navEntry.domContentLoadedEventEnd,
      )
      recordAppMetric('navigation.loadEvent', navEntry.loadEventEnd)
    }

    if (typeof PerformanceObserver === 'undefined') return

    let disconnected = false
    const observer = new PerformanceObserver((list) => {
      if (disconnected) return
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          recordAppMetric('paint.lcp', entry.startTime)
        }
      }
    })

    try {
      observer.observe({ type: 'largest-contentful-paint', buffered: true })
    } catch {
      observer.disconnect()
      return
    }

    const onHidden = () => {
      disconnected = true
      observer.disconnect()
    }

    window.addEventListener('pagehide', onHidden, { once: true })
    document.addEventListener('visibilitychange', onHidden, { once: true })

    return () => {
      disconnected = true
      observer.disconnect()
      window.removeEventListener('pagehide', onHidden)
      document.removeEventListener('visibilitychange', onHidden)
    }
  }, [])

  return null
}
