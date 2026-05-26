import { EntryCardModel } from '../../models/LivoModels'
import {
  HOME_FULL_MODE_CANDIDATE_LIMIT,
  HomeModeHasMoreMap,
  HomeModeLoadedMap,
  HomeModeLoadingMap,
  HomeModeNoProgressCountMap,
  HomeModeVisibleEntryLimitMap,
  HomeModeCandidateLimitMap,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import {
  perModeGet,
  perModeSet,
} from './HomeModeMapHelpers'
import { writeHomeHasMoreByMode } from '../index-home/HomeChromeProgressStore'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryRevealStep,
} from './HomeVisibleEntryPolicy'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'

class VisibleEntriesCacheSlot {
  entriesRef: Object | null = null
  limit: number = 0
  result: EntryCardModel[] = []

  constructor(entriesRef: Object, limit: number, result: EntryCardModel[]) {
    this.entriesRef = entriesRef
    this.limit = limit
    this.result = result
  }
}

export class HomeFeedPaginationState {
  protected readonly state: HomeFeedState
  protected readonly actions: HomeFeedActions
  private visibleEntriesCache: Record<string, VisibleEntriesCacheSlot> = {}

  constructor(state: HomeFeedState, actions: HomeFeedActions) {
    this.state = state
    this.actions = actions
  }

  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean {
    return false
  }

