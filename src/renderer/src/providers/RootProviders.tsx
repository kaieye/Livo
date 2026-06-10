import { lazy, Suspense, type PropsWithChildren } from 'react'
import { I18nProvider } from './I18nProvider'
import { SettingSyncProvider } from './SettingSyncProvider'
import { DeferredProviders } from './DeferredProviders'
import { QueryProvider } from './QueryProvider'

const DeferredAppProviders = lazy(() =>
  import('./deferred-app-providers').then((m) => ({
    default: m.DeferredAppProviders,
  })),
)

/**
 * RootProviders - Critical providers only
 * Non-critical providers (UpdateCheck, QueryVisibilityRefresh, PerformanceMetrics)
 * are deferred to after initial render.
 */
export function RootProviders({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>
        <SettingSyncProvider>
          {children}
          <DeferredProviders>
            <Suspense fallback={null}>
              <DeferredAppProviders />
            </Suspense>
          </DeferredProviders>
        </SettingSyncProvider>
      </QueryProvider>
    </I18nProvider>
  )
}
