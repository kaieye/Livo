// Account link result writer
// Handles AppStorage persistence for account link operations

import {
  accountLinkResultAt,
  accountLinkResultDisplayName,
  accountLinkResultLinked,
  accountLinkResultProvider,
  accountsStatusRefreshAt,
  settingsActiveSheet,
  settingsOverlayLevel,
} from '../AppSignals'

export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface AccountLinkResult {
  provider: AccountProvider
  displayName: string
  linked: boolean
}

export function writeAccountLinkResult(result: AccountLinkResult): void {
  settingsActiveSheet.write('accounts')
  settingsOverlayLevel.write(1)
  accountLinkResultProvider.write(result.provider)
  accountLinkResultDisplayName.write(result.displayName)
  accountLinkResultLinked.write(result.linked)
  accountLinkResultAt.write(Date.now())
  accountsStatusRefreshAt.write(Date.now())
}
