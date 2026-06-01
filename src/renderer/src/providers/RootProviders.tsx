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

export function RootProviders({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>
        <QueryVisibilityRefreshProvider>
          <OverlayStackProvider>
            <SettingSyncProvider>
              <AppBootstrapProvider>
                <AppCommandProvider>
                  <GlobalShortcutsProvider>
                    <UpdateCheckProvider>
                      <PerformanceMetricsProvider />
                      {children}
                    </UpdateCheckProvider>
                  </GlobalShortcutsProvider>
                </AppCommandProvider>
              </AppBootstrapProvider>
            </SettingSyncProvider>
          </OverlayStackProvider>
        </QueryVisibilityRefreshProvider>
      </QueryProvider>
    </I18nProvider>
  )
}
