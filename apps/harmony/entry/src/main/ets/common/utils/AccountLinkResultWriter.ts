// Account link result writer
// Handles AppStorage persistence for account link operations

export type AccountProvider = 'youtube' | 'x' | 'instagram' | 'bilibili'

export interface AccountLinkResult {
  provider: AccountProvider
  displayName: string
  linked: boolean
}

const SETTINGS_ACTIVE_SHEET_KEY: string = 'settingsActiveSheetKey'

export function writeAccountLinkResult(result: AccountLinkResult): void {
  AppStorage.setOrCreate(SETTINGS_ACTIVE_SHEET_KEY, 'accounts')
  AppStorage.setOrCreate('settingsOverlayLevel', 1)
  AppStorage.setOrCreate('accountLinkResultProvider', result.provider)
  AppStorage.setOrCreate('accountLinkResultDisplayName', result.displayName)
  AppStorage.setOrCreate('accountLinkResultLinked', result.linked)
  AppStorage.setOrCreate('accountLinkResultAt', Date.now())
  AppStorage.setOrCreate('accountsStatusRefreshAt', Date.now())
}
