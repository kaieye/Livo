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
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'

export class HomeFeedRefresh {
  private readonly state: HomeFeedState
  private readonly actions: HomeFeedActions

  constructor(state: HomeFeedState, actions: HomeFeedActions) {
    this.state = state
    this.actions = actions
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
        this.actions.logHomePerf(
          `startup-refresh skip reason=cooldown elapsedMs=${elapsedMs} cooldownMs=${HOME_STARTUP_REFRESH_COOLDOWN_MS}`,
        )
        return false
      }
    } catch (error) {
      this.actions.logHomeAsyncError('startup-refresh-check', error)
      return true
    }

    return true
  }

  async startStartupRefreshIfNeeded(snapshotRestored: boolean): Promise<void> {
    if (this.state.isHomeStartupRefreshing) {
      return
    }

    const shouldRun = await this.shouldRunStartupRefresh(snapshotRestored)
    if (!shouldRun) {
      return
    }

    this.state.isHomeStartupRefreshing = true
    void this.refreshFeaturedEntries(false).finally(() => {
      this.state.isHomeStartupRefreshing = false
      this.tryFlushDeferredFeedsChangedReload('startup-refresh-finally')
      this.actions.settleInitialHomeLoadState()
      this.actions.runManagedTimeout(() => {
        this.actions.settleInitialHomeLoadState(true)
      }, 1200)
    })
  }

  async refreshFeaturedEntries(showResultToast: boolean = true): Promise<void> {
    if (this.state.isRefreshing || !this.state.isComponentActive) {
      return
    }

    const startedAt = Date.now()
    this.actions.logHomePerf(`refresh start showToast=${showResultToast}`)
    this.actions.invalidateHomeLoadMorePrefetch()
    this.actions.resetModeLoadMoreStates('refresh-start')
    this.state.isRefreshing = true
    this.state.refreshCompletedCount = 0
    this.state.refreshTotalCount = 0
    this.state.lastRefreshProgressUiUpdateAt = 0
    this.clearRefreshPercentAnimation()
    this.state.displayRefreshPercent = 0

    try {
      const result = await FeedRefreshCoordinator.default.refreshAllFeeds((completedCount: number, totalCount: number) => {
        if (!this.state.isComponentActive) {
          return
        }
        if (this.state.homeScrollIntent.isInteracting && completedCount < totalCount) {
          return
        }

        const now = Date.now()
        const shouldFlushNow = completedCount >= totalCount
          || this.state.lastRefreshProgressUiUpdateAt === 0
          || now - this.state.lastRefreshProgressUiUpdateAt >= HOME_REFRESH_PROGRESS_UI_THROTTLE_MS
        if (!shouldFlushNow) {
          return
        }
        this.state.lastRefreshProgressUiUpdateAt = now

        this.state.refreshCompletedCount = completedCount
        this.state.refreshTotalCount = totalCount
        this.animateRefreshPercentTo(this.resolveRefreshPercent(completedCount, totalCount))
      })
      if (!this.state.isComponentActive) {
        return
      }
      this.state.feedSourceLabel = result.sourceLabel
      if (!result.allSkippedByCooldown) {
        this.scheduleHomeReloadAfterRefresh()
      }
      if (showResultToast) {
        this.actions.showToast(result.sourceLabel)
      }
    } catch (error) {
      this.actions.logHomeAsyncError('refresh-featured-entries', error)
      const errorMessage = this.actions.describeError(error)
      this.state.feedSourceLabel = `刷新失败：${errorMessage}`
      if (showResultToast) {
        this.actions.showToast('刷新失败，请查看日志')
      }
    } finally {
      this.state.isRefreshing = false
      this.state.refreshCompletedCount = 0
      this.state.refreshTotalCount = 0
      this.state.lastRefreshProgressUiUpdateAt = 0
      this.state.lastHomeRefreshFinishedAt = Date.now()
      this.clearRefreshPercentAnimation()
      this.state.displayRefreshPercent = 0
      this.actions.scheduleHomeLoadMorePrefetch()
      this.actions.logHomePerf(
        `refresh done elapsedMs=${Date.now() - startedAt} featured=${this.state.featuredEntries.length}`,
      )
    }
  }

  resolveRefreshPercent(completedCount: number, totalCount: number): number {
    return RefreshStateManager.resolveRefreshPercent(completedCount, totalCount)
  }

  clearRefreshPercentAnimation(): void {
    if (this.state.refreshPercentAnimationTimer < 0) {
      return
    }

    clearTimeout(this.state.refreshPercentAnimationTimer)
    this.state.refreshPercentAnimationTimer = -1
  }

  animateRefreshPercentTo(targetPercent: number): void {
    const animationPlan = RefreshStateManager.createPercentAnimationPlan(
      this.state.displayRefreshPercent,
      targetPercent,
    )
    const nextTarget = animationPlan.targetPercent
    if (nextTarget === this.state.displayRefreshPercent && this.state.refreshPercentAnimationTimer < 0) {
      return
    }

    this.state.pendingRefreshPercentTarget = nextTarget
    if (this.state.refreshPercentAnimationTimer >= 0) {
      return
    }

    this.state.refreshPercentAnimationTimer = setTimeout(() => {
      this.state.refreshPercentAnimationTimer = -1
      this.state.displayRefreshPercent = this.state.pendingRefreshPercentTarget
    }, HOME_REFRESH_PERCENT_COALESCE_MS)
  }

  markDeferredFeedsChangedReload(reason: string): void {
    this.state.hasDeferredFeedsChangedReload = true
    this.actions.logHomePerf(`feedsChanged deferred reason=${reason}`)
  }

  scheduleDeferredFeedsChangedRetry(delayMs: number): void {
    const safeDelayMs = Math.max(16, delayMs)
    const retryToken = this.state.deferredFeedsChangedRetryToken + 1
    this.state.deferredFeedsChangedRetryToken = retryToken
    this.actions.runManagedTimeout(() => {
      if (this.state.deferredFeedsChangedRetryToken !== retryToken) {
        return
      }
      this.tryFlushDeferredFeedsChangedReload('retry')
    }, safeDelayMs)
  }

  scheduleFeedsChangedReload(reason: string): void {
    const currentVersion = this.state.feedsChangedReloadVersion + 1
    this.state.feedsChangedReloadVersion = currentVersion
    this.actions.logHomePerf(`feedsChanged reload reason=${reason} version=${currentVersion}`)
    this.actions.invalidateHomeLoadMorePrefetch()
    this.actions.runManagedTimeout(() => {
      // 如果 timeout 触发时用户已切到其他 tab，跳过重载。
      if (!this.actions.isHomeRootTab()) {
        return
      }
      // 用当前栏目的初始可见数代替 HOME_MAX_CANDIDATE_LIMIT(480)，
      // 避免切回首页时一次性加载大量条目造成内存峰值。
      // 多余条目后续由滚动加载补齐。
      void this.actions.reloadFeaturedEntriesFromLocal(
        HOME_MODE_INITIAL_CANDIDATE_LIMIT, false, true, true,
      )
    }, 0)
  }

  tryFlushDeferredFeedsChangedReload(source: string): boolean {
    if (!this.state.hasDeferredFeedsChangedReload) {
      return false
    }
    if (!this.state.isComponentActive || !this.actions.isHomeRootTab()) {
      return false
    }
    if (this.state.homePostRefreshReloadPending) {
      return false
    }

    const now = Date.now()
    if (
      this.state.isRefreshing
      || this.state.isHomeStartupRefreshing
      || this.state.homeLoadMoreInProgress
      || this.state.homeScrollIntent.isInteracting
    ) {
      return false
    }
    if (now < this.state.suppressFeedsChangedUntilMs) {
      this.scheduleDeferredFeedsChangedRetry(this.state.suppressFeedsChangedUntilMs - now + 16)
      return true
    }

    this.state.hasDeferredFeedsChangedReload = false
    this.scheduleFeedsChangedReload(`deferred-${source}`)
    return true
  }

  handleFeedsChanged(): void {
    if (!this.state.isComponentActive) {
      return
    }

    const now = Date.now()
    if (!this.actions.isHomeRootTab()) {
      this.markDeferredFeedsChangedReload('not-home-tab')
      return
    }

    if (
      this.state.isRefreshing
      || this.state.isHomeStartupRefreshing
      || this.state.homeLoadMoreInProgress
      || this.state.homeScrollIntent.isInteracting
    ) {
      this.markDeferredFeedsChangedReload('busy')
      return
    }
    if (this.state.homePostRefreshReloadPending) {
      this.markDeferredFeedsChangedReload('post-refresh-pending')
      return
    }

    if (now < this.state.suppressFeedsChangedUntilMs) {
      this.markDeferredFeedsChangedReload('suppressed-until')
      this.scheduleDeferredFeedsChangedRetry(this.state.suppressFeedsChangedUntilMs - now + 16)
      return
    }

    if (now - this.state.lastHomeRefreshFinishedAt < HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS) {
      this.markDeferredFeedsChangedReload('post-refresh-suppress')
      const remainingSuppressMs = HOME_REFRESH_FEEDS_CHANGED_SUPPRESS_MS
        - (now - this.state.lastHomeRefreshFinishedAt)
      this.scheduleDeferredFeedsChangedRetry(remainingSuppressMs + 16)
      return
    }

    this.scheduleFeedsChangedReload('watch-event')
  }

  shouldRunFinalHomeReloadNow(): boolean {
    const currentOffset = this.actions.readHomeModeScrollOffset(this.state.mode)
    const shouldApplyLengthGuard = !this.actions.shouldRenderAllEntriesForMode(this.state.mode)
    return this.state.isComponentActive
      && this.actions.isHomeRootTab()
      && !this.state.isRefreshing
      && !this.state.isHomeStartupRefreshing
      && !this.state.isModeTransitioning
      && !this.state.homeListSwapAnimating
      && !this.state.searchOverlayVisible
      && !this.state.homeScrollIntent.isInteracting
      && !this.state.homeLoadMoreInProgress
      && !this.actions.pendingLoadMoreForMode(this.state.mode)
      && !this.actions.hasRecentHomeScrollIntent()
      && currentOffset < HOME_MODE_RAIL_COLLAPSE_OFFSET
      && (!shouldApplyLengthGuard || this.state.featuredEntries.length <= HOME_MAX_CANDIDATE_LIMIT)
  }

  scheduleFinalHomeReloadWhenIdle(currentVersion: number, attempt: number = 0): void {
    this.actions.runManagedTimeout(() => {
      if (this.state.postRefreshReloadVersion !== currentVersion) {
        return
      }

      if (!this.shouldRunFinalHomeReloadNow()) {
        if (attempt >= HOME_FINAL_RELOAD_IDLE_MAX_RETRIES) {
          void this.actions.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
          return
        }
        this.scheduleFinalHomeReloadWhenIdle(currentVersion, attempt + 1)
        return
      }

      void this.actions.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT)
    }, attempt === 0 ? HOME_REFRESH_FINAL_RELOAD_DELAY_MS : HOME_FINAL_RELOAD_IDLE_RETRY_MS)
  }

  scheduleHomeReloadAfterRefresh(): void {
    const currentVersion = this.state.postRefreshReloadVersion + 1
    this.state.postRefreshReloadVersion = currentVersion
    this.state.homePostRefreshReloadPending = true
    this.state.suppressFeedsChangedUntilMs = Date.now()
      + HOME_REFRESH_FINAL_RELOAD_DELAY_MS
      + HOME_FEEDS_CHANGED_SUPPRESS_EXTRA_MS

    this.actions.runManagedTimeout(() => {
      if (this.state.postRefreshReloadVersion !== currentVersion) {
        return
      }
      if (!this.shouldRunFinalHomeReloadNow()) {
        this.state.homePostRefreshReloadPending = false
        return
      }
      this.state.hasDeferredFeedsChangedReload = false
      void this.actions.reloadHomeEntriesFromLocal(HOME_MAX_CANDIDATE_LIMIT, true, true).finally(() => {
        if (this.state.postRefreshReloadVersion === currentVersion) {
          this.state.homePostRefreshReloadPending = false
        }
      })
    }, HOME_REFRESH_FIRST_SWAP_DELAY_MS)
  }
}