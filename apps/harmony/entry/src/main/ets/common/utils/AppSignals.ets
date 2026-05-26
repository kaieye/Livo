/**
 * Typed signal module wrapping AppStorage.
 *
 * Each signal exports a key constant (for @StorageProp/@StorageLink consumers)
 * and a signal object with typed write/read helpers.
 */

class AppSignal<T> {
  readonly key: string
  private readonly defaultValue: T | undefined

  constructor(key: string, defaultValue?: T) {
    this.key = key
    this.defaultValue = defaultValue
  }

  write(value: T): void {
    AppStorage.setOrCreate<T>(this.key, value)
  }

  read(): T {
    return AppStorage.get<T>(this.key) ?? this.defaultValue as T
  }
}

// ── Discover overlay signals ──

export const DISCOVER_OVERLAY_LEVEL_KEY = 'discoverOverlayLevel'
export const discoverOverlayLevel: AppSignal<number> = new AppSignal<number>(DISCOVER_OVERLAY_LEVEL_KEY, 0)

export const DISCOVER_HAS_FOREGROUND_OVERLAY_KEY = 'discoverHasForegroundOverlay'
export const discoverHasForegroundOverlay: AppSignal<boolean> = new AppSignal<boolean>(DISCOVER_HAS_FOREGROUND_OVERLAY_KEY)

export const DISCOVER_ROOT_VISIBLE_SINCE_KEY = 'discoverRootVisibleSince'
export const discoverRootVisibleSince: AppSignal<number> = new AppSignal<number>(DISCOVER_ROOT_VISIBLE_SINCE_KEY)

export const DISCOVER_SEARCH_DISMISS_AT_KEY = 'discoverSearchDismissAt'
export const discoverSearchDismissAt: AppSignal<number> = new AppSignal<number>(DISCOVER_SEARCH_DISMISS_AT_KEY)

export const DISCOVER_NAVIGATION_RESET_AT_KEY = 'discoverNavigationResetAt'
export const discoverNavigationResetAt: AppSignal<number> = new AppSignal<number>(DISCOVER_NAVIGATION_RESET_AT_KEY)

export const DISCOVER_OVERLAY_BACK_AT_KEY = 'discoverOverlayBackAt'
export const discoverOverlayBackAt: AppSignal<number> = new AppSignal<number>(DISCOVER_OVERLAY_BACK_AT_KEY)

// ── Account link result signals ──

export const ACCOUNT_LINK_RESULT_PROVIDER_KEY = 'accountLinkResultProvider'
export const accountLinkResultProvider: AppSignal<string> = new AppSignal<string>(ACCOUNT_LINK_RESULT_PROVIDER_KEY)

export const ACCOUNT_LINK_RESULT_DISPLAY_NAME_KEY = 'accountLinkResultDisplayName'
export const accountLinkResultDisplayName: AppSignal<string> = new AppSignal<string>(ACCOUNT_LINK_RESULT_DISPLAY_NAME_KEY)

export const ACCOUNT_LINK_RESULT_LINKED_KEY = 'accountLinkResultLinked'
export const accountLinkResultLinked: AppSignal<boolean> = new AppSignal<boolean>(ACCOUNT_LINK_RESULT_LINKED_KEY)

export const ACCOUNT_LINK_RESULT_AT_KEY = 'accountLinkResultAt'
export const accountLinkResultAt: AppSignal<number> = new AppSignal<number>(ACCOUNT_LINK_RESULT_AT_KEY)

export const ACCOUNTS_STATUS_REFRESH_AT_KEY = 'accountsStatusRefreshAt'
export const accountsStatusRefreshAt: AppSignal<number> = new AppSignal<number>(ACCOUNTS_STATUS_REFRESH_AT_KEY)

// ── Settings sheet signals ──

export const SETTINGS_ACTIVE_SHEET_KEY = 'settingsActiveSheetKey'
export const settingsActiveSheet: AppSignal<string> = new AppSignal<string>(SETTINGS_ACTIVE_SHEET_KEY, '')

export const SETTINGS_OVERLAY_LEVEL_KEY = 'settingsOverlayLevel'
export const settingsOverlayLevel: AppSignal<number> = new AppSignal<number>(SETTINGS_OVERLAY_LEVEL_KEY)

// ── Subscriptions overlay signals ──

export const SUBSCRIPTIONS_OVERLAY_LEVEL_KEY = 'subscriptionsOverlayLevel'
export const subscriptionsOverlayLevel: AppSignal<number> = new AppSignal<number>(SUBSCRIPTIONS_OVERLAY_LEVEL_KEY, 0)

export const SUBSCRIPTIONS_OVERLAY_BACK_AT_KEY = 'subscriptionsOverlayBackAt'
export const subscriptionsOverlayBackAt: AppSignal<number> = new AppSignal<number>(SUBSCRIPTIONS_OVERLAY_BACK_AT_KEY)

// ── Subscriptions rail signals ──

export const SUBSCRIPTIONS_RAIL_DISMISS_PROGRESS_KEY = 'subscriptionsRailDismissProgress'
export const subscriptionsRailDismissProgress: AppSignal<number> = new AppSignal<number>(SUBSCRIPTIONS_RAIL_DISMISS_PROGRESS_KEY)
