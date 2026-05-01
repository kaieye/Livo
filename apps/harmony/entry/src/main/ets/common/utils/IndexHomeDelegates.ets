import { RootTabId } from '../navigation/AppRouter'
import { EntryCardModel } from '../models/LivoModels'
import { HomeEntryGroups } from './HomeEntryGroups'
import { HomeEntryDataDelegate } from './HomeEntryDataManager'
import { HomeInlineSearchDelegate } from './HomeInlineSearchController'
import { HomeModeDelegate } from './HomeModeController'
import { HOME_INLINE_SEARCH_RESULT_LIMIT, HomeEntryDataSourceMap, SubscriptionMode } from '../components/HomeRootConfig'

export interface IndexHomeModeDelegateOwner {
  mode: SubscriptionMode
  renderedMode: SubscriptionMode
  previousMode: SubscriptionMode
  visitedModes: SubscriptionMode[]
  isModeTransitioning: boolean
  modeTransitionDirection: number
  homeModeRailExpandedLockOffset: number
  homeModeRailExpandedOverride: boolean
  currentHomeModeScrollOffset: number
  homeModeRailDismissedByScroll: boolean
  readHomeModeScrollOffset(mode: SubscriptionMode): number
  totalEntryCountFor(mode: SubscriptionMode): number
  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[]
  setHomeScrollInteracting(interacting: boolean, mode: SubscriptionMode): void
  updateHeaderBlurProgress(offset: number): void
  resetModeScrollIntent(mode: SubscriptionMode): void
  ensureModeEntriesLoaded(mode: SubscriptionMode): void
  runManagedTimeout(cb: () => void, delayMs: number): void
}

export class IndexHomeModeDelegate implements HomeModeDelegate {
  private readonly owner: IndexHomeModeDelegateOwner

  constructor(owner: IndexHomeModeDelegateOwner) {
    this.owner = owner
  }

  getMode(): SubscriptionMode { return this.owner.mode }
  getRenderedMode(): SubscriptionMode { return this.owner.renderedMode }
  getPreviousMode(): SubscriptionMode { return this.owner.previousMode }
  getVisitedModes(): SubscriptionMode[] { return this.owner.visitedModes }
  isModeTransitioning(): boolean { return this.owner.isModeTransitioning }
  getModeTransitionDirection(): number { return this.owner.modeTransitionDirection }
  getScrollOffsetForMode(mode: SubscriptionMode): number { return this.owner.readHomeModeScrollOffset(mode) }
  getEntryCountForMode(mode: SubscriptionMode): number { return this.owner.totalEntryCountFor(mode) }
  getFirstEntryIdForMode(mode: SubscriptionMode): string { return (this.owner.filteredEntriesFor(mode)[0]?.id || '').trim() }
  getLastEntryIdForMode(mode: SubscriptionMode): string {
    const entries = this.owner.filteredEntriesFor(mode)
    return (entries[entries.length - 1]?.id || '').trim()
  }
  setMode(mode: SubscriptionMode): void { this.owner.mode = mode }
  setRenderedMode(mode: SubscriptionMode): void { this.owner.renderedMode = mode }
  setPreviousMode(mode: SubscriptionMode): void { this.owner.previousMode = mode }
  setVisitedModes(modes: SubscriptionMode[]): void { this.owner.visitedModes = modes }
  setModeTransitioning(v: boolean): void { this.owner.isModeTransitioning = v }
  setModeTransitionDirection(v: number): void { this.owner.modeTransitionDirection = v }
  setScrollInteracting(interacting: boolean, mode: SubscriptionMode): void { this.owner.setHomeScrollInteracting(interacting, mode) }
  setHomeModeRailExpandedLockOffset(v: number): void { this.owner.homeModeRailExpandedLockOffset = v }
  setHomeModeRailExpandedOverride(v: boolean): void { this.owner.homeModeRailExpandedOverride = v }
  setCurrentHomeModeScrollOffset(v: number): void { this.owner.currentHomeModeScrollOffset = v }
  setHomeModeRailDismissedByScroll(v: boolean): void { this.owner.homeModeRailDismissedByScroll = v }
  updateHeaderBlurProgress(offset: number): void { this.owner.updateHeaderBlurProgress(offset) }
  resetScrollIntent(mode: SubscriptionMode): void { this.owner.resetModeScrollIntent(mode) }
  ensureModeEntriesLoaded(mode: SubscriptionMode): void { this.owner.ensureModeEntriesLoaded(mode) }
  runManagedTimeout(cb: () => void, delayMs: number): void { this.owner.runManagedTimeout(cb, delayMs) }
}

