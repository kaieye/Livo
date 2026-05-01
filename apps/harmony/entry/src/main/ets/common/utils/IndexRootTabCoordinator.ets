import { getRequestedRootTabId, RootTabId, rootTabIndexForId } from '../navigation/AppRouter'
import { EntryCardModel } from '../models/LivoModels'
import { HdsBottomTabId, resolveHdsBottomTabItems } from './HdsBottomTabConfig'
import { rootTabSymbolPair, rootTitleFor } from './IndexRootChrome'
import { shouldHideRootBottomBar, shouldHideRootTitleBar } from './RootTabVisibilityPolicy'
import {
  HOME_MAX_CANDIDATE_LIMIT,
  RootTabSymbolPair,
  SubscriptionMode,
} from '../components/HomeRootConfig'

export interface IndexRootTabOwner {
  rootTabIndex: number
  activeRootTabId: RootTabId
  highlightedRootTabId: RootTabId
  mode: SubscriptionMode
  hasLoadedInitialData: boolean
  featuredEntries: EntryCardModel[]
  isRefreshing: boolean
  isHomeStartupRefreshing: boolean
  discoverHasForegroundOverlay: boolean
  subscriptionsOverlayLevel: number
  settingsOverlayLevel: number
  isRootTabChangeSuppressed(): boolean
  syncRootTabsController(): void
  logHomeInlineSearchFocusDebug(stage: string, message: string): void
  closeHomeInlineSearch(clearQuery: boolean): void
  syncHomeModeRailState(mode?: SubscriptionMode): void
  primeHomeModeRailForRootActivation(): void
  tryFlushDeferredFeedsChangedReload(source: string): boolean
  runManagedTimeout(callback: () => void, delayMs: number): void
  resolveHomeCandidateLimit(minimumLimit: number): number
  reloadFeaturedEntriesFromLocal(
    candidateLimit?: number,
    animated?: boolean,
    deferredGrouping?: boolean,
    preferFastPath?: boolean,
    targetMode?: SubscriptionMode,
  ): Promise<void>
}

export class IndexRootTabCoordinator {
  private readonly owner: IndexRootTabOwner
  private lastHandledRequestedRootTabId: RootTabId | '' = ''

  constructor(owner: IndexRootTabOwner) {
    this.owner = owner
  }

  currentRootTabId(): RootTabId {
    return this.owner.activeRootTabId
  }

  currentRootTitle(): string {
    return rootTitleFor(this.currentRootTabId())
  }

  isHomeRootTab(): boolean {
    return this.currentRootTabId() === 'home'
  }

  isSettingsRootTab(): boolean {
    return this.currentRootTabId() === 'settings'
  }

  shouldHideRootTitleBar(): boolean {
    return shouldHideRootTitleBar(this.currentRootTabId())
  }

  shouldHideBottomTabs(): boolean {
    return shouldHideRootBottomBar(this.currentRootTabId(), {
      discoverHasForegroundOverlay: this.owner.discoverHasForegroundOverlay,
      subscriptionsOverlayLevel: this.owner.subscriptionsOverlayLevel,
      settingsOverlayLevel: this.owner.settingsOverlayLevel,
    })
  }

  rootTabSymbolPair(tabId: HdsBottomTabId): RootTabSymbolPair {
    return rootTabSymbolPair(tabId)
  }

  syncRequestedRootTab(): void {
    const requestedTab = getRequestedRootTabId()
    if (!requestedTab) {
      return
    }

    if (requestedTab === this.lastHandledRequestedRootTabId) {
      return
    }

    this.owner.highlightedRootTabId = requestedTab
    this.owner.activeRootTabId = requestedTab
    this.owner.rootTabIndex = rootTabIndexForId(requestedTab)
    this.lastHandledRequestedRootTabId = requestedTab
    this.owner.syncRootTabsController()
  }

  handleRootTabChange(index: number): void {
    if (this.owner.isRootTabChangeSuppressed()) {
      return
    }

    const previousTabId = this.currentRootTabId()
    const item = resolveHdsBottomTabItems()[index]
    if (!item) {
      return
    }

    const tabId = item.id as RootTabId
    this.owner.rootTabIndex = index
    this.owner.highlightedRootTabId = tabId
    this.owner.activeRootTabId = tabId
    this.owner.logHomeInlineSearchFocusDebug('root-tab-change', `nextTab=${tabId}`)
    if (previousTabId === 'discover' && tabId !== 'discover') {
      AppStorage.setOrCreate('discoverHasForegroundOverlay', false)
      AppStorage.setOrCreate('discoverOverlayLevel', 0)
      AppStorage.setOrCreate('discoverNavigationResetAt', Date.now())
    }
    if (tabId !== 'home') {
      this.owner.closeHomeInlineSearch(true)
      return
    }

    this.activateHomeRootTab('tab-change', true)
  }

  confirmRootTabSelection(tabId: RootTabId): void {
    if (tabId !== this.owner.highlightedRootTabId) {
      return
    }

    if (this.owner.activeRootTabId === tabId) {
      return
    }

    this.owner.activeRootTabId = tabId
    if (tabId === 'home') {
      this.activateHomeRootTab('tab-home', false)
    }
  }

  private activateHomeRootTab(source: string, allowEmptyReload: boolean): void {
    this.owner.syncHomeModeRailState(this.owner.mode)
    this.owner.primeHomeModeRailForRootActivation()
    const flushedDeferredReload = this.owner.tryFlushDeferredFeedsChangedReload(source)
    if (!allowEmptyReload || flushedDeferredReload) {
      return
    }

    if (
      this.owner.hasLoadedInitialData
      && this.owner.featuredEntries.length === 0
      && !this.owner.isRefreshing
      && !this.owner.isHomeStartupRefreshing
    ) {
      this.owner.runManagedTimeout(() => {
        void this.owner.reloadFeaturedEntriesFromLocal(
          this.owner.resolveHomeCandidateLimit(HOME_MAX_CANDIDATE_LIMIT),
          false,
          true,
          true,
        )
      }, 0)
    }
  }
}
