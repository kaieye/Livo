import { AppRepository } from '../data/AppRepository'
import { EntryCardModel } from '../models/LivoModels'
import {
  HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS,
  HOME_FINAL_RELOAD_IDLE_MAX_RETRIES,
  HOME_FINAL_RELOAD_IDLE_RETRY_MS,
  HOME_MAX_CANDIDATE_LIMIT,
  HOME_MODE_RAIL_COLLAPSE_OFFSET,
  HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS,
  HOME_REFRESH_FINAL_RELOAD_DELAY_MS,
  HOME_REFRESH_FIRST_SWAP_DELAY_MS,
  HOME_REFRESH_PERCENT_COALESCE_MS,
  HOME_REFRESH_PROGRESS_UI_THROTTLE_MS,
  HOME_STARTUP_REFRESH_COOLDOWN_MS,
  SubscriptionMode,
} from '../components/HomeRootConfig'
import { RefreshStateManager } from './RefreshStateManager'

export interface IndexHomeRefreshOwner {
  isRefreshing: boolean
  isComponentActive: boolean
  isHomeScrollInteracting: boolean
  refreshCompletedCount: number
  refreshTotalCount: number
  lastRefreshProgressUiUpdateAt: number
  displayRefreshPercent: number
  refreshPercentAnimationTimer: number
  pendingRefreshPercentTarget: number
  feedSourceLabel: string
  lastHomeRefreshFinishedAt: number
  isHomeStartupRefreshing: boolean
  homePostRefreshReloadPending: boolean
  postRefreshReloadVersion: number
  suppressFeedsChangedUntilMs: number
  hasDeferredFeedsChangedReload: boolean
  deferredFeedsChangedRetryToken: number
  feedsChangedReloadVersion: number
  homeLoadMoreInProgress: boolean
  isModeTransitioning: boolean
  homeListSwapAnimating: boolean
  searchOverlayVisible: boolean
  featuredEntries: EntryCardModel[]
  mode: SubscriptionMode

  logHomePerf(message: string): void
  invalidateHomeLoadMorePrefetch(): void
  resetModeLoadMoreStates(reason: string): void
  logHomeAsyncError(stage: string, error: Error | string | Object): void
  describeError(error: Error | string | Object): string
  showToast(message: string, duration?: number): void
  scheduleHomeLoadMorePrefetch(delayMs?: number): void
  settleInitialHomeLoadState(force?: boolean): void
  runManagedTimeout(callback: () => void, delayMs: number): void
  reloadHomeEntriesFromLocal(
    candidateLimit?: number,
    animated?: boolean,
    deferredGrouping?: boolean,
    preferFastPath?: boolean,
  ): Promise<void>
  isHomeRootTab(): boolean
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean
  hasRecentHomeScrollIntent(): boolean
  readHomeModeScrollOffset(mode: SubscriptionMode): number
  shouldRenderAllEntriesForMode(mode: SubscriptionMode): boolean
}

export class IndexHomeRefreshCoordinator {
  private readonly owner: IndexHomeRefreshOwner

  constructor(owner: IndexHomeRefreshOwner) {
    this.owner = owner
  }

  async shouldRunStartupRefresh(snapshotRestored: boolean): Promise<boolean> {
    if (!snapshotRestored) {
      return true
    }

    try {
      const logs = await AppRepository.refreshLogs()
      if (logs.length <= 0) {
        return true
      }

      const latestSuccessfulLog = logs.find((log) => {
        return Math.max(0, Number(log.successFeedCount) || 0) > 0
      })
      if (!latestSuccessfulLog) {
        return true
      }

      const latestRefreshAt = Math.max(0, Number(latestSuccessfulLog.refreshedAt) || 0)
      if (latestRefreshAt <= 0) {
        return true
      }

      const elapsedMs = Date.now() - latestRefreshAt
      if (elapsedMs < HOME_STARTUP_REFRESH_COOLDOWN_MS) {
        this.owner.logHomePerf(
          `startup-refresh skip reason=cooldown elapsedMs=${elapsedMs} cooldownMs=${HOME_STARTUP_REFRESH_COOLDOWN_MS}`,
        )
        return false
      }
    } catch (error) {
      this.owner.logHomeAsyncError('startup-refresh-check', error)
      return true
    }

    return true
  }

