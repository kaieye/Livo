import { EntryCardModel } from '../../models/LivoModels'
import { HomeFeedActions, HomeFeedState } from './HomeFeedSessionOwner'
import { SubscriptionMode } from '../../config/HomeRootConfig'

/**
 * Minimal test double implementing {@link HomeFeedActions}.
 *
 * All log / diagnostic methods are no-ops. Query methods return sensible
 * defaults. Mutation methods are no-ops. The fake tracks calls via
 * `callLog` so tests can assert which actions were invoked.
 *
 * Usage in a Node.js test:
 * ```
 * const state = new HomeFeedStateBag()
 * const actions = new FakeHomeFeedActions(state)
 * const pagination = new HomeFeedPagination(state, actions)
 * ```
 */
export class FakeHomeFeedActions implements HomeFeedActions {
  private readonly state: HomeFeedState

  /** Ordered list of method-name strings for every action method called. */
  readonly callLog: string[] = []

  // ── Configurable overrides ──

  /** Override for isHomeRootTab(). Default: true. */
  homeRootTab: boolean = true

  /** Override for hasHomeInlineSearchQuery(). Default: false. */
  inlineSearchActive: boolean = false

  /** Override for shouldRenderAllEntriesForMode(). Default: false. */
  renderAllEntries: boolean = false

  /** Override for pendingLoadMoreForMode(). Default: false. */
  pendingLoadMore: boolean = false

  /** Override for hasRecentHomeScrollIntent(). Default: true. */
  recentScrollIntent: boolean = true

  /** Entries returned by mergeFeaturedEntriesFromGroups(). Default: state.featuredEntries. */
  mergedEntriesOverride: EntryCardModel[] | null = null

  constructor(state: HomeFeedState) {
    this.state = state
  }

  // ── Diagnostics ──

  logHomePerf(_message: string): void { this.callLog.push('logHomePerf') }
  logHomeAsyncError(_stage: string, _error: Error | string | Object): void { this.callLog.push('logHomeAsyncError') }
  logHomeLoadMore(_message: string): void { this.callLog.push('logHomeLoadMore') }
  logHomeLoadState(_message: string): void { this.callLog.push('logHomeLoadState') }
  describeError(error: Error | string | Object): string {
    this.callLog.push('describeError')
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }
  beginTweetPresentationDiagSession(
    _mode: SubscriptionMode, _reason: string, _expectedStartIndex: number,
  ): void { this.callLog.push('beginTweetPresentationDiagSession') }
  flushTweetPresentationDiagSession(_reason: string): void { this.callLog.push('flushTweetPresentationDiagSession') }

  // ── Runtime infra ──

  /**
   * In test mode, executes the callback synchronously so tests are
   * deterministic and don't need real timers.
   */
  runManagedTimeout(callback: () => void, _delayMs: number): void {
    this.callLog.push('runManagedTimeout')
    callback()
  }

  showToast(_message: string, _duration?: number): void { this.callLog.push('showToast') }

  // ── External coordinator delegation ──

  isHomeRootTab(): boolean { return this.homeRootTab }
  hasHomeInlineSearchQuery(): boolean { return this.inlineSearchActive }
  readHomeModeScrollOffset(_mode: SubscriptionMode): number { return 0 }

  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    switch (mode) {
      case 'social': return this.state.entryGroups.social
      case 'pictures': return this.state.entryGroups.pictures
      case 'videos': return this.state.entryGroups.videos
      default: return this.state.entryGroups.articles
    }
  }

  mergeFeaturedEntriesFromGroups(): EntryCardModel[] {
    if (this.mergedEntriesOverride !== null) {
      return this.mergedEntriesOverride
    }
    return this.state.featuredEntries
  }

  applyEntriesForMode(
    _mode: SubscriptionMode,
    _entries: EntryCardModel[],
    _deferredPersist: boolean,
    _skipNotify?: boolean,
    _skipMerge?: boolean,
    _skipPersist?: boolean,
  ): void { this.callLog.push('applyEntriesForMode') }

  settleInitialHomeLoadState(_force?: boolean): void { this.callLog.push('settleInitialHomeLoadState') }
  schedulePersistHomeSnapshot(_entries: EntryCardModel[]): void { this.callLog.push('schedulePersistHomeSnapshot') }
  notifyHomeEntryDataReloadedForMode(_mode: SubscriptionMode): void { this.callLog.push('notifyHomeEntryDataReloadedForMode') }
  notifyHomeEntryDataAppendedForMode(_mode: SubscriptionMode, _startIndex: number): void { this.callLog.push('notifyHomeEntryDataAppendedForMode') }
  getItemRectForMode(_mode: SubscriptionMode, _index: number): RectResult {
    return { x: 0, y: 0, width: 0, height: 0 }
  }

  // ── Notify descendants ──

  bumpHomeContentVersion(): void { this.callLog.push('bumpHomeContentVersion') }

  // ── Pagination delegation ──

  invalidateHomeLoadMorePrefetch(): void { this.callLog.push('invalidateHomeLoadMorePrefetch') }
  resetModeLoadMoreStates(_reason: string): void { this.callLog.push('resetModeLoadMoreStates') }
  scheduleHomeLoadMorePrefetch(_delayMs?: number): void { this.callLog.push('scheduleHomeLoadMorePrefetch') }
  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean { return this.renderAllEntries }
  pendingLoadMoreForMode(_mode: SubscriptionMode): boolean { return this.pendingLoadMore }
  hasRecentHomeScrollIntent(): boolean { return this.recentScrollIntent }
  handleHomeListEndReach(_mode: SubscriptionMode, _totalCount: number): void {
    this.callLog.push('handleHomeListEndReach')
  }

  // ── Cross-module lifecycle ──

  async reloadFeaturedEntriesFromLocal(
    _candidateLimit?: number,
    _animated?: boolean,
    _deferredGrouping?: boolean,
    _preferFastPath?: boolean,
    _targetMode?: SubscriptionMode,
  ): Promise<void> {
    this.callLog.push('reloadFeaturedEntriesFromLocal')
  }

  async reloadHomeEntriesFromLocal(
    _candidateLimit?: number,
    _animated?: boolean,
    _deferredGrouping?: boolean,
    _preferFastPath?: boolean,
  ): Promise<void> {
    this.callLog.push('reloadHomeEntriesFromLocal')
  }
}
