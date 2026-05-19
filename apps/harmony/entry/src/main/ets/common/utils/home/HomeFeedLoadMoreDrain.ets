import { SubscriptionMode } from '../../components/HomeRootConfig'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'
import { HomeFeedGuard, HomeFeedGuardProvider } from './HomeFeedGuard'

export interface HomeFeedLoadMoreDrainPaginationOwner {
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean
  hasBufferedEntriesForMode(mode: SubscriptionMode): boolean
  modeHasMoreEntries(mode: SubscriptionMode): boolean
  requestLoadMoreForMode(mode: SubscriptionMode, allowStaleScrollIntent?: boolean): boolean
}

const HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS: number = 90
const HOME_LOAD_MORE_DRAIN_START_COOLDOWN_MS: number = 400

// 触底只是兜底信号：每次只请求一个栏目页，并等拖拽结束后再执行。
export class HomeFeedLoadMoreDrain {
  private readonly state: HomeFeedState
  private readonly actions: HomeFeedActions
  private readonly owner: HomeFeedLoadMoreDrainPaginationOwner
  private readonly guard: HomeFeedGuard
  private drainToken: number = 0
  private drainingMode: SubscriptionMode | '' = ''
  private stuckRetryCount: number = 0
  private lastDrainStartedAt: number = 0

  constructor(state: HomeFeedState, actions: HomeFeedActions, owner: HomeFeedLoadMoreDrainPaginationOwner) {
    this.state = state
    this.actions = actions
    this.owner = owner
    const provider = new HomeFeedGuardProvider(
      () => actions.isHomeRootTab(),
      () => actions.hasHomeInlineSearchQuery(),
      () => false,
      (_mode: SubscriptionMode) => false,
      (_mode: SubscriptionMode) => false,
      (mode: SubscriptionMode) => owner.hasBufferedEntriesForMode(mode),
      (mode: SubscriptionMode) => owner.modeHasMoreEntries(mode),
      (_mode: SubscriptionMode) => 0,
    )
    this.guard = new HomeFeedGuard(state, provider)
  }

  handleListEndReach(mode: SubscriptionMode, totalCount: number): void {
    if (!this.shouldStart(mode, totalCount)) {
      return
    }
    const now = Date.now()
    if (now - this.lastDrainStartedAt < HOME_LOAD_MORE_DRAIN_START_COOLDOWN_MS) {
      return
    }
    this.lastDrainStartedAt = now
    this.drainToken += 1
    this.drainingMode = mode
    this.stuckRetryCount = 0
    const token = this.drainToken
    this.actions.logHomeLoadMore(`drain start mode=${mode} total=${totalCount}`)
    this.scheduleStep(mode, token)
  }

  private shouldStart(mode: SubscriptionMode, totalCount: number): boolean {
    if (this.drainingMode === mode || this.state.homeLoadMoreInProgress || this.owner.pendingLoadMoreForMode(mode)) {
      return false
    }
    return this.canRun(mode, totalCount)
  }

  private canRun(mode: SubscriptionMode, totalCount: number): boolean {
    return this.guard.canDrain(mode, totalCount)
  }

  private scheduleStep(mode: SubscriptionMode, token: number): void {
    this.actions.runManagedTimeout(() => {
      this.step(mode, token, 0)
    }, 0)
  }

  private step(mode: SubscriptionMode, token: number, attempt: number): void {
    if (token !== this.drainToken) {
      return
    }
    if (!this.canRun(mode, 1)) {
      this.finish(mode, `drain stop mode=${mode} reason=inactive-or-exhausted`)
      return
    }
    if (
      this.state.homeScrollIntent.isInteracting
      || this.state.homeLoadMoreInProgress
      || this.owner.pendingLoadMoreForMode(mode)
    ) {
      this.actions.runManagedTimeout(() => {
        this.step(mode, token, attempt + 1)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    const handled = this.owner.requestLoadMoreForMode(mode, true)
    if (!handled) {
      if (this.stuckRetryCount >= 3) {
        this.finish(mode, `drain stuck-bottom-exhausted mode=${mode} attempts=${attempt + 1}`)
        return
      }
      this.stuckRetryCount += 1
      this.actions.runManagedTimeout(() => {
        this.step(mode, token, attempt + 1)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    this.finish(mode, `drain page-done mode=${mode} attempts=${attempt + 1} stuckRetries=${this.stuckRetryCount}`)
  }

  private finish(mode: SubscriptionMode, message: string): void {
    if (this.drainingMode === mode) {
      this.drainingMode = ''
    }
    this.actions.logHomeLoadMore(message)
  }
}