import { FeaturedEntriesQuery } from '../data/FeaturedEntriesQuery'
import { EntryCardModel } from '../models/LivoModels'
import { HomeEntryDataManager } from './HomeEntryDataManager'
import { resolveHomeVisibleEntryInitialLimit } from './HomeVisibleEntryPolicy'
import {
  HOME_INITIAL_CANDIDATE_LIMIT,
  HOME_LIST_SWAP_ANIMATION_ENABLED,
  HOME_LIST_SWAP_ENTER_DURATION,
  HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
  HOME_LIST_SWAP_ENTRY_OFFSET_Y,
  HOME_MAX_CANDIDATE_LIMIT,
  SubscriptionMode,
} from '../components/HomeRootConfig'

export interface IndexHomeReloadOwner {
  mode: SubscriptionMode
  homeListSwapMode: SubscriptionMode
  homeListSwapToken: number
  homeEntryDataManager: HomeEntryDataManager

  logHomePerf(message: string): void
  logHomeAsyncError(stage: string, error: Error | string | Object): void
  logHomeGroupStats(stage: string, entries: EntryCardModel[]): void
  resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number
  shouldRenderAllEntriesForMode(mode: SubscriptionMode): boolean
  syncModePaginationFromReloadResult(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    candidateLimit: number,
  ): void
  applyEntriesForMode(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    deferredPersist: boolean,
    skipNotify?: boolean,
    skipMerge?: boolean,
  ): void
  applyHomeEntries(entries: EntryCardModel[], deferredGrouping?: boolean): void
  isModeLoaded(mode: SubscriptionMode): boolean
  isModeLoading(mode: SubscriptionMode): boolean
  setModeLoading(mode: SubscriptionMode, loading: boolean): void
}

export class IndexHomeReloadCoordinator {
  private readonly owner: IndexHomeReloadOwner

  constructor(owner: IndexHomeReloadOwner) {
    this.owner = owner
  }

  async reloadFeaturedEntriesFromLocal(
    candidateLimit: number = HOME_INITIAL_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = false,
    targetMode: SubscriptionMode = this.owner.mode,
  ): Promise<void> {
    const startedAt = Date.now()
    const safeCandidateLimit = this.owner.resolveHomeCandidateLimitForMode(targetMode, candidateLimit)
    const initialVisibleLimit = resolveHomeVisibleEntryInitialLimit(targetMode)
    const shouldUseFastPath = preferFastPath
      && !this.owner.shouldRenderAllEntriesForMode(targetMode)
      && (targetMode !== 'pictures' || safeCandidateLimit < initialVisibleLimit)
    this.owner.logHomePerf(
      `reload start mode=${targetMode} limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${shouldUseFastPath}`,
    )
    const nextEntries = shouldUseFastPath
      ? await FeaturedEntriesQuery.featuredEntriesFastByMode(targetMode, safeCandidateLimit)
      : await FeaturedEntriesQuery.featuredEntriesByMode(targetMode, safeCandidateLimit)
    this.owner.syncModePaginationFromReloadResult(targetMode, nextEntries, safeCandidateLimit)
    this.owner.logHomeGroupStats(
      `reloadFeaturedEntriesFromLocal mode=${targetMode} limit=${safeCandidateLimit} animated=${animated}`,
      nextEntries,
    )
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.owner.mode)
      return
    }
    this.owner.applyEntriesForMode(targetMode, nextEntries, deferredGrouping)
    this.owner.logHomePerf(
      `reload done mode=${targetMode} limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`,
    )
  }

  async reloadHomeEntriesFromLocal(
    candidateLimit: number = HOME_MAX_CANDIDATE_LIMIT,
    animated: boolean = false,
    deferredGrouping: boolean = true,
    preferFastPath: boolean = true,
  ): Promise<void> {
    if (this.owner.shouldRenderAllEntriesForMode(this.owner.mode)) {
      await this.reloadFeaturedEntriesFromLocal(
        this.owner.resolveHomeCandidateLimitForMode(this.owner.mode, candidateLimit),
        animated,
        deferredGrouping,
        false,
        this.owner.mode,
      )
      return
    }

    const startedAt = Date.now()
    const safeCandidateLimit = Math.max(HOME_INITIAL_CANDIDATE_LIMIT, candidateLimit)
    this.owner.logHomePerf(
      `reload-home start limit=${safeCandidateLimit} animated=${animated} deferredGrouping=${deferredGrouping} fast=${preferFastPath}`,
    )
    const nextEntries = preferFastPath
      ? await FeaturedEntriesQuery.featuredEntriesFast(safeCandidateLimit)
      : await FeaturedEntriesQuery.featuredEntries(safeCandidateLimit)
    this.owner.logHomeGroupStats(
      `reloadHomeEntriesFromLocal limit=${safeCandidateLimit} animated=${animated}`,
      nextEntries,
    )
    if (animated) {
      this.playHomeListSwapTransition(nextEntries, this.owner.mode)
      return
    }
    this.owner.applyHomeEntries(nextEntries, deferredGrouping)
    this.owner.logHomePerf(
      `reload-home done limit=${safeCandidateLimit} elapsedMs=${Date.now() - startedAt} nextEntries=${nextEntries.length}`,
    )
  }

  precacheNonActiveModes(): void {
    const currentMode = this.owner.mode
    const modes: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
    const precacheLimit = 20

    for (const mode of modes) {
      if (mode === currentMode) {
        continue
      }
      if (this.owner.isModeLoaded(mode) || this.owner.isModeLoading(mode)) {
        continue
      }
      this.owner.setModeLoading(mode, true)
      void FeaturedEntriesQuery.featuredEntriesFastByMode(mode, precacheLimit)
        .then((entries: EntryCardModel[]) => {
          this.owner.applyEntriesForMode(mode, entries, true, true, true)
        })
        .catch((error: Error | string | Object) => {
          this.owner.logHomeAsyncError(`precache-mode mode=${mode}`, error)
        })
        .finally(() => {
          this.owner.setModeLoading(mode, false)
        })
    }
  }

  playHomeListSwapTransition(nextEntries: EntryCardModel[], mode: SubscriptionMode): void {
    this.owner.homeListSwapMode = mode
    this.owner.homeListSwapToken += 1
    this.owner.homeEntryDataManager.playListSwapTransition(
      nextEntries,
      mode,
      this.owner.homeListSwapToken,
      HOME_LIST_SWAP_ENTRY_MIN_OPACITY,
      HOME_LIST_SWAP_ENTRY_OFFSET_Y,
      HOME_LIST_SWAP_ENTER_DURATION,
      HOME_LIST_SWAP_ANIMATION_ENABLED,
    )
  }
}