  async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> {
    if (this.owner.isHomeStartupRefreshing) {
      return
    }

    const shouldRun = await this.shouldRunStartupRefresh(snapshotRestored)
    if (!shouldRun) {
      return
    }

    this.owner.isHomeStartupRefreshing = true
    void this.refreshFeaturedEntries(false).finally(() => {
      this.owner.isHomeStartupRefreshing = false
      this.tryFlushDeferredFeedsChangedReload('startup-refresh-finally')
      this.owner.settleInitialHomeLoadState()
      this.owner.runManagedTimeout(() => {
        this.owner.settleInitialHomeLoadState(true)
      }, 1200)
    })
  }

  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> {
    if (this.owner.isRefreshing || !this.owner.isComponentActive) {
      return
    }

    const startedAt = Date.now()
    this.owner.logHomePerf(`refresh start showToast=${showResultToast}`)
    this.owner.invalidateHomeLoadMorePrefetch()
    this.owner.resetModeLoadMoreStates('refresh-start')
    this.owner.isRefreshing = true
    this.owner.refreshCompletedCount = 0
    this.owner.refreshTotalCount = 0
    this.owner.lastRefreshProgressUiUpdateAt = 0
    this.clearRefreshPercentAnimation()
    this.owner.displayRefreshPercent = 0

    try {
      const result = await AppRepository.refreshAllFeeds((completedCount: number, totalCount: number) => {
        if (!this.owner.isComponentActive) {
          return
        }
        if (this.owner.isHomeScrollInteracting && completedCount < totalCount) {
          return
        }

        const now = Date.now()
        const shouldFlushNow = completedCount >= totalCount
          || this.owner.lastRefreshProgressUiUpdateAt === 0
          || now - this.owner.lastRefreshProgressUiUpdateAt >= HOME_REFRESH_PROGRESS_UI_THROTTLE_MS
        if (!shouldFlushNow) {
          return
        }
        this.owner.lastRefreshProgressUiUpdateAt = now

        this.owner.refreshCompletedCount = completedCount
        this.owner.refreshTotalCount = totalCount
        this.animateRefreshPercentTo(this.resolveRefreshPercent(completedCount, totalCount))
      })
      if (!this.owner.isComponentActive) {
        return
      }
      this.owner.feedSourceLabel = result.sourceLabel
      if (!result.allSkippedByCooldown) {
        this.scheduleHomeReloadAfterRefresh()
      }
      if (showResultToast) {
        this.owner.showToast(result.sourceLabel)
      }
    } catch (error) {
      this.owner.logHomeAsyncError('refresh-featured-entries', error)
      const errorMessage = this.owner.describeError(error)
      this.owner.feedSourceLabel = `刷新失败：${errorMessage}`
      if (showResultToast) {
        this.owner.showToast('刷新失败，请查看日志')
      }
    } finally {
      this.owner.isRefreshing = false
      this.owner.refreshCompletedCount = 0
      this.owner.refreshTotalCount = 0
      this.owner.lastRefreshProgressUiUpdateAt = 0
      this.owner.lastHomeRefreshFinishedAt = Date.now()
      this.clearRefreshPercentAnimation()
      this.owner.displayRefreshPercent = 0
      this.owner.scheduleHomeLoadMorePrefetch()
      this.owner.logHomePerf(
        `refresh done elapsedMs=${Date.now() - startedAt} featured=${this.owner.featuredEntries.length}`,
      )
    }
  }

  resolveRefreshPercent(completedCount: number, totalCount: number): number {
    return RefreshStateManager.resolveRefreshPercent(completedCount, totalCount)
  }

  clearRefreshPercentAnimation(): void {
    if (this.owner.refreshPercentAnimationTimer < 0) {
      return
    }

    clearTimeout(this.owner.refreshPercentAnimationTimer)
    this.owner.refreshPercentAnimationTimer = -1
  }

  animateRefreshPercentTo(targetPercent: number): void {
    const animationPlan = RefreshStateManager.createPercentAnimationPlan(
      this.owner.displayRefreshPercent,
      targetPercent,
    )
    const nextTarget = animationPlan.targetPercent
    if (nextTarget === this.owner.displayRefreshPercent && this.owner.refreshPercentAnimationTimer < 0) {
      return
    }

    this.owner.pendingRefreshPercentTarget = nextTarget
    if (this.owner.refreshPercentAnimationTimer >= 0) {
      return
    }

    this.owner.refreshPercentAnimationTimer = setTimeout(() => {
      this.owner.refreshPercentAnimationTimer = -1
      this.owner.displayRefreshPercent = this.owner.pendingRefreshPercentTarget
    }, HOME_REFRESH_PERCENT_COALESCE_MS)
  }

  markDeferredFeedsChangedReload(reason: string): void {
    this.owner.hasDeferredFeedsChangedReload = true
    this.owner.logHomePerf(`feedsChanged deferred reason=${reason}`)
  }

  scheduleDeferredFeedsChangedRetry(delayMs: number): void {
    const safeDelayMs = Math.max(16, delayMs)
    const retryToken = this.owner.deferredFeedsChangedRetryToken + 1
    this.owner.deferredFeedsChangedRetryToken = retryToken
    this.owner.runManagedTimeout(() => {
      if (this.owner.deferredFeedsChangedRetryToken !== retryToken) {
        return
      }
      this.tryFlushDeferredFeedsChangedReload('retry')
    }, safeDelayMs)
  }

