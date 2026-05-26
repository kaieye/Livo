// Account link result writer
// Handles AppStorage persistence for account link operations

import {
  writeAccountLinkResultAt,
  writeAccountLinkResultDisplayName,
  writeAccountLinkResultLinked,
  writeAccountLinkResultProvider,
  writeAccountsStatusRefreshAt,
  writeSettingsActiveSheet,
  writeSettingsOverlayLevel,
} from '../AppSignals'

export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface AccountLinkResult {
  provider: AccountProvider
  displayName: string
  linked: boolean
}

export function writeAccountLinkResult(result: AccountLinkResult): void {
  writeSettingsActiveSheet('accounts')
  writeSettingsOverlayLevel(1)
  writeAccountLinkResultProvider(result.provider)
  writeAccountLinkResultDisplayName(result.displayName)
  writeAccountLinkResultLinked(result.linked)
  writeAccountLinkResultAt(Date.now())
  writeAccountsStatusRefreshAt(Date.now())
}
