import { RefreshLogStore } from '../../services/RefreshLogStore'
import { FeedRefreshCoordinator } from '../../data/FeedRefreshCoordinator'
import {
  HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS,
  HOME_FINAL_RELOAD_IDLE_MAX_RETRIES,
  HOME_FINAL_RELOAD_IDLE_RETRY_MS,
  HOME_MAX_CANDIDATE_LIMIT,
  HOME_MODE_INITIAL_CANDIDATE_LIMIT,
  HOME_MODE_RAIL_COLLAPSE_OFFSET,
  HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS,
  HOME_REFRESH_FINAL_RELOAD_DELAY_MS,
  HOME_REFRESH_FIRST_SWAP_DELAY_MS,
  HOME_REFRESH_PERCENT_COALESCE_MS,
  HOME_REFRESH_PROGRESS_UI_THROTTLE_MS,
  HOME_STARTUP_REFRESH_COOLDOWN_MS,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import { RefreshStateManager } from './RefreshStateManager'
import { HomeFeedSessionOwner } from './HomeFeedSessionOwner'

export class HomeFeedRefresh {
  private readonly session: HomeFeedSessionOwner

  constructor(session: HomeFeedSessionOwner) {
    this.session = session
  }

  async shouldRunStartupRefresh(snapshotRestored: boolean): Promise<boolean> {
    if (!snapshotRestored) {
      return true
    }

    try {
      const logs = await RefreshLogStore.load()
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
        this.session.logHomePerf(
          `startup-refresh skip reason=cooldown elapsedMs=${elapsedMs} cooldownMs=${HOME_STARTUP_REFRESH_COOLDOWN_MS}`,
        )
        return false
      }
    } catch (error) {
      this.session.logHomeAsyncError('startup-refresh-check', error)
      return true
    }

    return true
  }

  async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> {
    if (this.session.isHomeStartupRefreshing) {
      return
    }

    const shouldRun = await this.shouldRunStartupRefresh(snapshotRestored)
    if (!shouldRun) {
      return
    }

    this.session.isHomeStartupRefreshing = true
    void this.refreshFeaturedEntries(false).finally(() => {
      this.session.isHomeStartupRefreshing = false
      this.tryFlushDeferredFeedsChangedReload('startup-refresh-finally')
      this.session.settleInitialHomeLoadState()
      this.session.runManagedTimeout(() => {
        this.session.settleInitialHomeLoadState(true)
      }, 1200)
    })
  }

  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> {
    if (this.session.isRefreshing || !this.session.isComponentActive) {
      return
    }

    const startedAt = Date.now()
    this.session.logHomePerf(`refresh start showToast=${showResultToast}`)
    this.session.invalidateHomeLoadMorePrefetch()
    this.session.resetModeLoadMoreStates('refresh-start')
    this.session.isRefreshing = true
    this.session.refreshCompletedCount = 0
    this.session.refreshTotalCount = 0
    this.session.lastRefreshProgressUiUpdateAt = 0
    this.clearRefreshPercentAnimation()
    this.session.displayRefreshPercent = 0

    try {
      const result = await FeedRefreshCoordinator.default.refreshAllFeeds((completedCount: number, totalCount: number) => {
        if (!this.session.isComponentActive) {
          return
        }
        if (this.session.homeScrollIntent.isInteracting && completedCount < totalCount) {
          return
        }

        const now = Date.now()
        const shouldFlushNow = completedCount >= totalCount
          || this.session.lastRefreshProgressUiUpdateAt === 0
          || now - this.session.lastRefreshProgressUiUpdateAt >= HOME_REFRESH_PROGRESS_UI_THROTTLE_MS
        if (!shouldFlushNow) {
          return
        }
        this.session.lastRefreshProgressUiUpdateAt = now

        this.session.refreshCompletedCount = completedCount
        this.session.refreshTotalCount = totalCount
        this.animateRefreshPercentTo(this.resolveRefreshPercent(completedCount, totalCount))
      })
      if (!this.session.isComponentActive) {
        return
      }
      this.session.feedSourceLabel = result.sourceLabel
      if (!result.allSkippedByCooldown) {
        this.scheduleHomeReloadAfterRefresh()
      }
      if (showResultToast) {
        this.session.showToast(result.sourceLabel)
      }
    } catch (error) {
      this.session.logHomeAsyncError('refresh-featured-entries', error)
      const errorMessage = this.session.describeError(error)
      this.session.feedSourceLabel = `刷新失败：${errorMessage}`
      if (showResultToast) {
        this.session.showToast('刷新失败，请查看日志')
      }
    } finally {
      this.session.isRefreshing = false
      this.session.refreshCompletedCount = 0
      this.session.refreshTotalCount = 0
      this.session.lastRefreshProgressUiUpdateAt = 0
      this.session.lastHomeRefreshFinishedAt = Date.now()
      this.clearRefreshPercentAnimation()
      this.session.displayRefreshPercent = 0
      this.session.scheduleHomeLoadMorePrefetch()
      this.session.logHomePerf(
        `refresh done elapsedMs=${Date.now() - startedAt} featured=${this.session.featuredEntries.length}`,
      )
    }
  }

  resolveRefreshPercent(completedCount: number, totalCount: number): number {
    return RefreshStateManager.resolveRefreshPercent(completedCount, totalCount)
  }

  clearRefreshPercentAnimation(): void {
    if (this.session.refreshPercentAnimationTimer < 0) {
      return
    }

    clearTimeout(this.session.refreshPercentAnimationTimer)
    this.session.refreshPercentAnimationTimer = -1
  }

  animateRefreshPercentTo(targetPercent: number): void {
    const animationPlan = RefreshStateManager.createPercentAnimationPlan(
      this.session.displayRefreshPercent,
      targetPercent,
    )
    const nextTarget = animationPlan.targetPercent
    if (nextTarget === this.session.displayRefreshPercent && this.session.refreshPercentAnimationTimer < 0) {
      return
    }

    this.session.pendingRefreshPercentTarget = nextTarget
    if (this.session.refreshPercentAnimationTimer >= 0) {
      return
    }

    this.session.refreshPercentAnimationTimer = setTimeout(() => {
      this.session.refreshPercentAnimationTimer = -1
      this.session.displayRefreshPercent = this.session.pendingRefreshPercentTarget
    }, HOME_REFRESH_PERCENT_COALESCE_MS)
  }

  markDeferredFeedsChangedReload(reason: string): void {
    this.session.hasDeferredFeedsChangedReload = true
    this.session.logHomePerf(`feedsChanged deferred reason=${reason}`)
  }

  scheduleDeferredFeedsChangedRetry(delayMs: number): void {
    const safeDelayMs = Math.max(16, delayMs)
    const retryToken = this.session.deferredFeedsChangedRetryToken + 1
    this.session.deferredFeedsChangedRetryToken = retryToken
    this.session.runManagedTimeout(() => {
      if (this.session.deferredFeedsChangedRetryToken !== retryToken) {
        return
      }
      this.tryFlushDeferredFeedsChangedReload('retry')
    }, safeDelayMs)
  }

  scheduleFeedsChangedReload(reason: string): void {
    const currentVersion = this.session.feedsChangedReloadVersion + 1
    this.session.feedsChangedReloadVersion = currentVersion
    this.session.logHomePerf(`feedsChanged reload reason=${reason} version=${currentVersion}`)
    this.session.invalidateHomeLoadMorePrefetch()
    this.session.runManagedTimeout(() => {
      // 如果 timeout 触发时用户已切到其他 tab，跳过重载。
      if (!this.session.isHomeRootTab()) {
        return
      }
      // 用当前栏目的初始可见数代替 HOME_MAX_CANDIDATE_LIMIT(480)，
      // 避免切回首页时一次性加载大量条目造成内存峰值。
      // 多余条目后续由滚动加载补齐。
      void this.session.reloadFeaturedEntriesFromLocal(
        HOME_MODE_INITIAL_CANDIDATE_LIMIT, false, true, true,
      )
    }, 0)
  }

  tryFlushDeferredFeedsChangedReload(source: string): boolean {
    if (!this.session.hasDeferredFeedsChangedReload) {
      return false
    }
    if (!this.session.isComponentActive || !this.session.isHomeRootTab()) {
      return false
    }
    if (this.session.homePostRefreshReloadPending) {
      return false
    }

    const now = Date.now()
    if (
      this.session.isRefreshing
      || this.session.isHomeStartupRefreshing
      || this.session.homeLoadMoreInProgress
      || this.session.homeScrollIntent.isInteracting
    ) {
      return false
    }
    if (now < this.session.suppressFeedsChangedUntilMs) {
      this.scheduleDeferredFeedsChangedRetry(this.session.suppressFeedsChangedUntilMs - now + 16)
      return true
    }

    this.session.hasDeferredFeedsChangedReload = false
    this.scheduleFeedsChangedReload(`deferred-${source}`)
    return true
  }

  handleFeedsChanged(): void {
    if (!this.session.isComponentActive) {
      return
    }

    const now = Date.now()
    if (!this.session.isHomeRootTab()) {
      this.markDeferredFeedsChangedReload('not-home-tab')
      return
    }

    if (
      this.session.isRefreshing
      || this.session.isHomeStartupRefreshing
      || this.session.homeLoadMoreInProgress
      || this.session.homeScrollIntent.isInteracting
    ) {
      this.markDeferredFeedsChangedReload('busy')
      return
    }
    if (this.session.homePostRefreshReloadPending) {
      this.markDeferredFeedsChangedReload('post-refresh-pending')
      return
    }

    if (now < this.session.suppressFeedsChangedUntilMs) {
      this.markDeferredFeedsChangedReload('suppressed-until')
      this.scheduleDeferredFeedsChangedRetry(this.session.suppressFeedsChangedUntilMs - now + 16)
      return
    }

    if (now - this.session.lastHomeRefreshFinishedAt < HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS) {
      this.markDeferredFeedsChangedReload('post-refresh-suppress')
      const remainingSuppressMs = HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS
        - (now - this.session.lastHomeRefreshFinishedAt)
      this.scheduleDeferredFeedsChangedRetry(remainingSuppressMs + 16)
      return
    }

    this.scheduleFeedsChangedReload('watch-event')
  }

  shouldRunFinalHomeReloadNow(): boolean {
    const currentOffset = this.session.readHomeModeScrollOffset(this.session.mode)
    const shouldApplyLengthGuard = !this.session.shouldRenderAllEntriesForMode(this.session.mode)
    return this.session.isComponentActive
      && this.session.isHomeRootTab()
      && !this.session.isRefreshing
      && !this.session.isHomeStartupRefreshing
      && !this.session.isModeTransitioning
      && !this.session.homeListSwapAnimating
      && !this.session.searchOverlayVisible
      && !this.session.homeScrollIntent.isInteracting
      && !this.session.homeLoadMoreInProgress
      && !this.session.pendingLoadMoreForMode(this.session.mode)
      && !this.session.hasRecentHomeScrollIntent()
      && currentOffset < HOME_MODE_RAIL_COLLAPSE_OFFSET
      && (!shouldApplyLengthGuard || this.session.featuredEntries.length <= HOME_MAX_CANDIDATE_LIMIT)
  }

  scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void {
    this.session.runManagedTimeout(() => {
      if (this.session.postRefreshReloadVersion !== currentVersion) {
        return
      }

      if (!this.shouldRunFinalHomeReloadNow()) {
        if (attempt >= HOME_FINAL_RELOAD_IDLE_MAX_RETRIES) {
          void this.session.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
          return
        }
        this.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt + 1)
        return
      }

      void this.session.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
    }, attempt === 0 ? HOME_REFRESH_FINAL_RELOAD_DELAY_MS : HOME_FINAL_RELOAD_IDLE_RETRY_MS)
  }

  scheduleHomeReloadAfterRefresh(): void {
    const currentVersion = this.session.postRefreshReloadVersion + 1
    this.session.postRefreshReloadVersion = currentVersion
    this.session.homePostRefreshReloadPending = true
    this.session.suppressFeedsChangedUntilMs = Date.now()
      + HOME_REFRESH_FINAL_RELOAD_DELAY_MS
      + HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS

    this.session.runManagedTimeout(() => {
      if (this.session.postRefreshReloadVersion !== currentVersion) {
        return
      }
      if (!this.shouldRunFinalHomeReloadNow()) {
        this.session.homePostRefreshReloadPending = false
        return
      }
      this.session.hasDeferredFeedsChangedReload = false
      void this.session.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT, true, true).finally(() => {
        if (this.session.postRefreshReloadVersion === currentVersion) {
          this.session.homePostRefreshReloadPending = false
        }
      })
    }, HOME_REFRESH_FIRST_SWAP_DELAY_MS)
  }
}
