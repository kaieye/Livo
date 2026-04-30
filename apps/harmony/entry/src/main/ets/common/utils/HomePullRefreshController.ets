import { SubscriptionMode } from '../components/HomeRootConfig'
import { HomePullDebugSession } from './HomePullDebugSession'
import { RefreshStateManager } from './RefreshStateManager'
import {
  HOME_REFRESH_CONTENT_HOLD_DISTANCE,
  HOME_REFRESH_DISMISS_SCROLL_OFFSET,
  HOME_REFRESH_FINALIZE_DEBOUNCE_MS,
  HOME_REFRESH_FOLLOW_RATIO,
  HOME_REFRESH_GAP_OPEN_PULL_DISTANCE,
  HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y,
  HOME_REFRESH_INDICATOR_VISUAL_OFFSET,
  HOME_REFRESH_MAX_PULL_DISTANCE,
  HOME_REFRESH_PULL_DISTANCE,
  HOME_REFRESH_PULL_DISTANCE_STEP,
  HOME_REFRESH_RELEASE_FINALIZE_DEFER_MS,
  HOME_REFRESH_RESET_DURATION,
  HOME_REFRESH_TRIGGER_DEFER_MS,
  HOME_PULL_DEBUG_LOG_ENABLED,
  HOME_PULL_DEBUG_LOG_PREFIX,
} from '../components/HomeRootConfig'

export interface HomePullRefreshDelegate {
  getMode(): SubscriptionMode
  isRefreshing(): boolean
  isHomeRootTab(): boolean
  isScrollInteracting(): boolean
  shouldDisableHomePullRefresh(): boolean
  getScrollOffsetForMode(mode: SubscriptionMode): number
  getPullDistance(): number
  getIndicatorOffset(): number
  getContentHoldOffset(): number
  isIndicatorDismissed(): boolean
  getRefreshStatus(): RefreshStatus
  setPullDistance(v: number): void
  setIndicatorOffset(v: number): void
  setContentHoldOffset(v: number): void
  setIndicatorDismissed(v: boolean): void
  setRefreshStatus(s: RefreshStatus): void
  triggerRefresh(): void
  runManagedTimeout(cb: () => void, delayMs: number): void
}

export class HomePullRefreshController {
  private readonly delegate: HomePullRefreshDelegate
  private readonly pullDebug: HomePullDebugSession
  private lastFinalizAt: number = 0
  private finalizeQueued: boolean = false

  constructor(delegate: HomePullRefreshDelegate, pullDebug: HomePullDebugSession) {
    this.delegate = delegate
    this.pullDebug = pullDebug
  }

  shouldConsumeHomePullScroll(mode: SubscriptionMode): boolean {
    return !this.delegate.shouldDisableHomePullRefresh()
      && this.delegate.isHomeRootTab()
      && mode === this.delegate.getMode()
  }

  consumeHomePullScroll(mode: SubscriptionMode, scrollOffset: number): void {
    if (!this.shouldConsumeHomePullScroll(mode)) {
      return
    }

    this.pullDebug.willScrollCount += 1
    if (this.pullDebug.releasedAt > 0) {
      this.pullDebug.postReleaseWillScrollCount += 1
    }

    if (!this.delegate.isScrollInteracting() && !this.delegate.isRefreshing()) {
      this.pullDebug.ignoredWillScrollCount += 1
      return
    }

    if (this.delegate.isRefreshing()) {
      if (scrollOffset < 0
        && this.delegate.getScrollOffsetForMode(mode) <= 0.5
        && this.delegate.isIndicatorDismissed()) {
        this.reopenRefreshGap()
      }
      return
    }

    const isAtTop = this.delegate.getScrollOffsetForMode(mode) <= 0.5
    const hasPullDistance = this.delegate.getPullDistance() > 0.5
    if (scrollOffset < 0 && (isAtTop || hasPullDistance)) {
      if (this.delegate.isIndicatorDismissed()) {
        this.delegate.setIndicatorDismissed(false)
      }
      this.updateState(this.delegate.getPullDistance() + (-1 * scrollOffset * HOME_REFRESH_FOLLOW_RATIO))
      return
    }

    if (scrollOffset > 0 && hasPullDistance) {
      this.updateState(this.delegate.getPullDistance() - scrollOffset)
    }
  }

