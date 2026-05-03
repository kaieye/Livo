import { FeedRepository } from '../repositories/FeedRepository'
import { AppPreferenceService } from '../services/AppPreferenceService'
import { FeaturedEntriesQuery } from '../data/FeaturedEntriesQuery'
import { EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { groupHomeEntriesByMode, HomeEntryGroups } from './HomeEntryGroups'
import {
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_MAX_CANDIDATE_LIMIT,
  SubscriptionMode,
} from '../components/HomeRootConfig'

export interface IndexHomeBootstrapOwner {
  mode: SubscriptionMode
  theme: ThemePalette
  rootSettings: HarmonySettings
  initialFeedCount: number
  feedSourceLabel: string
  featuredEntries: EntryCardModel[]
  entryGroups: HomeEntryGroups<EntryCardModel>
  homeInitialLoadPending: boolean
  hasLoadedInitialData: boolean

  logHomePerf(message: string): void
  resetModeLoadMoreStates(reason: string): void
  applySystemBarStyle(theme: ThemePalette): Promise<void>
  mergeFeaturedEntriesFromGroups(): EntryCardModel[]
  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void
  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void
  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void
  notifyHomeEntryDataReloaded(): void
  schedulePersistHomeSnapshot(entries: EntryCardModel[]): void
  precacheNonActiveModes(): void
  settleInitialHomeLoadState(force?: boolean): void
  startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void>
  configureAutoRefreshTimer(): void
  ensureModeEntriesLoaded(mode: SubscriptionMode): void
  scheduleHomeLoadMorePrefetch(delayMs?: number): void
  resolveHomeCandidateLimit(minimumLimit: number): number
  reloadFeaturedEntriesFromLocal(
    candidateLimit?: number,
    animated?: boolean,
    deferredGrouping?: boolean,
    preferFastPath?: boolean,
    targetMode?: SubscriptionMode,
  ): Promise<void>
  tryFlushDeferredFeedsChangedReload(source: string): boolean
}

export class IndexHomeBootstrapCoordinator {
  private readonly owner: IndexHomeBootstrapOwner

  constructor(owner: IndexHomeBootstrapOwner) {
    this.owner = owner
  }

  async loadInitialData(): Promise<void> {
    const startedAt = Date.now()
    this.owner.logHomePerf('loadInitialData start')
    this.owner.resetModeLoadMoreStates('load-initial')
    this.owner.homeInitialLoadPending = true
    this.owner.theme = ThemeService.currentPalette()
    void this.owner.applySystemBarStyle(this.owner.theme)
    const settingsPromise = AppPreferenceService.loadSettings()
    const feedsPromise = FeedRepository.list()

    const currentMode = this.owner.mode
    let restoredFromSnapshot: boolean = false
    const snapshotEntries = await AppPreferenceService.loadHomeEntrySnapshot()
    if (snapshotEntries.length > 0) {
      restoredFromSnapshot = true
      this.restoreSnapshot(snapshotEntries)
    } else {
      await this.loadFastLocalEntries()
    }
    this.owner.settleInitialHomeLoadState()

    const settings = await settingsPromise
    const feeds = await feedsPromise
    this.owner.initialFeedCount = feeds.length
    this.owner.rootSettings = settings
    AppStorage.setOrCreate('showUnreadDot', settings.showUnreadDot)
    this.owner.theme = await ThemeService.resolvePalette(settings)
    void this.owner.applySystemBarStyle(this.owner.theme)

    void this.owner.startStartupRefreshIfNeeded(restoredFromSnapshot)
    this.owner.configureAutoRefreshTimer()
    this.owner.hasLoadedInitialData = true
    this.owner.ensureModeEntriesLoaded(currentMode)
    this.owner.precacheNonActiveModes()

    this.owner.scheduleHomeLoadMorePrefetch(800)
    this.owner.logHomePerf(
      `loadInitialData done elapsedMs=${Date.now() - startedAt} featured=${this.owner.featuredEntries.length}`,
    )
  }

  resumeLoadedHome(): void {
    this.owner.configureAutoRefreshTimer()
    this.owner.tryFlushDeferredFeedsChangedReload('about-to-appear')
    if (this.owner.featuredEntries.length === 0) {
      void this.owner.reloadFeaturedEntriesFromLocal(
        this.owner.resolveHomeCandidateLimit(HOME_MAX_CANDIDATE_LIMIT),
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
    this.owner.featuredEntries = this.owner.mergeFeaturedEntriesFromGroups()

    this.owner.setCandidateLimitForMode('articles', restoredArticles.length)
    this.owner.setCandidateLimitForMode('social', restoredSocial.length)
    this.owner.setCandidateLimitForMode('pictures', restoredPictures.length)
    this.owner.setCandidateLimitForMode('videos', restoredVideos.length)

    this.owner.markModeLoaded('articles', restoredArticles.length > 0)
    this.owner.markModeLoaded('social', restoredSocial.length > 0)
    this.owner.markModeLoaded('pictures', restoredPictures.length > 0)
    this.owner.markModeLoaded('videos', restoredVideos.length > 0)

    this.owner.setModeHasMoreEntries('articles', true, 'snapshot-restore')
    this.owner.setModeHasMoreEntries('social', true, 'snapshot-restore')
    this.owner.setModeHasMoreEntries('pictures', true, 'snapshot-restore')
    this.owner.setModeHasMoreEntries('videos', true, 'snapshot-restore')
    this.owner.notifyHomeEntryDataReloaded()
    this.owner.schedulePersistHomeSnapshot(this.owner.featuredEntries)
    this.owner.feedSourceLabel = '已恢复本地内容'
  }

  private async loadFastLocalEntries(): Promise<void> {
    this.owner.featuredEntries = await FeaturedEntriesQuery.featuredEntriesFast(HOME_INITIAL_CANDIDATE_LIMIT)
    if (this.owner.featuredEntries.length === 0) {
      this.owner.featuredEntries = await FeaturedEntriesQuery.featuredEntries()
    }
    this.owner.entryGroups = groupHomeEntriesByMode(this.owner.featuredEntries)
    this.owner.feedSourceLabel = '本地内容已加载'
    this.owner.precacheNonActiveModes()
  }
}
