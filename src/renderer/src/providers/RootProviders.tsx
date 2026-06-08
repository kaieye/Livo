import { type PropsWithChildren } from 'react'
import { AppCommandProvider } from './AppCommandProvider'
import { AppBootstrapProvider } from './AppBootstrapProvider'
import { GlobalShortcutsProvider } from './GlobalShortcutsProvider'
import { I18nProvider } from './I18nProvider'
import { PerformanceMetricsProvider } from './PerformanceMetricsProvider'
import { OverlayStackProvider } from './OverlayStackProvider'
import { QueryProvider } from './QueryProvider'
import { QueryVisibilityRefreshProvider } from './QueryVisibilityRefreshProvider'
import { SettingSyncProvider } from './SettingSyncProvider'
import { UpdateCheckProvider } from './UpdateCheckProvider'
import { DeferredProviders } from './DeferredProviders'

/**
 * RootProviders split into two tiers for better startup performance:
 *
 * Tier 1 (Critical - mount immediately):
 *  - I18nProvider: Required for all text rendering
 *  - QueryProvider: Required for data fetching
 *  - OverlayStackProvider: Required for modals/dialogs
 *  - AppBootstrapProvider: Required for initial data setup
 *  - AppCommandProvider: Required for command execution
 *  - GlobalShortcutsProvider: Required for keyboard shortcuts
 *
 * Tier 2 (Non-critical - defer until idle):
 *  - QueryVisibilityRefreshProvider: Background refresh can wait
 *  - SettingSyncProvider: Settings sync is not blocking
 *  - UpdateCheckProvider: Update check can happen after app is ready
 *  - PerformanceMetricsProvider: Metrics collection is not blocking
 */
export function RootProviders({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>
        <OverlayStackProvider>
          <AppBootstrapProvider>
            <AppCommandProvider>
              <GlobalShortcutsProvider>
                <DeferredProviders>
                  <QueryVisibilityRefreshProvider>
                    <SettingSyncProvider>
                      <UpdateCheckProvider>
                        <PerformanceMetricsProvider />
                      </UpdateCheckProvider>
                    </SettingSyncProvider>
                  </QueryVisibilityRefreshProvider>
                </DeferredProviders>
                {children}
              </GlobalShortcutsProvider>
            </AppCommandProvider>
          </AppBootstrapProvider>
        </OverlayStackProvider>
      </QueryProvider>
    </I18nProvider>
  )
}