  private updateState(rawOffset: number): void {
    const nextOffset = Math.round(
      RefreshStateManager.resolvePullDistance(rawOffset, HOME_REFRESH_MAX_PULL_DISTANCE)
      / HOME_REFRESH_PULL_DISTANCE_STEP
    ) * HOME_REFRESH_PULL_DISTANCE_STEP

    if (!this.delegate.isRefreshing() && Math.abs(nextOffset - this.delegate.getPullDistance()) < 0.5) {
      return
    }

    this.delegate.setPullDistance(nextOffset)
    this.delegate.setIndicatorOffset(nextOffset)
    this.pullDebug.stateWriteCount += 1

    if (this.delegate.isRefreshing()) {
      this.delegate.setRefreshStatus(RefreshStatus.Refresh)
      return
    }

    if (nextOffset <= 0.5) {
      this.delegate.setRefreshStatus(RefreshStatus.Inactive)
    } else if (nextOffset >= HOME_REFRESH_PULL_DISTANCE) {
      this.delegate.setRefreshStatus(RefreshStatus.OverDrag)
    } else {
      this.delegate.setRefreshStatus(RefreshStatus.Drag)
    }
  }

  reset(): void {
    this.delegate.setPullDistance(0)
    this.delegate.setIndicatorOffset(0)
    this.delegate.setContentHoldOffset(0)
    this.delegate.setIndicatorDismissed(false)
    this.delegate.setRefreshStatus(RefreshStatus.Inactive)
  }

  dismissIndicatorDuringRefresh(): void {
    if (!this.delegate.isRefreshing() || this.delegate.isIndicatorDismissed()) {
      return
    }

    this.delegate.setIndicatorDismissed(true)
    this.delegate.setPullDistance(0)
    this.delegate.setIndicatorOffset(0)
    this.delegate.setContentHoldOffset(HOME_REFRESH_CONTENT_HOLD_DISTANCE)
    this.delegate.setRefreshStatus(RefreshStatus.Drag)

    this.delegate.runManagedTimeout(() => {
      if (!this.delegate.isRefreshing() || !this.delegate.isIndicatorDismissed()) {
        return
      }
      if (this.delegate.getIndicatorOffset() > 0.5 || this.delegate.getContentHoldOffset() > 0.5) {
        return
      }
      this.delegate.setRefreshStatus(RefreshStatus.Inactive)
    }, HOME_REFRESH_RESET_DURATION)
  }

  private reopenRefreshGap(): void {
    if (!this.delegate.isRefreshing() || !this.delegate.isIndicatorDismissed()) {
      return
    }
    this.delegate.setIndicatorDismissed(false)
    this.delegate.setIndicatorOffset(HOME_REFRESH_PULL_DISTANCE)
    this.delegate.setContentHoldOffset(HOME_REFRESH_CONTENT_HOLD_DISTANCE)
    this.delegate.setRefreshStatus(RefreshStatus.Refresh)
  }

  animateReset(): void {
    this.delegate.setPullDistance(0)
    this.delegate.setIndicatorOffset(0)
    this.delegate.setContentHoldOffset(0)

    if (this.delegate.isRefreshing()) {
      this.delegate.setRefreshStatus(RefreshStatus.Refresh)
      return
    }

    this.delegate.setRefreshStatus(RefreshStatus.Drag)
    this.delegate.runManagedTimeout(() => {
      if (this.delegate.isRefreshing()) {
        return
      }
      if (this.delegate.getIndicatorOffset() > 0.5 || this.delegate.getContentHoldOffset() > 0.5) {
        return
      }
      this.delegate.setRefreshStatus(RefreshStatus.Inactive)
    }, HOME_REFRESH_RESET_DURATION)
  }

  scheduleFinalize(mode: SubscriptionMode): void {
    if (mode !== this.delegate.getMode() || !this.delegate.isHomeRootTab()) {
      return
    }
    if (this.finalizeQueued) {
      return
    }
    this.finalizeQueued = true
    this.pullDebug.finalizeScheduleCount += 1
    this.logDebug(`session=${this.pullDebug.sessionId} schedule-finalize mode=${mode}`)
    this.delegate.runManagedTimeout(() => {
      this.finalizeQueued = false
      this.finalize()
    }, HOME_REFRESH_RELEASE_FINALIZE_DEFER_MS)
  }