  scheduleFeedsChangedReload(reason: string): void {
    const currentVersion = this.owner.feedsChangedReloadVersion + 1
    this.owner.feedsChangedReloadVersion = currentVersion
    this.owner.logHomePerf(`feedsChanged reload reason=${reason} version=${currentVersion}`)
    this.owner.invalidateHomeLoadMorePrefetch()
    this.owner.runManagedTimeout(() => {
      void this.owner.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT, false, false)
    }, 0)
  }

  tryFlushDeferredFeedsChangedReload(source: string): boolean {
    if (!this.owner.hasDeferredFeedsChangedReload) {
      return false
    }
    if (!this.owner.isComponentActive || !this.owner.isHomeRootTab()) {
      return false
    }
    if (this.owner.homePostRefreshReloadPending) {
      return false
    }

    const now = Date.now()
    if (
      this.owner.isRefreshing
      || this.owner.isHomeStartupRefreshing
      || this.owner.homeLoadMoreInProgress
      || this.owner.isHomeScrollInteracting
    ) {
      return false
    }
    if (now < this.owner.suppressFeedsChangedUntilMs) {
      this.scheduleDeferredFeedsChangedRetry(this.owner.suppressFeedsChangedUntilMs - now + 16)
      return true
    }

    this.owner.hasDeferredFeedsChangedReload = false
    this.scheduleFeedsChangedReload(`deferred-${source}`)
    return true
  }

  handleFeedsChanged(): void {
    if (!this.owner.isComponentActive) {
      return
    }

    const now = Date.now()
    if (!this.owner.isHomeRootTab()) {
      this.markDeferredFeedsChangedReload('not-home-tab')
      return
    }

    if (
      this.owner.isRefreshing
      || this.owner.isHomeStartupRefreshing
      || this.owner.homeLoadMoreInProgress
      || this.owner.isHomeScrollInteracting
    ) {
      this.markDeferredFeedsChangedReload('busy')
      return
    }
    if (this.owner.homePostRefreshReloadPending) {
      this.markDeferredFeedsChangedReload('post-refresh-pending')
      return
    }

    if (now < this.owner.suppressFeedsChangedUntilMs) {
      this.markDeferredFeedsChangedReload('suppressed-until')
      this.scheduleDeferredFeedsChangedRetry(this.owner.suppressFeedsChangedUntilMs - now + 16)
      return
    }

    if (now - this.owner.lastHomeRefreshFinishedAt < HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS) {
      this.markDeferredFeedsChangedReload('post-refresh-suppress')
      const remainingSuppressMs = HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS
        - (now - this.owner.lastHomeRefreshFinishedAt)
      this.scheduleDeferredFeedsChangedRetry(remainingSuppressMs + 16)
      return
    }

    this.scheduleFeedsChangedReload('watch-event')
  }

  shouldRunFinalHomeReloadNow(): boolean {
    const currentOffset = this.owner.readHomeModeScrollOffset(this.owner.mode)
    const shouldApplyLengthGuard = !this.owner.shouldRenderAllEntriesForMode(this.owner.mode)
    return this.owner.isComponentActive
      && this.owner.isHomeRootTab()
      && !this.owner.isRefreshing
      && !this.owner.isHomeStartupRefreshing
      && !this.owner.isModeTransitioning
      && !this.owner.homeListSwapAnimating
      && !this.owner.searchOverlayVisible
      && !this.owner.isHomeScrollInteracting
      && !this.owner.homeLoadMoreInProgress
      && !this.owner.pendingLoadMoreForMode(this.owner.mode)
      && !this.owner.hasRecentHomeScrollIntent()
      && currentOffset < HOME_MODE_RAIL_COLLAPSE_OFFSET
      && (!shouldApplyLengthGuard || this.owner.featuredEntries.length <= HOME_MAX_CANDIDATE_LIMIT)
  }

  scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void {
    this.owner.runManagedTimeout(() => {
      if (this.owner.postRefreshReloadVersion !== currentVersion) {
        return
      }

      if (!this.shouldRunFinalHomeReloadNow()) {
        if (attempt >= HOME_FINAL_RELOAD_IDLE_MAX_RETRIES) {
          void this.owner.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
          return
        }
        this.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt + 1)
        return
      }

      void this.owner.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
    }, attempt === 0 ? HOME_REFRESH_FINAL_RELOAD_DELAY_MS : HOME_FINAL_RELOAD_IDLE_RETRY_MS)
  }

  scheduleHomeReloadAfterRefresh(): void {
    const currentVersion = this.owner.postRefreshReloadVersion + 1
    this.owner.postRefreshReloadVersion = currentVersion
    this.owner.homePostRefreshReloadPending = true
    this.owner.suppressFeedsChangedUntilMs = Date.now()
      + HOME_REFRESH_FINAL_RELOAD_DELAY_MS
      + HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS

    this.owner.runManagedTimeout(() => {
      if (this.owner.postRefreshReloadVersion !== currentVersion) {
        return
      }
      if (!this.shouldRunFinalHomeReloadNow()) {
        this.owner.homePostRefreshReloadPending = false
        return
      }
      this.owner.hasDeferredFeedsChangedReload = false
      void this.owner.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT, true, true).finally(() => {
        if (this.owner.postRefreshReloadVersion === currentVersion) {
          this.owner.homePostRefreshReloadPending = false
        }
      })
    }, HOME_REFRESH_FIRST_SWAP_DELAY_MS)
  }
}
