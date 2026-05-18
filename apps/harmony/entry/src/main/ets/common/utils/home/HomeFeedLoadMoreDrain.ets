import { SubscriptionMode } from '../../components/HomeRootConfig'
import { HomeFeedSessionOwner } from './HomeFeedSessionOwner'

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
  private readonly session: HomeFeedSessionOwner
  private readonly owner: HomeFeedLoadMoreDrainPaginationOwner
  private drainToken: number = 0
  private drainingMode: SubscriptionMode | '' = ''
  private stuckRetryCount: number = 0
  private lastDrainStartedAt: number = 0

  constructor(session: HomeFeedSessionOwner, owner: HomeFeedLoadMoreDrainPaginationOwner) {
    this.session = session
    this.owner = owner
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
    this.session.logHomeLoadMore(`drain start mode=${mode} total=${totalCount}`)
    this.scheduleStep(mode, token)
  }

  private shouldStart(mode: SubscriptionMode, totalCount: number): boolean {
    if (this.drainingMode === mode || this.session.homeLoadMoreInProgress || this.owner.pendingLoadMoreForMode(mode)) {
      return false
    }
    return this.canRun(mode, totalCount)
  }

  private canRun(mode: SubscriptionMode, totalCount: number): boolean {
    if (totalCount <= 0) {
      return false
    }
    if (!this.session.isComponentActive || !this.session.isHomeRootTab()) {
      return false
    }
    if (mode !== this.session.mode) {
      return false
    }
    if (this.session.searchOverlayVisible || this.session.hasHomeInlineSearchQuery()) {
      return false
    }
    if (!this.owner.hasBufferedEntriesForMode(mode) && !this.owner.modeHasMoreEntries(mode)) {
      return false
    }
    return true
  }

  private scheduleStep(mode: SubscriptionMode, token: number): void {
    this.session.runManagedTimeout(() => {
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
      this.session.homeScrollIntent.isInteracting
      || this.session.homeLoadMoreInProgress
      || this.owner.pendingLoadMoreForMode(mode)
    ) {
      this.session.runManagedTimeout(() => {
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
      this.session.runManagedTimeout(() => {
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
    this.session.logHomeLoadMore(message)
  }
}