  private finalize(): void {
    this.pullDebug.finalizeRunCount += 1
    const now = Date.now()
    if (now - this.lastFinalizAt < HOME_REFRESH_FINALIZE_DEBOUNCE_MS) {
      this.pullDebug.flushSummary('debounced')
      return
    }
    this.lastFinalizAt = now

    if (!this.shouldConsumeHomePullScroll(this.delegate.getMode())) {
      this.pullDebug.flushSummary('skip-not-consume')
      return
    }

    if (this.delegate.isRefreshing()) {
      if (this.delegate.isIndicatorDismissed()) {
        this.delegate.setIndicatorOffset(0)
      }
      this.pullDebug.flushSummary('already-refreshing')
      return
    }

    if (this.delegate.getPullDistance() >= HOME_REFRESH_PULL_DISTANCE) {
      this.delegate.setPullDistance(HOME_REFRESH_PULL_DISTANCE)
      this.delegate.setIndicatorOffset(HOME_REFRESH_PULL_DISTANCE)
      this.delegate.setContentHoldOffset(HOME_REFRESH_CONTENT_HOLD_DISTANCE)
      this.delegate.setIndicatorDismissed(false)
      this.delegate.setRefreshStatus(RefreshStatus.Refresh)
      this.delegate.runManagedTimeout(() => {
        if (this.delegate.isRefreshing() || this.delegate.getRefreshStatus() !== RefreshStatus.Refresh) {
          return
        }
        this.delegate.triggerRefresh()
      }, HOME_REFRESH_TRIGGER_DEFER_MS)
      this.pullDebug.flushSummary('trigger-refresh')
      return
    }

    if (this.delegate.getPullDistance() <= 0.5
      && this.delegate.getIndicatorOffset() <= 0.5
      && this.delegate.getContentHoldOffset() <= 0.5) {
      this.delegate.setRefreshStatus(RefreshStatus.Inactive)
      this.pullDebug.flushSummary('inactive-no-distance')
      return
    }

    this.animateReset()
    this.pullDebug.flushSummary('animate-reset')
  }

  shouldShowRefreshGap(mode: SubscriptionMode): boolean {
    if (this.delegate.shouldDisableHomePullRefresh() || !this.delegate.isHomeRootTab() || mode !== this.delegate.getMode()) {
      return false
    }
    if (this.delegate.isIndicatorDismissed()) {
      return this.delegate.getContentHoldOffset() > 0.5
    }
    return this.delegate.getIndicatorOffset() >= HOME_REFRESH_GAP_OPEN_PULL_DISTANCE
      || this.delegate.getContentHoldOffset() > 0.5
      || this.delegate.isRefreshing()
  }

  shouldShowRefreshIndicator(mode: SubscriptionMode): boolean {
    if (this.delegate.shouldDisableHomePullRefresh() || !this.delegate.isHomeRootTab() || mode !== this.delegate.getMode()) {
      return false
    }
    if (this.delegate.isIndicatorDismissed()) {
      return false
    }
    if (this.refreshGapHeight(mode) <= 0.5) {
      return false
    }
    return this.delegate.isRefreshing()
      || this.delegate.getRefreshStatus() !== RefreshStatus.Inactive
      || this.delegate.getIndicatorOffset() > 0.5
  }

  refreshGapHeight(mode: SubscriptionMode): number {
    return RefreshStateManager.resolveGapHeight({
      shouldShowGap: this.shouldShowRefreshGap(mode),
      indicatorOffset: this.delegate.getIndicatorOffset(),
      contentHoldOffset: this.delegate.getContentHoldOffset(),
      gapOpenPullDistance: HOME_REFRESH_GAP_OPEN_PULL_DISTANCE,
      followRatio: HOME_REFRESH_FOLLOW_RATIO,
      visualOffset: HOME_REFRESH_INDICATOR_VISUAL_OFFSET,
    })
  }

  indicatorProgress(): number {
    return RefreshStateManager.resolveIndicatorProgress(this.delegate.getIndicatorOffset(), HOME_REFRESH_PULL_DISTANCE)
  }

  indicatorOpacity(): number {
    return RefreshStateManager.resolveIndicatorOpacity(
      this.delegate.isRefreshing(),
      this.delegate.getRefreshStatus() === RefreshStatus.Refresh,
      this.indicatorProgress(),
    )
  }

  indicatorScale(): number {
    return RefreshStateManager.resolveIndicatorScale(this.indicatorProgress())
  }

  indicatorTranslateY(): number {
    return HOME_REFRESH_INDICATOR_RESTING_TRANSLATE_Y
  }

  checkDismissOnScroll(scrollOffset: number): void {
    if (this.delegate.isRefreshing() && scrollOffset > HOME_REFRESH_DISMISS_SCROLL_OFFSET) {
      this.dismissIndicatorDuringRefresh()
    }
  }

  startSession(mode: SubscriptionMode): void {
    this.pullDebug.start(mode)
  }

  markReleased(mode: SubscriptionMode): void {
    this.pullDebug.markReleased(mode)
  }

  private logDebug(message: string): void {
    if (!HOME_PULL_DEBUG_LOG_ENABLED) {
      return
    }
    console.info(`${HOME_PULL_DEBUG_LOG_PREFIX} ${message}`)
  }
}
