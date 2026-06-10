import { type PropsWithChildren, useEffect, useState } from 'react'

/**
 * DeferredProviders wrapper delays initialization of non-critical providers
 * until after the initial render is complete. This improves startup performance
 * by allowing critical UI to render first.
 */
export function DeferredProviders({ children }: PropsWithChildren) {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 0)
    return () => clearTimeout(timer)
  }, [])

  return <>{isReady ? children : null}</>
}
