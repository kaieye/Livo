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
  homeCandidateLimitValue,
  homeModeBooleanValue,
  homeModeLoadedValue,
  homeModeLoadingValue,
  homeNoProgressCountValue,
  homeVisibleEntryLimitValue,
  withHomeLoadedValue,
  withHomeLoadingValue,
  withHomeModeBooleanValue,
  withHomeNoProgressCountValue,
} from './HomeModeMapHelpers'
import {
  resolveHomeVisibleEntryInitialLimit,
  resolveHomeVisibleEntryRevealStep,
} from './HomeVisibleEntryPolicy'
import { HomeFeedSessionOwner } from './HomeFeedSessionOwner'

export class HomeFeedPaginationState {
  protected readonly session: HomeFeedSessionOwner

  constructor(session: HomeFeedSessionOwner) {
    this.session = session
  }

  shouldRenderAllEntriesForMode(_mode: SubscriptionMode): boolean {
    return false
  }

  candidateLimitForMode(mode: SubscriptionMode): number {
    return homeCandidateLimitValue(mode, this.session.homeCandidateLimitsByMode)
  }

  setCandidateLimitForMode(mode: SubscriptionMode, limit: number): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, limit)
    switch (mode) {
      case 'social':
        this.session.homeCandidateLimitsByMode.social = safeLimit
        break
      case 'pictures':
        this.session.homeCandidateLimitsByMode.pictures = safeLimit
        break
      case 'videos':
        this.session.homeCandidateLimitsByMode.videos = safeLimit
        break
      default:
        this.session.homeCandidateLimitsByMode.articles = safeLimit
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
    if (this.shouldRenderAllEntriesForMode(this.session.mode)) {
      return this.resolveHomeCandidateLimitForMode(this.session.mode, minimumLimit)
    }
    return Math.max(minimumLimit, this.candidateLimitForMode(this.session.mode))
  }

  markModeLoaded(mode: SubscriptionMode, loaded: boolean): void {
    this.session.homeModeLoaded = withHomeLoadedValue(mode, loaded, this.session.homeModeLoaded)
  }

  isModeLoaded(mode: SubscriptionMode): boolean {
    return homeModeLoadedValue(mode, this.session.homeModeLoaded)
  }

  isModeLoading(mode: SubscriptionMode): boolean {
    return homeModeLoadingValue(mode, this.session.homeModeLoading)
  }

  setModeLoading(mode: SubscriptionMode, loading: boolean): void {
    this.session.homeModeLoading = withHomeLoadingValue(mode, loading, this.session.homeModeLoading)
  }

  visibleEntryLimitFor(mode: SubscriptionMode): number {
    return homeVisibleEntryLimitValue(mode, this.session.homeVisibleEntryLimits)
  }

  setVisibleEntryLimitFor(mode: SubscriptionMode, limit: number): void {
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    switch (mode) {
      case 'social':
        this.session.homeVisibleEntryLimits.social = safeLimit
        break
      case 'pictures':
        this.session.homeVisibleEntryLimits.pictures = safeLimit
        break
      case 'videos':
        this.session.homeVisibleEntryLimits.videos = safeLimit
        break
      default:
        this.session.homeVisibleEntryLimits.articles = safeLimit
        break
    }
  }

  totalEntryCountFor(mode: SubscriptionMode): number {
    return this.session.filteredEntriesFor(mode).length
  }

  hasBufferedEntriesForMode(mode: SubscriptionMode): boolean {
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return false
    }
    return this.visibleEntryLimitFor(mode) < this.totalEntryCountFor(mode)
  }

  visibleEntriesFor(mode: SubscriptionMode): EntryCardModel[] {
    const entries = this.session.filteredEntriesFor(mode)
    if (this.shouldRenderAllEntriesForMode(mode)) {
      return entries
    }
    const limit = this.visibleEntryLimitFor(mode)
    const safeLimit = Math.max(resolveHomeVisibleEntryInitialLimit(mode), limit)
    return entries.slice(0, Math.min(entries.length, safeLimit))
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
    this.session.notifyHomeEntryDataAppendedForMode(mode, currentLimit)
    console.info(
      `[LIVO-PERF] expandVisible mode=${mode} currentLimit=${currentLimit} nextLimit=${nextLimit} total=${total} step=${nextLimit - currentLimit} expandMs=${Date.now() - expandStartedAt}`,
    )
    this.session.logHomeLoadMore(
      `expand-visible mode=${mode} currentLimit=${currentLimit} nextLimit=${nextLimit} total=${total}`,
    )
    return true
  }

  modeHasMoreEntries(mode: SubscriptionMode): boolean {
    return homeModeBooleanValue(mode, this.session.homeHasMoreEntriesByMode)
  }

  setModeHasMoreEntries(mode: SubscriptionMode, next: boolean, reason: string): void {
    const previous = this.modeHasMoreEntries(mode)
    if (previous === next) {
      return
    }
    this.session.homeHasMoreEntriesByMode =
      withHomeModeBooleanValue(mode, next, this.session.homeHasMoreEntriesByMode)
    this.session.logHomeLoadState(
      `modeHasMore mode=${mode} next=${next ? 'true' : 'false'} reason=${reason} `
      + `globalHasMore=${this.session.homeHasMoreEntries} visible=${this.visibleEntryCountFor(mode)}/${this.totalEntryCountFor(mode)}`,
    )
    if (next) {
      this.setHomeHasMoreEntries(true, `mode-has-more mode=${mode}`)
    }
  }

  setHomeHasMoreEntries(next: boolean, reason: string): void {
    if (this.session.homeHasMoreEntries === next) {
      return
    }
    const mode = this.session.mode
    const total = this.totalEntryCountFor(mode)
    const visible = this.visibleEntryCountFor(mode)
    this.session.homeHasMoreEntries = next
    if (!next) {
      this.session.homeHasMoreEntriesByMode = {
        articles: false,
        social: false,
        pictures: false,
        videos: false,
      }
    }
    this.session.logHomeLoadState(
      `hasMore=${next ? 'true' : 'false'} reason=${reason} mode=${mode} `
      + `candidateLimit=${this.candidateLimitForMode(mode)} featured=${this.session.featuredEntries.length} `
      + `visible=${visible}/${total} inProgress=${this.session.homeLoadMoreInProgress}`,
    )
  }

  modeNoProgressCount(mode: SubscriptionMode): number {
    return homeNoProgressCountValue(mode, this.session.homeModeNoProgressLoadMoreCount)
  }

  setModeNoProgressCount(mode: SubscriptionMode, count: number): void {
    const safeCount = Math.max(0, count)
    this.session.homeModeNoProgressLoadMoreCount =
      withHomeNoProgressCountValue(mode, safeCount, this.session.homeModeNoProgressLoadMoreCount)
  }

  syncModePaginationFromReloadResult(
    mode: SubscriptionMode,
    entries: EntryCardModel[],
    candidateLimit: number,
  ): void {
    const minimumLimit = resolveHomeVisibleEntryInitialLimit(mode)
    const safeLimit = Math.max(minimumLimit, candidateLimit)
    const currentEntries = this.session.filteredEntriesFor(mode)
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
    this.session.logHomeLoadMore(
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
    this.syncModePaginationFromReloadResult(this.session.mode, entries, candidateLimit)
  }
}
