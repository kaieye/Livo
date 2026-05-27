import {
  HOME_LOAD_MORE_SCROLL_QUIESCENT_MS,
  SubscriptionMode,
} from '../../config/HomeRootConfig'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'
import { HomeFeedGuard } from './HomeFeedGuard'
import { writeHomeLoadMoreInProgress } from '../../coordinators/index-home/HomeChromeProgressStore'

const HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS: number = 90
const HOME_LOAD_MORE_DRAIN_START_COOLDOWN_MS: number = 400

export class HomeLoadMoreDrain {
  private readonly state: HomeFeedState
  private readonly actions: HomeFeedActions
  private readonly guard: HomeFeedGuard
  private drainToken: number = 0
  private drainingMode: SubscriptionMode | '' = ''
  private stuckDrainRetryCount: number = 0
  private lastDrainStartedAt: number = 0
  private footerHintedByDrain: boolean = false

  constructor(
    state: HomeFeedState,
    actions: HomeFeedActions,
    guard: HomeFeedGuard,
  ) {
    this.state = state
    this.actions = actions
    this.guard = guard
  }

  get isDraining(): boolean {
    return this.drainingMode !== ''
  }

  get drainingForMode(): SubscriptionMode | '' {
    return this.drainingMode
  }

  canDrain(mode: SubscriptionMode, totalCount: number): boolean {
    return this.guard.canDrain(mode, totalCount)
  }

  handleListEndReach(
    mode: SubscriptionMode,
    totalCount: number,
    pendingLoadMoreForMode: (mode: SubscriptionMode) => boolean,
    requestLoadMore: (mode: SubscriptionMode, allowStaleScrollIntent: boolean) => boolean,
  ): void {
    if (!this.shouldStart(mode, totalCount, pendingLoadMoreForMode)) {
      return
    }
    const now = Date.now()
    if (now - this.lastDrainStartedAt < HOME_LOAD_MORE_DRAIN_START_COOLDOWN_MS) {
      return
    }
    this.lastDrainStartedAt = now
    this.drainToken += 1
    this.drainingMode = mode
    this.stuckDrainRetryCount = 0
    const token = this.drainToken
    if (!this.footerHintedByDrain) {
      this.footerHintedByDrain = true
      writeHomeLoadMoreInProgress(true)
    }
    this.actions.logHomeLoadMore(`drain start mode=${mode} total=${totalCount}`)
    this.scheduleStep(mode, token, requestLoadMore)
  }

  private shouldStart(mode: SubscriptionMode, totalCount: number, pendingLoadMoreForMode: (mode: SubscriptionMode) => boolean): boolean {
    if (this.drainingMode === mode || this.state.homeLoadMoreInProgress || pendingLoadMoreForMode(mode)) {
      return false
    }
    return this.guard.canDrain(mode, totalCount)
  }

  private scheduleStep(
    mode: SubscriptionMode,
    token: number,
    requestLoadMore: (mode: SubscriptionMode, allowStaleScrollIntent: boolean) => boolean,
  ): void {
    this.actions.runManagedTimeout(() => {
      this.step(mode, token, 0, requestLoadMore)
    }, 0)
  }

  private step(
    mode: SubscriptionMode,
    token: number,
    attempt: number,
    requestLoadMore: (mode: SubscriptionMode, allowStaleScrollIntent: boolean) => boolean,
  ): void {
    if (token !== this.drainToken) {
      return
    }
    if (!this.guard.canDrain(mode, 1)) {
      this.finish(mode, `drain stop mode=${mode} reason=inactive-or-exhausted`, true)
      return
    }
    const sinceLastScroll = Date.now() - this.state.homeScrollIntent.lastUserScrollAt
    if (
      this.state.homeScrollIntent.isInteracting
      || sinceLastScroll < HOME_LOAD_MORE_SCROLL_QUIESCENT_MS
      || this.state.homeLoadMoreInProgress
    ) {
      this.actions.runManagedTimeout(() => {
        this.step(mode, token, attempt + 1, requestLoadMore)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    const handled = requestLoadMore(mode, true)
    if (!handled) {
      if (this.stuckDrainRetryCount >= 3) {
        this.finish(mode, `drain stuck-bottom-exhausted mode=${mode} attempts=${attempt + 1}`, true)
        return
      }
      this.stuckDrainRetryCount += 1
      this.actions.runManagedTimeout(() => {
        this.step(mode, token, attempt + 1, requestLoadMore)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    this.finish(mode, `drain page-done mode=${mode} attempts=${attempt + 1} stuckRetries=${this.stuckDrainRetryCount}`, false)
  }

  private finish(mode: SubscriptionMode, message: string, clearHintedFooter: boolean): void {
    if (this.drainingMode === mode) {
      this.drainingMode = ''
    }
    if (clearHintedFooter && this.footerHintedByDrain) {
      writeHomeLoadMoreInProgress(false)
    }
    this.footerHintedByDrain = false
    this.actions.logHomeLoadMore(message)
  }
}
