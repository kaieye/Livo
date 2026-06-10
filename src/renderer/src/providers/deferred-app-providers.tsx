import { AppCommandProvider } from './AppCommandProvider'
import { GlobalShortcutsProvider } from './GlobalShortcutsProvider'
import { OverlayStackProvider } from './OverlayStackProvider'
import { QueryVisibilityRefreshProvider } from './QueryVisibilityRefreshProvider'
import { UpdateCheckProvider } from './UpdateCheckProvider'
import { PerformanceMetricsProvider } from './PerformanceMetricsProvider'

export function DeferredAppProviders() {
  return (
    <OverlayStackProvider>
      <AppCommandProvider>
        <GlobalShortcutsProvider>
          <QueryVisibilityRefreshProvider>
            <UpdateCheckProvider>
              <PerformanceMetricsProvider />
            </UpdateCheckProvider>
          </QueryVisibilityRefreshProvider>
        </GlobalShortcutsProvider>
      </AppCommandProvider>
    </OverlayStackProvider>
  )
}
