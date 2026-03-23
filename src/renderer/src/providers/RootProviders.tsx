import { type PropsWithChildren } from "react"
import { AppBootstrapProvider } from "./AppBootstrapProvider"
import { GlobalShortcutsProvider } from "./GlobalShortcutsProvider"
import { I18nProvider } from "./I18nProvider"
import { QueryProvider } from "./QueryProvider"
import { QueryVisibilityRefreshProvider } from "./QueryVisibilityRefreshProvider"
import { SettingSyncProvider } from "./SettingSyncProvider"

export function RootProviders({ children }: PropsWithChildren) {
  return (
    <I18nProvider>
      <QueryProvider>
        <QueryVisibilityRefreshProvider>
          <SettingSyncProvider>
            <AppBootstrapProvider>
              <GlobalShortcutsProvider>{children}</GlobalShortcutsProvider>
            </AppBootstrapProvider>
          </SettingSyncProvider>
        </QueryVisibilityRefreshProvider>
      </QueryProvider>
    </I18nProvider>
  )
}
