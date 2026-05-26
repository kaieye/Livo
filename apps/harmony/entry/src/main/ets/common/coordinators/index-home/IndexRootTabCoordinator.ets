import { getRequestedRootTabId, RootTabId, rootTabIndexForId } from '../../navigation/AppRouter'
import { EntryCardModel } from '../../models/LivoModels'
import { HdsBottomTabId, resolveHdsBottomTabItems } from './HdsBottomTabConfig'
import { rootTabSymbolPair, rootTitleFor } from './IndexRootChrome'
import { shouldHideRootBottomBar, shouldHideRootTitleBar } from './RootTabVisibilityPolicy'
import { ROOT_TAB_DOUBLE_TAP_WINDOW_MS } from './RootTabScrollToTopSignal'
import {
  HOME_MAX_CANDIDATE_LIMIT,
  RootTabSymbolPair,
  SubscriptionMode,
} from '../../config/HomeRootConfig'
import {
  discoverHasForegroundOverlay,
  discoverNavigationResetAt,
  discoverOverlayLevel,
} from '../../utils/AppSignals'

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
  scrollRootTabToTop(tabId: RootTabId): void
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
  private lastTabBarClickId: RootTabId | '' = ''
  private lastTabBarClickAt: number = 0

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
    return shouldHideRootTitleBar(this.currentRootTabId(), {
      discoverHasForegroundOverlay: this.owner.discoverHasForegroundOverlay,
      subscriptionsOverlayLevel: this.owner.subscriptionsOverlayLevel,
      settingsOverlayLevel: this.owner.settingsOverlayLevel,
    })
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
    this.lastTabBarClickId = ''
    this.lastTabBarClickAt = 0
    this.owner.rootTabIndex = index
    this.owner.highlightedRootTabId = tabId
    this.owner.activeRootTabId = tabId
    this.owner.logHomeInlineSearchFocusDebug('root-tab-change', `nextTab=${tabId}`)
    if (previousTabId === 'discover' && tabId !== 'discover') {
      discoverHasForegroundOverlay.write(false)
      discoverOverlayLevel.write(0)
      discoverNavigationResetAt.write(Date.now())
    }
    if (tabId !== 'home') {
      this.owner.closeHomeInlineSearch(true)
      return
    }

    this.activateHomeRootTab('tab-change', true)

    // 显式同步 HdsTabs 控制器，确保 tab bar 高亮在 @State 级联重渲染后仍正确。
    // 不调用此方法时，HdsTabs 依赖框架内部对 tap 事件的处理来更新高亮，
    // 但 handleRootTabChange 中的多 @State 写入可能干扰框架的渲染管线，
    // 导致 tab bar 高亮延迟一帧才更新。
    this.owner.syncRootTabsController()
  }

  handleRootTabBarClick(index: number): void {
    const item = resolveHdsBottomTabItems()[index]
    if (!item) {
      return
    }

    const tabId = item.id as RootTabId
    if (tabId !== this.owner.activeRootTabId) {
      return
    }

    const now = Date.now()
    const isDoubleTap =
      this.lastTabBarClickId === tabId
      && now - this.lastTabBarClickAt <= ROOT_TAB_DOUBLE_TAP_WINDOW_MS

    this.lastTabBarClickId = tabId
    this.lastTabBarClickAt = now

    if (!isDoubleTap) {
      return
    }

    this.owner.scrollRootTabToTop(tabId)
    this.lastTabBarClickId = ''
    this.lastTabBarClickAt = 0
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
    // primeHomeModeRailForRootActivation 会将所有 rail 状态重置为默认值（scroll=0、
    // expanded=false、blur=0），因此在它之前调用 syncHomeModeRailState 是冗余的。
    // 去掉 syncHomeModeRailState 避免在 tab 刚切换时读取 cached scroller offset，
    // 减少同步 @State 写入量。
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
