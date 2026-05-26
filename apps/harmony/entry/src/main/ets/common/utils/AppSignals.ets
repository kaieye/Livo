/**
 * Typed signal module wrapping AppStorage.
 *
 * Each signal exports a key constant (for @StorageProp/@StorageLink consumers)
 * and typed write/read helpers. Producers and consumers are traceable through
 * imports — unlike ad-hoc AppStorage.setOrCreate with magic strings.
 */

// ── Discover overlay signals ──

export const DISCOVER_OVERLAY_LEVEL_KEY = 'discoverOverlayLevel'
export function writeDiscoverOverlayLevel(value: number): void {
  AppStorage.setOrCreate<number>(DISCOVER_OVERLAY_LEVEL_KEY, value)
}
export function readDiscoverOverlayLevel(): number {
  return (AppStorage.get<number>(DISCOVER_OVERLAY_LEVEL_KEY)) ?? 0
}

export const DISCOVER_HAS_FOREGROUND_OVERLAY_KEY = 'discoverHasForegroundOverlay'
export function writeDiscoverHasForegroundOverlay(value: boolean): void {
  AppStorage.setOrCreate<boolean>(DISCOVER_HAS_FOREGROUND_OVERLAY_KEY, value)
}

export const DISCOVER_ROOT_VISIBLE_SINCE_KEY = 'discoverRootVisibleSince'
export function writeDiscoverRootVisibleSince(value: number): void {
  AppStorage.setOrCreate<number>(DISCOVER_ROOT_VISIBLE_SINCE_KEY, value)
}

export const DISCOVER_SEARCH_DISMISS_AT_KEY = 'discoverSearchDismissAt'
export function writeDiscoverSearchDismissAt(value: number): void {
  AppStorage.setOrCreate<number>(DISCOVER_SEARCH_DISMISS_AT_KEY, value)
}

export const DISCOVER_NAVIGATION_RESET_AT_KEY = 'discoverNavigationResetAt'
export function writeDiscoverNavigationResetAt(value: number): void {
  AppStorage.setOrCreate<number>(DISCOVER_NAVIGATION_RESET_AT_KEY, value)
}

export const DISCOVER_OVERLAY_BACK_AT_KEY = 'discoverOverlayBackAt'
export function writeDiscoverOverlayBackAt(value: number): void {
  AppStorage.setOrCreate<number>(DISCOVER_OVERLAY_BACK_AT_KEY, value)
}

// ── Account link result signals ──

export const ACCOUNT_LINK_RESULT_PROVIDER_KEY = 'accountLinkResultProvider'
export function writeAccountLinkResultProvider(value: string): void {
  AppStorage.setOrCreate<string>(ACCOUNT_LINK_RESULT_PROVIDER_KEY, value)
}

export const ACCOUNT_LINK_RESULT_DISPLAY_NAME_KEY = 'accountLinkResultDisplayName'
export function writeAccountLinkResultDisplayName(value: string): void {
  AppStorage.setOrCreate<string>(ACCOUNT_LINK_RESULT_DISPLAY_NAME_KEY, value)
}

export const ACCOUNT_LINK_RESULT_LINKED_KEY = 'accountLinkResultLinked'
export function writeAccountLinkResultLinked(value: boolean): void {
  AppStorage.setOrCreate<boolean>(ACCOUNT_LINK_RESULT_LINKED_KEY, value)
}

export const ACCOUNT_LINK_RESULT_AT_KEY = 'accountLinkResultAt'
export function writeAccountLinkResultAt(value: number): void {
  AppStorage.setOrCreate<number>(ACCOUNT_LINK_RESULT_AT_KEY, value)
}

export const ACCOUNTS_STATUS_REFRESH_AT_KEY = 'accountsStatusRefreshAt'
export function writeAccountsStatusRefreshAt(value: number): void {
  AppStorage.setOrCreate<number>(ACCOUNTS_STATUS_REFRESH_AT_KEY, value)
}

// ── Settings sheet signals ──

export const SETTINGS_ACTIVE_SHEET_KEY = 'settingsActiveSheetKey'
export function writeSettingsActiveSheet(value: string): void {
  AppStorage.setOrCreate<string>(SETTINGS_ACTIVE_SHEET_KEY, value)
}
export function readSettingsActiveSheet(): string {
  return (AppStorage.get<string>(SETTINGS_ACTIVE_SHEET_KEY)) ?? ''
}

export const SETTINGS_OVERLAY_LEVEL_KEY = 'settingsOverlayLevel'
export function writeSettingsOverlayLevel(value: number): void {
  AppStorage.setOrCreate<number>(SETTINGS_OVERLAY_LEVEL_KEY, value)
}

// ── Subscriptions overlay signals ──

export const SUBSCRIPTIONS_OVERLAY_LEVEL_KEY = 'subscriptionsOverlayLevel'
export function writeSubscriptionsOverlayLevel(value: number): void {
  AppStorage.setOrCreate<number>(SUBSCRIPTIONS_OVERLAY_LEVEL_KEY, value)
}
export function readSubscriptionsOverlayLevel(): number {
  return (AppStorage.get<number>(SUBSCRIPTIONS_OVERLAY_LEVEL_KEY)) ?? 0
}

export const SUBSCRIPTIONS_OVERLAY_BACK_AT_KEY = 'subscriptionsOverlayBackAt'
export function writeSubscriptionsOverlayBackAt(value: number): void {
  AppStorage.setOrCreate<number>(SUBSCRIPTIONS_OVERLAY_BACK_AT_KEY, value)
}

// ── Subscriptions rail signals ──

export const SUBSCRIPTIONS_RAIL_DISMISS_PROGRESS_KEY = 'subscriptionsRailDismissProgress'
export function writeSubscriptionsRailDismissProgress(value: number): void {
  AppStorage.setOrCreate<number>(SUBSCRIPTIONS_RAIL_DISMISS_PROGRESS_KEY, value)
}