  candidateLimitForMode(mode: SubscriptionMode): number {
    return perModeGet(mode, this.state.homeCandidateLimitsByMode)
  }

  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, limit)
    switch (mode) {
      case 'social':
        this.state.homeCandidateLimitsByMode.social = safeLimit
        break
      case 'pictures':
        this.state.homeCandidateLimitsByMode.pictures = safeLimit
        break
      case 'videos':
        this.state.homeCandidateLimitsByMode.videos = safeLimit
        break
      default:
        this.state.homeCandidateLimitsByMode.articles = safeLimit
        break
    }
  }

  resolveHomeCandidateLimitForMode(mode: SubscriptionMode, minimumLimit: number): number {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return Math.max(HOME_FULL_MODE_CANDIDATE_LIMIT, minimumLimit)
    }
    return Math.max(minimumLimit, this.candidateLimitForMode(mode), resolveHomeVisibleEntryInitialLimit(mode))
  }

  resolveHomeCandidateLimit(minimumLimit: number): number {
    if (this.shouldRenderAllEntriesForMode(this.state.mode)) {
      return this.resolveHomeCandidateLimitForMode(this.state.mode, minimumLimit)
    }
    return Math.max(minimumLimit, this.candidateLimitForMode(this.state.mode))
  }

  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void {
    this.state.homeModeLoaded = perModeSet(mode, loaded, this.state.homeModeLoaded)
  }

  isModeLoaded(mode: SubscriptionMode): boolean {
    return perModeGet(mode, this.state.homeModeLoaded)
  }

  isModeLoading(mode: SubscriptionMode): boolean {
    return perModeGet(mode, this.state.homeModeLoading)
  }

  setModeLoading(mode: SubscriptionMode, loading: boolean): void {
    this.state.homeModeLoading = perModeSet(mode, loading, this.state.homeModeLoading)
  }

  visibleEntryLimitFor(mode: SubscriptionMode): number {
    return perModeGet(mode, this.state.homeVisibleEntryLimits)
  }

  setVisibleEntryLimitFor(mode: SubscriptionMode, limit: number): void {
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    switch (mode) {
      case 'social':
        this.state.homeVisibleEntryLimits.social = safeLimit
        break
      case 'pictures':
        this.state.homeVisibleEntryLimits.pictures = safeLimit
        break
      case 'videos':
        this.state.homeVisibleEntryLimits.videos = safeLimit
        break
      default:
        this.state.homeVisibleEntryLimits.articles = safeLimit
        break
    }
  }

  totalEntryCountFor(mode: SubscriptionMode): number {
    return this.actions.filteredEntriesFor(mode).length
  }

  hasBufferedEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    return this.visibleEntryLimitFor(mode) < this.totalEntryCountFor(mode)
  }

  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    const entries = this.actions.filteredEntriesFor(mode)
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return entries
    }
    const limit = this.visibleEntryLimitFor(mode)
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    const cache = this.visibleEntriesCache[mode]
    if (cache !== undefined && cache.entriesRef === entries && cache.limit === safeLimit) {
      return cache.result
    }
    const result = entries.slice(0, Math.min(entries.length, safeLimit))
    this.visibleEntriesCache[mode] = new VisibleEntriesCacheSlot(entries, safeLimit, result)
    return result
  }

  visibleEntryCountFor(mode: SubscriptionMode): number {
    const totalCount = this.totalEntryCountFor(mode)
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return totalCount
    }
    const limit = this.visibleEntryLimitFor(mode)
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    return Math.min(totalCount, safeLimit)
  }

  expandVisibleEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    const total = this.totalEntryCountFor(mode)
    const currentLimit = this.visibleEntryLimitFor(mode)
    if (currentLimit >= total) {
      return false
    }
    const expandStartedAt = Date.now()
    const nextLimit = Math.min(total, currentLimit + resolveHomeVisibleEntryRevealStep(mode))
    this.setVisibleEntryLimitFor(mode, nextLimit)
    // 仅是把已缓冲的尾部条目显露出来时，按"追加"通知列表，避免整列 reload。
    // 这样会更接近社交流的增量渲染路径，减少当前可见区的重排抖动。
    this.actions.notifyHomeEntryDataAppendedForMode(mode, currentLimit)
    console.info(
      `[LIVO-PERF] expandVisible mode=${mode} currentLimit=${currentLimit} nextLimit=${nextLimit} total=${total} step=${nextLimit - currentLimit} expandMs=${Date.now() - expandStartedAt}`,
    )
    this.actions.logHomeLoadMore(
      `expand-visible mode=${mode} currentLimit=${currentLimit} nextLimit=${nextLimit} total=${total}`,
    )
    return true
  }

  modeHasMoreEntries(mode: SubscriptionMode): boolean {
    return perModeGet(mode, this.state.homeHasMoreEntriesByMode)
  }

  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void {
    const previous = this.modeHasMoreEntries(mode)
    if (previous === next) {
      return
    }
    this.state.homeHasMoreEntriesByMode =
      perModeSet(mode, next, this.state.homeHasMoreEntriesByMode)
    // 同步给 AppStorage 供 LoadMoreFooterSlot 切换三态(spinner / "没更多了")。
    writeHomeHasMoreByMode(this.state.homeHasMoreEntriesByMode)
    this.actions.logHomeLoadState(
      `modeHasMore mode=${mode} next=${next ? 'true' : 'false'} reason=${reason} `
      + `globalHasMore=${this.state.homeHasMoreEntries} visible=${this.visibleEntryCountFor(mode)}/${this.totalEntryCountFor(mode)}`,
    )
    if (next) {
      this.setHomeHasMoreEntries(true, `mode-has-more mode=${mode}`)
    }
  }

  setHomeHasMoreEntries(next: boolean, reason: string): void {
    if (this.state.homeHasMoreEntries === next) {
      return
    }
    const mode = this.state.mode
    const total = this.totalEntryCountFor(mode)
    const visible = this.visibleEntryCountFor(mode)
    this.state.homeHasMoreEntries = next
    if (!next) {
      this.state.homeHasMoreEntriesByMode = {
        articles: false,
        social: false,
        pictures: false,
        videos: false,
      }
    }
    this.actions.logHomeLoadState(
      `hasMore=${next ? 'true' : 'false'} reason=${reason} mode=${mode} `
      + `candidateLimit=${this.candidateLimitForMode(mode)} featured=${this.state.featuredEntries.length} `
      + `visible=${visible}/${total} inProgress=${this.state.homeLoadMoreInProgress}`,
    )
  }

  modeNoProgressCount(mode: SubscriptionMode): number {
    return perModeGet(mode, this.state.homeModeNoProgressLoadMoreCount)
  }

  setModeNoProgressCount(mode: SubscriptionMode, count: number): void {
    const safeCount = Math.max(0, count)
    this.state.homeModeNoProgressLoadMoreCount =
      perModeSet(mode, safeCount, this.state.homeModeNoProgressLoadMoreCount)
  }

  syncModePaginationFromReloadResult(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    candidateLimit: number,
  ): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, candidateLimit)
    const currentEntries = this.actions.filteredEntriesFor(mode)
    const currentCount = currentEntries.length
    this.setCandidateLimitForMode(mode, safeLimit)
    if (entries.length >= safeLimit) {
      this.setModeHasMoreEntries(mode, true, `sync-pagination-full entries=${entries.length} limit=${safeLimit}`)
      return
    }
    if (entries.length > currentCount) {
      this.setModeHasMoreEntries(mode, true, `sync-pagination-growth entries=${entries.length} current=${currentCount} limit=${safeLimit}`)
      return
    }
    const visibleCount = this.visibleEntryCountFor(mode)
    const currentCandidateLimit = this.candidateLimitForMode(mode)
    const reachedCurrentBoundary = visibleCount >= currentCount && safeLimit > currentCandidateLimit
    if (currentCount > 0 && reachedCurrentBoundary) {
      this.setModeHasMoreEntries(
        mode,
        true,
        `sync-pagination-boundary visible=${visibleCount} current=${currentCount} limit=${safeLimit}`,
      )
      return
    }
    this.setModeHasMoreEntries(mode, false, `sync-pagination-short entries=${entries.length} limit=${safeLimit}`)
    this.actions.logHomeLoadMore(
      `stop-hasMore mode=${mode} entries=${entries.length} limit=${safeLimit} candidateLimit=${this.candidateLimitForMode(mode)}`,
    )
    if (!this.modeHasMoreEntries('articles')
      && !this.modeHasMoreEntries('social')
      && !this.modeHasMoreEntries('pictures')
      && !this.modeHasMoreEntries('videos')
    ) {
      this.setHomeHasMoreEntries(false, `all-modes-exhausted mode=${mode}`)
    }
  }

  syncHomePaginationFromReloadResult(entries: EntryCardModel[], candidateLimit: number): void {
    this.syncModePaginationFromReloadResult(this.state.mode, entries, candidateLimit)
  }
}