export interface IndexHomeEntryDataDelegateOwner {
  featuredEntries: EntryCardModel[]
  entryGroups: HomeEntryGroups<EntryCardModel>
  mode: SubscriptionMode
  homeEntryDataSources: HomeEntryDataSourceMap
  isComponentActive: boolean
  homeListSwapOpacity: number
  homeListSwapTranslateY: number
  homeListSwapAnimating: boolean
  homeListSwapToken: number
  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void
  settleInitialHomeLoadState(force?: boolean): void
  resetTweetPresentationCache(): void
  animateWithUiContext(options: AnimateParam, event: () => void): void
  runManagedTimeout(cb: () => void, delayMs: number): void
}

export class IndexHomeEntryDataDelegate implements HomeEntryDataDelegate {
  private readonly owner: IndexHomeEntryDataDelegateOwner

  constructor(owner: IndexHomeEntryDataDelegateOwner) {
    this.owner = owner
  }

  getFeaturedEntries(): EntryCardModel[] { return this.owner.featuredEntries }
  getEntryGroups(): HomeEntryGroups<EntryCardModel> { return this.owner.entryGroups }
  getMode(): SubscriptionMode { return this.owner.mode }
  getDataSources(): HomeEntryDataSourceMap { return this.owner.homeEntryDataSources }
  isComponentActive(): boolean { return this.owner.isComponentActive }
  setFeaturedEntries(entries: EntryCardModel[]): void { this.owner.featuredEntries = entries }
  setEntryGroups(groups: HomeEntryGroups<EntryCardModel>): void { this.owner.entryGroups = groups }
  onEntriesSettled(mode?: SubscriptionMode): void {
    this.owner.markModeLoaded(mode ?? this.owner.mode, true)
    this.owner.settleInitialHomeLoadState()
  }
  resetTweetPresentationCache(): void { this.owner.resetTweetPresentationCache() }
  setListSwapAnimating(v: boolean): void { this.owner.homeListSwapAnimating = v }
  setListSwapOpacity(v: number): void { this.owner.homeListSwapOpacity = v }
  setListSwapTranslateY(v: number): void { this.owner.homeListSwapTranslateY = v }
  getListSwapToken(): number { return this.owner.homeListSwapToken }
  getListSwapAnimating(): boolean { return this.owner.homeListSwapAnimating }
  animateWithUiContext(options: AnimateParam, event: () => void): void { this.owner.animateWithUiContext(options, event) }
  runManagedTimeout(cb: () => void, delayMs: number): void { this.owner.runManagedTimeout(cb, delayMs) }
}

export interface IndexHomeInlineSearchDelegateOwner {
  searchQuery: string
  showSearch: boolean
  searchOverlayVisible: boolean
  currentRootTabId(): RootTabId
  getHomeInlineSearchFocusRequestToken(): number
  setHomeInlineSearchFocusRequestToken(token: number): void
  currentSearchEntries(): EntryCardModel[]
  getSearchInputController(): TextInputController
  runManagedTimeout(cb: () => void, delayMs: number): void
}

export class IndexHomeInlineSearchDelegate implements HomeInlineSearchDelegate {
  private readonly owner: IndexHomeInlineSearchDelegateOwner

  constructor(owner: IndexHomeInlineSearchDelegateOwner) {
    this.owner = owner
  }

  getCurrentRootTabId(): RootTabId { return this.owner.currentRootTabId() }
  getSearchQuery(): string { return this.owner.searchQuery }
  setSearchQuery(query: string): void { this.owner.searchQuery = query }
  getShowSearch(): boolean { return this.owner.showSearch }
  setShowSearch(visible: boolean): void { this.owner.showSearch = visible }
  getSearchOverlayVisible(): boolean { return this.owner.searchOverlayVisible }
  setSearchOverlayVisible(visible: boolean): void { this.owner.searchOverlayVisible = visible }
  getSearchFocusRequestToken(): number { return this.owner.getHomeInlineSearchFocusRequestToken() }
  setSearchFocusRequestToken(token: number): void { this.owner.setHomeInlineSearchFocusRequestToken(token) }
  getSearchEntries(): EntryCardModel[] { return this.owner.currentSearchEntries() }
  getSearchResultLimit(): number { return HOME_INLINE_SEARCH_RESULT_LIMIT }
  getSearchInputController(): TextInputController { return this.owner.getSearchInputController() }
  runManagedTimeout(cb: () => void, delayMs: number): void { this.owner.runManagedTimeout(cb, delayMs) }
}
