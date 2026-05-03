import window from '@ohos.window'
import { SettingsStore } from '../services/SettingsStore'
import { HomeEntrySnapshotStore } from '../services/HomeEntrySnapshotStore'
import { FeedRepository } from '../repositories/FeedRepository'
import { FeaturedEntriesQuery } from '../data/FeaturedEntriesQuery'
import { DEFAULT_HARMONY_SETTINGS, EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { HomeEntryDataManager } from './HomeEntryDataManager'
import { HomeInlineSearchController } from './HomeInlineSearchController'
import { HomeScrollIntentTracker } from './HomeScrollIntentTracker'
import { HomeFeedRefresh } from './HomeFeedRefresh'
import { HomeFeedPagination } from './HomeFeedPagination'
import { HomeFeedSessionOwner } from './HomeFeedSessionOwner'
import { IndexHomeDiagnosticsLogger } from './IndexHomeDiagnosticsLogger'
import { IndexHomeLoadStateGate } from './IndexHomeLoadStateGate'
import { IndexHomeRailCoordinator } from './IndexHomeRailCoordinator'
import { IndexRootTabCoordinator } from './IndexRootTabCoordinator'
import { groupHomeEntriesByMode, HomeEntryGroups } from './HomeEntryGroups'
import { resolveHomeVisibleEntryInitialLimit } from './HomeVisibleEntryPolicy'
import { resolveSystemBarStyle } from './SystemBarStyle'
import { shouldRefreshThemeOnSystemColorModeChange } from './ThemeRefresh'
import {
  AUTO_REFRESH_MIN_INTERVAL_MINUTES,
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_LIST_SWAP_ANIMATION_ENABLED,
  HOME_LIST_SWAP_ENTER_DURATION,
  HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
  HOME_LIST_SWAP_ENTRY_OFFSET_Y,
  HOME_MAX_CANDIDATE_LIMIT,
  HomeModeCandidateLimitMap,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModeVisibleEntryLimitMap,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import {
  createHomeCandidateLimitMap,
  createHomeLoadedMap,
  createHomeLoadingMap,
  createHomeModeBooleanMap,
  createHomeNoProgressCountMap,
  createHomeVisibleEntryLimitMap,
} from './HomeModeMapHelpers'

export interface HomeFeedSessionDeps {
  homeEntryDataManager: HomeEntryDataManager
  loadStateGate: IndexHomeLoadStateGate
  railCoordinator: IndexHomeRailCoordinator
  rootTabCoordinator: IndexRootTabCoordinator
  inlineSearchController: HomeInlineSearchController
  diagnosticsLogger: IndexHomeDiagnosticsLogger
  homeScrollIntent: HomeScrollIntentTracker
}

export class HomeFeedSession implements HomeFeedSessionOwner {
  private readonly owner: HomeFeedSessionOwner
  private readonly homeEntryDataManager: HomeEntryDataManager
  private readonly loadStateGate: IndexHomeLoadStateGate
  private readonly railCoordinator: IndexHomeRailCoordinator
  private readonly rootTabCoordinator: IndexRootTabCoordinator
  private readonly inlineSearchController: HomeInlineSearchController
  private readonly diagnosticsLogger: IndexHomeDiagnosticsLogger
  private managedTimeoutIds: number[] = []
  private autoRefreshTimer: number = -1

  readonly refresh: HomeFeedRefresh
  readonly pagination: HomeFeedPagination

  constructor(owner: HomeFeedSessionOwner, deps: HomeFeedSessionDeps) {
    this.owner = owner
    this.homeEntryDataManager = deps.homeEntryDataManager
    this.loadStateGate = deps.loadStateGate
    this.railCoordinator = deps.railCoordinator
    this.rootTabCoordinator = deps.rootTabCoordinator
    this.inlineSearchController = deps.inlineSearchController
    this.diagnosticsLogger = deps.diagnosticsLogger
    this.owner.homeScrollIntent = deps.homeScrollIntent
    this.refresh = new HomeFeedRefresh(this)
    this.pagination = new HomeFeedPagination(this)
  }

  // === State forwarding ===
  get mode(): SubscriptionMode { return this.owner.mode }
  set mode(v: SubscriptionMode) { this.owner.mode = v }
  get featuredEntries(): EntryCardModel[] { return this.owner.featuredEntries }
  set featuredEntries(v: EntryCardModel[]) { this.owner.featuredEntries = v }
  get entryGroups(): HomeEntryGroups<EntryCardModel> { return this.owner.entryGroups }
  set entryGroups(v: HomeEntryGroups<EntryCardModel>) { this.owner.entryGroups = v }
  get feedSourceLabel(): string { return this.owner.feedSourceLabel }
  set feedSourceLabel(v: string) { this.owner.feedSourceLabel = v }
  get isComponentActive(): boolean { return this.owner.isComponentActive }
  set isComponentActive(v: boolean) { this.owner.isComponentActive = v }
  get homeInitialLoadPending(): boolean { return this.owner.homeInitialLoadPending }
  set homeInitialLoadPending(v: boolean) { this.owner.homeInitialLoadPending = v }
  get hasLoadedInitialData(): boolean { return this.owner.hasLoadedInitialData }
  set hasLoadedInitialData(v: boolean) { this.owner.hasLoadedInitialData = v }
  get initialFeedCount(): number { return this.owner.initialFeedCount }
  set initialFeedCount(v: number) { this.owner.initialFeedCount = v }
  get theme(): ThemePalette { return this.owner.theme }
  set theme(v: ThemePalette) { this.owner.theme = v }
  get rootSettings(): HarmonySettings { return this.owner.rootSettings }
  set rootSettings(v: HarmonySettings) { this.owner.rootSettings = v }
  get isRefreshing(): boolean { return this.owner.isRefreshing }
  set isRefreshing(v: boolean) { this.owner.isRefreshing = v }
  get isHomeStartupRefreshing(): boolean { return this.owner.isHomeStartupRefreshing }
  set isHomeStartupRefreshing(v: boolean) { this.owner.isHomeStartupRefreshing = v }
  get refreshCompletedCount(): number { return this.owner.refreshCompletedCount }
  set refreshCompletedCount(v: number) { this.owner.refreshCompletedCount = v }
  get refreshTotalCount(): number { return this.owner.refreshTotalCount }
  set refreshTotalCount(v: number) { this.owner.refreshTotalCount = v }
  get lastRefreshProgressUiUpdateAt(): number { return this.owner.lastRefreshProgressUiUpdateAt }
  set lastRefreshProgressUiUpdateAt(v: number) { this.owner.lastRefreshProgressUiUpdateAt = v }
  get displayRefreshPercent(): number { return this.owner.displayRefreshPercent }
  set displayRefreshPercent(v: number) { this.owner.displayRefreshPercent = v }
  get refreshPercentAnimationTimer(): number { return this.owner.refreshPercentAnimationTimer }
  set refreshPercentAnimationTimer(v: number) { this.owner.refreshPercentAnimationTimer = v }
  get pendingRefreshPercentTarget(): number { return this.owner.pendingRefreshPercentTarget }
  set pendingRefreshPercentTarget(v: number) { this.owner.pendingRefreshPercentTarget = v }
  get lastHomeRefreshFinishedAt(): number { return this.owner.lastHomeRefreshFinishedAt }
  set lastHomeRefreshFinishedAt(v: number) { this.owner.lastHomeRefreshFinishedAt = v }
  get homePostRefreshReloadPending(): boolean { return this.owner.homePostRefreshReloadPending }
  set homePostRefreshReloadPending(v: boolean) { this.owner.homePostRefreshReloadPending = v }
  get postRefreshReloadVersion(): number { return this.owner.postRefreshReloadVersion }
  set postRefreshReloadVersion(v: number) { this.owner.postRefreshReloadVersion = v }
  get suppressFeedsChangedUntilMs(): number { return this.owner.suppressFeedsChangedUntilMs }
  set suppressFeedsChangedUntilMs(v: number) { this.owner.suppressFeedsChangedUntilMs = v }
  get hasDeferredFeedsChangedReload(): boolean { return this.owner.hasDeferredFeedsChangedReload }
  set hasDeferredFeedsChangedReload(v: boolean) { this.owner.hasDeferredFeedsChangedReload = v }
  get deferredFeedsChangedRetryToken(): number { return this.owner.deferredFeedsChangedRetryToken }
  set deferredFeedsChangedRetryToken(v: number) { this.owner.deferredFeedsChangedRetryToken = v }
  get feedsChangedReloadVersion(): number { return this.owner.feedsChangedReloadVersion }
  set feedsChangedReloadVersion(v: number) { this.owner.feedsChangedReloadVersion = v }
  get homeLoadMoreInProgress(): boolean { return this.owner.homeLoadMoreInProgress }
  set homeLoadMoreInProgress(v: boolean) { this.owner.homeLoadMoreInProgress = v }
  get homeHasMoreEntries(): boolean { return this.owner.homeHasMoreEntries }
  set homeHasMoreEntries(v: boolean) { this.owner.homeHasMoreEntries = v }
  get homeCandidateLimit(): number { return this.owner.homeCandidateLimit }
  set homeCandidateLimit(v: number) { this.owner.homeCandidateLimit = v }
  get homeCandidateLimitsByMode(): HomeModeCandidateLimitMap { return this.owner.homeCandidateLimitsByMode }
  set homeCandidateLimitsByMode(v: HomeModeCandidateLimitMap) { this.owner.homeCandidateLimitsByMode = v }
  get homeModeLoaded(): HomeModeLoadedMap { return this.owner.homeModeLoaded }
  set homeModeLoaded(v: HomeModeLoadedMap) { this.owner.homeModeLoaded = v }
  get homeModeLoading(): HomeModeLoadingMap { return this.owner.homeModeLoading }
  set homeModeLoading(v: HomeModeLoadingMap) { this.owner.homeModeLoading = v }
  get homeVisibleEntryLimits(): HomeModeVisibleEntryLimitMap { return this.owner.homeVisibleEntryLimits }
  set homeVisibleEntryLimits(v: HomeModeVisibleEntryLimitMap) { this.owner.homeVisibleEntryLimits = v }
  get homeHasMoreEntriesByMode(): HomeModeHasMoreMap { return this.owner.homeHasMoreEntriesByMode }
  set homeHasMoreEntriesByMode(v: HomeModeHasMoreMap) { this.owner.homeHasMoreEntriesByMode = v }
  get homeModeNoProgressLoadMoreCount(): HomeModeNoProgressCountMap { return this.owner.homeModeNoProgressLoadMoreCount }
  set homeModeNoProgressLoadMoreCount(v: HomeModeNoProgressCountMap) { this.owner.homeModeNoProgressLoadMoreCount = v }
  get homeLoadMorePrefetchToken(): number { return this.owner.homeLoadMorePrefetchToken }
  set homeLoadMorePrefetchToken(v: number) { this.owner.homeLoadMorePrefetchToken = v }
  get homeLoadMorePrefetchLimit(): number { return this.owner.homeLoadMorePrefetchLimit }
  set homeLoadMorePrefetchLimit(v: number) { this.owner.homeLoadMorePrefetchLimit = v }
  get homeLoadMorePrefetchEntries(): EntryCardModel[] { return this.owner.homeLoadMorePrefetchEntries }
  set homeLoadMorePrefetchEntries(v: EntryCardModel[]) { this.owner.homeLoadMorePrefetchEntries = v }
  get homeLoadMorePrefetchMode(): SubscriptionMode { return this.owner.homeLoadMorePrefetchMode }
  set homeLoadMorePrefetchMode(v: SubscriptionMode) { this.owner.homeLoadMorePrefetchMode = v }
  get homeLoadMorePrefetchInProgress(): boolean { return this.owner.homeLoadMorePrefetchInProgress }
  set homeLoadMorePrefetchInProgress(v: boolean) { this.owner.homeLoadMorePrefetchInProgress = v }
  get lastHomeLoadMoreRequestedAt(): number { return this.owner.lastHomeLoadMoreRequestedAt }
  set lastHomeLoadMoreRequestedAt(v: number) { this.owner.lastHomeLoadMoreRequestedAt = v }
  get homeLoadMoreRequestToken(): number { return this.owner.homeLoadMoreRequestToken }
  set homeLoadMoreRequestToken(v: number) { this.owner.homeLoadMoreRequestToken = v }
  get lastHomeLoadMoreCompletedAt(): number { return this.owner.lastHomeLoadMoreCompletedAt }
  set lastHomeLoadMoreCompletedAt(v: number) { this.owner.lastHomeLoadMoreCompletedAt = v }
  get searchOverlayVisible(): boolean { return this.owner.searchOverlayVisible }
  set searchOverlayVisible(v: boolean) { this.owner.searchOverlayVisible = v }
  get isModeTransitioning(): boolean { return this.owner.isModeTransitioning }
  set isModeTransitioning(v: boolean) { this.owner.isModeTransitioning = v }
  get homeListSwapAnimating(): boolean { return this.owner.homeListSwapAnimating }
  set homeListSwapAnimating(v: boolean) { this.owner.homeListSwapAnimating = v }
  get homeListSwapMode(): SubscriptionMode { return this.owner.homeListSwapMode }
  set homeListSwapMode(v: SubscriptionMode) { this.owner.homeListSwapMode = v }
  get homeListSwapToken(): number { return this.owner.homeListSwapToken }
  set homeListSwapToken(v: number) { this.owner.homeListSwapToken = v }
  get homeScrollIntent(): HomeScrollIntentTracker { return this.owner.homeScrollIntent }
  set homeScrollIntent(_v: HomeScrollIntentTracker) { /* readonly on owner */ }

  // === Interface method forwarding ===
  logHomePerf(message: string): void { this.diagnosticsLogger.logHomePerf(message) }
  logHomeAsyncError(stage: string, error: Error | string | Object): void { this.diagnosticsLogger.logHomeAsyncError(stage, error) }
  logHomeLoadMore(message: string): void { this.diagnosticsLogger.logHomeLoadMore(message) }
  logHomeLoadState(message: string): void { this.diagnosticsLogger.logHomeLoadState(message) }
  describeError(error: Error | string | Object): string { return this.diagnosticsLogger.describeError(error) }
  showToast(message: string, duration: number = 2000): void { this.owner.showToast(message, duration) }
  isHomeRootTab(): boolean { return this.rootTabCoordinator.isHomeRootTab() }
  hasHomeInlineSearchQuery(): boolean { return !!this.inlineSearchController.normalizedQuery() }
  readHomeModeScrollOffset(mode: SubscriptionMode): number { return this.railCoordinator.readHomeModeScrollOffset(mode) }
  filteredEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    switch (mode) {
      case 'social': return this.owner.entryGroups.social
      case 'pictures': return this.owner.entryGroups.pictures
      case 'videos': return this.owner.entryGroups.videos
      default: return this.owner.entryGroups.articles
    }
  }
  mergeFeaturedEntriesFromGroups(): EntryCardModel[] { return this.homeEntryDataManager.mergeFeaturedEntriesFromGroups() }
  applyEntriesForMode(mode: SubscriptionMode, entries: EntryCardModel[], deferredPersist: boolean, skipNotify: boolean = false, skipMerge: boolean = false): void {
    this.homeEntryDataManager.applyEntriesForMode(mode, entries, deferredPersist, skipNotify, skipMerge)
  }
  settleInitialHomeLoadState(force: boolean = false): void { this.loadStateGate.settleInitialHomeLoadState(force) }
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void { this.homeEntryDataManager.schedulePersistSnapshot(entries) }
  notifyHomeEntryDataReloadedForMode(mode: SubscriptionMode): void { this.homeEntryDataManager.notifyModeReloaded(mode) }
  invalidateHomeLoadMorePrefetch(): void { this.pagination.invalidateHomeLoadMorePrefetch() }
  resetModeLoadMoreStates(reason: string): void { this.pagination.resetModeLoadMoreStates(reason) }
  scheduleHomeLoadMorePrefetch(delayMs: number = 220): void { this.pagination.scheduleHomeLoadMorePrefetch(delayMs) }
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean { return this.pagination.pendingLoadMoreForMode(mode) }
  hasRecentHomeScrollIntent(): boolean { return this.pagination.hasRecentHomeScrollIntent() }
  shouldRenderAllEntriesForMode(mode: SubscriptionMode): boolean { return this.pagination.shouldRenderAllEntriesForMode(mode) }

  // === Bootstrap ===
  async bootstrap(): Promise<void> {
    const startedAt = Date.now()
    this.logHomePerf('loadInitialData start')
    this.pagination.resetModeLoadMoreStates('load-initial')
    this.owner.homeInitialLoadPending = true
    this.owner.theme = ThemeService.currentPalette()
    void this.applySystemBarStyle(this.owner.theme)
    const settingsPromise = SettingsStore.load()
    const feedsPromise = FeedRepository.list()
    const currentMode = this.owner.mode
    let restoredFromSnapshot: boolean = false
    const snapshotEntries = await HomeEntrySnapshotStore.load()
    if (snapshotEntries.length > 0) {
      restoredFromSnapshot = true
      this.restoreSnapshot(snapshotEntries)
    } else {
      await this.loadFastLocalEntries()
    }
    this.settleInitialHomeLoadState()
    const settings = await settingsPromise
    const feeds = await feedsPromise
    this.owner.initialFeedCount = feeds.length
    this.owner.rootSettings = settings
    AppStorage.setOrCreate('showUnreadDot', settings.showUnreadDot)
    this.owner.theme = await ThemeService.resolvePalette(settings)
    void this.applySystemBarStyle(this.owner.theme)
    void this.refresh.startStartupRefreshIfNeeded(restoredFromSnapshot)
    this.configureAutoRefreshTimer()
    this.owner.hasLoadedInitialData = true
    this.pagination.ensureModeEntriesLoaded(currentMode)
    this.precacheNonActiveModes()
    this.pagination.scheduleHomeLoadMorePrefetch(800)
    this.logHomePerf(`loadInitialData done elapsedMs=${Date.now() - startedAt} featured=${this.owner.featuredEntries.length}`)
  }

  resume(): void {
    this.configureAutoRefreshTimer()
    this.refresh.tryFlushDeferredFeedsChangedReload('about-to-appear')
    if (this.owner.featuredEntries.length === 0) {
      void this.reloadFeaturedEntriesFromLocal(
        this.pagination.resolveHomeCandidateLimit(HOME_MAX_CANDIDATE_LIMIT),
        false,
        true,
        true,
      )
    }
  }

  private restoreSnapshot(snapshotEntries: EntryCardModel[]): void {
    const groupedSnapshot = groupHomeEntriesByMode(snapshotEntries)
    const restoredArticles = groupedSnapshot.articles.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredSocial = groupedSnapshot.social.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredPictures = groupedSnapshot.pictures.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    const restoredVideos = groupedSnapshot.videos.slice(0, HOME_FULL_MODE_CANDIDATE_LIMIT)
    this.owner.entryGroups = {
      articles: [...restoredArticles],
      social: [...restoredSocial],
      pictures: [...restoredPictures],
      videos: [...restoredVideos],
    }
    this.owner.featuredEntries = this.mergeFeaturedEntriesFromGroups()
    this.pagination.setCandidateLimitForMode('articles', restoredArticles.length)
    this.pagination.setCandidateLimitForMode('social', restoredSocial.length)
    this.pagination.setCandidateLimitForMode('pictures', restoredPictures.length)
    this.pagination.setCandidateLimitForMode('videos', restoredVideos.length)
    this.pagination.markModeLoaded('articles', restoredArticles.length > 0)
    this.pagination.markModeLoaded('social', restoredSocial.length > 0)
    this.pagination.markModeLoaded('pictures', restoredPictures.length > 0)
    this.pagination.markModeLoaded('videos', restoredVideos.length > 0)
    this.pagination.setModeHasMoreEntries('articles', true, 'snapshot-restore')
    this.pagination.setModeHasMoreEntries('social', true, 'snapshot-restore')
    this.pagination.setModeHasMoreEntries('pictures', true, 'snapshot-restore')
    this.pagination.setModeHasMoreEntries('videos', true, 'snapshot-restore')
    this.homeEntryDataManager.notifyAllReloaded()
    this.schedulePersistHomeSnapshot(this.owner.featuredEntries)
    this.owner.feedSourceLabel = '已恢复本地内容'
  }

  private async loadFastLocalEntries(): Promise<void> {
    this.owner.featuredEntries = await FeaturedEntriesQuery.featuredEntriesFast(HOME_INITIAL_CANDIDATE_LIMIT)
    if (this.owner.featuredEntries.length === 0) {
      this.owner.featuredEntries = await FeaturedEntriesQuery.featuredEntries()
    }
    this.owner.entryGroups = groupHomeEntriesByMode(this.owner.featuredEntries)
    this.owner.feedSourceLabel = '本地内容已加载'
    this.precacheNonActiveModes()
  }

  // === Reload ===
  async reloadFeaturedEntriesFromLocal(
    candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = false,
    targetMode: SubscriptionMode = this.owner.mode,
  ): Promise<void> {
    const startedAt = Date.now()
    const safeCandidateLimit = this.pagination.resolveHomeCandidateLimitForMode(targetMode, candidateLimit)
    const initialVisibleLimit = resolveHomeVisibleEntryInitialLimit(targetMode)
    const shouldUseFastPath = preferFastPath
      && !this.pagination.shouldRenderAllEntriesForMode(targetMode)
      && (targetMode !== 'pictures' || safeCandidateLimit < initialVisibleLimit)
    this.logHomePerf(`reload start mode=${targetMode} limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${shouldUseFastPath}`)
    const nextEntries = shouldUseFastPath
      ? await FeaturedEntriesQuery.featuredEntriesFastByMode(targetMode, safeCandidateLimit)
      : await FeaturedEntriesQuery.featuredEntriesByMode(targetMode, safeCandidateLimit)
    this.pagination.syncModePaginationFromReloadResult(targetMode, nextEntries, safeCandidateLimit)
    this.diagnosticsLogger.logHomeGroupStats(`reloadFeaturedEntriesFromLocal mode=${targetMode} limit=${safeCandidateLimit} animated=${animated}`, nextEntries)
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.owner.mode)
      return
    }
    this.applyEntriesForMode(targetMode, nextEntries, deferredGrouping)
    this.logHomePerf(`reload done mode=${targetMode} limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`)
  }

  async reloadHomeEntriesFromLocal(
    candidateLimit: number = HOME_MAX_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = true,
  ): Promise<void> {
    if (this.pagination.shouldRenderAllEntriesForMode(this.owner.mode)) {
      await this.reloadFeaturedEntriesFromLocal(
        this.pagination.resolveHomeCandidateLimitForMode(this.owner.mode, candidateLimit),
        animated,
        deferredGrouping,
        false,
        this.owner.mode,
      )
      return
    }
    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(HOME_INITIAL_CANDIDATE_LIMIT, candidateLimit)
    this.logHomePerf(`reload-home start limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${preferFastPath}`)
    const nextEntries = preferFastPath
      ? await FeaturedEntriesQuery.featuredEntriesFast(safeCandidateLimit)
      : await FeaturedEntriesQuery.featuredEntries(safeCandidateLimit)
    this.diagnosticsLogger.logHomeGroupStats(`reloadHomeEntriesFromLocal limit=${safeCandidateLimit} animated=${animated}`, nextEntries)
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.owner.mode)
      return
    }
    this.homeEntryDataManager.applyHomeEntries(nextEntries, deferredGrouping)
    this.logHomePerf(`reload-home done limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`)
  }

  precacheNonActiveModes(): void {
    const currentMode = this.owner.mode
    const modes: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
    const precacheLimit = 20
    for (const mode of modes) {
      if (mode === currentMode) { continue }
      if (this.pagination.isModeLoaded(mode) || this.pagination.isModeLoading(mode)) { continue }
      this.pagination.setModeLoading(mode, true)
      void FeaturedEntriesQuery.featuredEntriesFastByMode(mode, precacheLimit)
        .then((entries: EntryCardModel[]) => {
          this.applyEntriesForMode(mode, entries, true, true, true)
        })
        .catch((error: Error | string | Object) => {
          this.logHomeAsyncError(`precache-mode mode=${mode}`, error)
        })
        .finally(() => {
          this.pagination.setModeLoading(mode, false)
        })
    }
  }

  private playHomeListSwapTransition(nextEntries: EntryCardModel[], mode: SubscriptionMode): void {
    this.owner.homeListSwapMode = mode
    this.owner.homeListSwapToken += 1
    this.homeEntryDataManager.playListSwapTransition(
      nextEntries,
      mode,
      this.owner.homeListSwapToken,
      HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
      HOME_LIST_SWAP_ENTRY_OFFSET_Y,
      HOME_LIST_SWAP_ENTER_DURATION,
      HOME_LIST_SWAP_ANIMATION_ENABLED,
    )
  }

  // === Runtime infra ===
  runManagedTimeout(callback: () => void, delayMs: number): void {
    const timeoutId = setTimeout(() => {
      const pendingIndex = this.managedTimeoutIds.indexOf(timeoutId)
      if (pendingIndex >= 0) {
        this.managedTimeoutIds.splice(pendingIndex, 1)
      }
      if (!this.owner.isComponentActive) {
        return
      }
      try {
        callback()
      } catch (error) {
        this.logHomeAsyncError(`managed-timeout delayMs=${delayMs}`, error)
      }
    }, delayMs)
    this.managedTimeoutIds.push(timeoutId)
  }

  clearManagedTimeouts(): void {
    this.managedTimeoutIds.forEach((timeoutId: number) => {
      clearTimeout(timeoutId)
    })
    this.managedTimeoutIds = []
  }

  async applySystemBarStyle(theme: ThemePalette): Promise<void> {
    const mainWindow = AppStorage.get<window.Window>('WindowClass')
    if (!mainWindow) {
      return
    }
    try {
      const systemBarStyle = resolveSystemBarStyle(theme)
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: systemBarStyle.statusBarColor,
        navigationBarColor: systemBarStyle.navigationBarColor,
        isStatusBarLightIcon: systemBarStyle.isStatusBarLightIcon,
        statusBarContentColor: systemBarStyle.statusBarContentColor,
      })
    } catch (_) {
    }
  }

  configureAutoRefreshTimer(): void {
    this.clearAutoRefreshTimer()
    if (!this.owner.rootSettings.autoRefresh) {
      return
    }
    const intervalMs = this.autoRefreshIntervalMs()
    this.autoRefreshTimer = setInterval(() => {
      void this.refresh.refreshFeaturedEntries(false)
    }, intervalMs)
  }

  clearAutoRefreshTimer(): void {
    if (this.autoRefreshTimer < 0) {
      return
    }
    clearInterval(this.autoRefreshTimer)
    this.autoRefreshTimer = -1
  }

  private autoRefreshIntervalMs(): number {
    const configuredMinutes = Number(this.owner.rootSettings.refreshIntervalMinutes)
    const normalizedMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes
    const safeMinutes = Math.max(AUTO_REFRESH_MIN_INTERVAL_MINUTES, Math.floor(normalizedMinutes))
    return safeMinutes * 60 * 1000
  }

  async handleFeedsChanged(): Promise<void> {
    this.refresh.handleFeedsChanged()
  }

  tryFlushDeferredFeedsChangedReload(source: string): boolean {
    return this.refresh.tryFlushDeferredFeedsChangedReload(source)
  }
}
