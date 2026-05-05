import { SubscriptionMode } from '../components/HomeRootConfig'
import { HomeFeedSessionOwner } from './HomeFeedSessionOwner'

export interface HomeFeedLoadMoreDrainPaginationOwner {
  pendingLoadMoreForMode(mode: SubscriptionMode): boolean
  hasBufferedEntriesForMode(mode: SubscriptionMode): boolean
  modeHasMoreEntries(mode: SubscriptionMode): boolean
  requestLoadMoreForMode(mode: SubscriptionMode): boolean
}

const HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS: number = 90
const HOME_LOAD_MORE_DRAIN_NEXT_STEP_DELAY_MS: number = 32

// 用户抵达底部后，持续拉取并展开当前栏目剩余内容，直到该栏目彻底耗尽。
export class HomeFeedLoadMoreDrain {
  private readonly session: HomeFeedSessionOwner
  private readonly owner: HomeFeedLoadMoreDrainPaginationOwner
  private drainToken: number = 0
  private drainingMode: SubscriptionMode | '' = ''

  constructor(session: HomeFeedSessionOwner, owner: HomeFeedLoadMoreDrainPaginationOwner) {
    this.session = session
    this.owner = owner
  }

  handleListEndReach(mode: SubscriptionMode, totalCount: number): void {
    if (!this.shouldStart(mode, totalCount)) {
      return
    }
    this.drainToken += 1
    this.drainingMode = mode
    const token = this.drainToken
    this.session.logHomeLoadMore(`drain start mode=${mode} total=${totalCount}`)
    this.scheduleStep(mode, token, 0)
  }

  private shouldStart(mode: SubscriptionMode, totalCount: number): boolean {
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
    return this.drainingMode === mode || this.session.hasRecentHomeScrollIntent()
  }

  private scheduleStep(mode: SubscriptionMode, token: number, attempt: number): void {
    const delayMs = attempt <= 0 ? 0 : HOME_LOAD_MORE_DRAIN_NEXT_STEP_DELAY_MS
    this.session.runManagedTimeout(() => {
      this.step(mode, token, attempt)
    }, delayMs)
  }

  private step(mode: SubscriptionMode, token: number, attempt: number): void {
    if (token !== this.drainToken) {
      return
    }
    if (!this.shouldStart(mode, 1)) {
      if (this.drainingMode === mode) {
        this.drainingMode = ''
      }
      this.session.logHomeLoadMore(`drain stop mode=${mode} reason=inactive-or-exhausted`)
      return
    }
    if (this.session.homeLoadMoreInProgress || this.owner.pendingLoadMoreForMode(mode)) {
      this.session.runManagedTimeout(() => {
        this.step(mode, token, attempt + 1)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    const handled = this.owner.requestLoadMoreForMode(mode)
    if (!handled) {
      this.session.runManagedTimeout(() => {
        this.step(mode, token, attempt + 1)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    if (!this.owner.hasBufferedEntriesForMode(mode) && !this.owner.modeHasMoreEntries(mode)) {
      if (this.drainingMode === mode) {
        this.drainingMode = ''
      }
      this.session.logHomeLoadMore(`drain done mode=${mode} attempts=${attempt + 1}`)
      return
    }
    this.scheduleStep(mode, token, attempt + 1)
  }
}
