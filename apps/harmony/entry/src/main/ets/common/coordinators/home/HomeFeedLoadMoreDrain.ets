import {
  HOME_LOAD_MORE_SCROLL_QUIESCENT_MS,
  SubscriptionMode,
} from '../../config/HomeRootConfig'
import { HomeFeedState, HomeFeedActions } from './HomeFeedSessionOwner'
import { HomeFeedGuard, HomeFeedGuardProvider } from './HomeFeedGuard'
import { writeHomeLoadMoreInProgress } from '../index-home/HomeChromeProgressStore'

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
  // 是否已经"预亮"了 footer。drain 在 onReachEnd 触发瞬间立刻把 AppStorage 的
  // HOME_LOAD_MORE_IN_PROGRESS_KEY 置 true 让 LoadMoreFooterSlot 显示 spinner,
  // 但 requestLoadMoreForMode 的实际调用要等 fling 完全停下再进行,避免同步
  // 工作（visibleLimit 增长 + LazyForEach 增量通知）在 fling 帧里阻塞主线程
  // 引发"卡在最后一条一小部分"。如果 drain 最终没真正 dispatch request,
  // 需要把这次"预亮"清掉。
  private footerHinted: boolean = false

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
    // 立即点亮 footer:LoadMoreFooterSlot 已经常驻列表末尾,这里只切换 Visibility。
    // 实际的 requestLoadMoreForMode 调用要等 fling 完全停下再进行(见 step)。
    // 写 AppStorage 不动 state.homeLoadMoreInProgress,后者仍由 requestLoadMoreForMode
    // 在真正发起请求时设置,保留它作为内部去重信号的原语义。
    if (!this.footerHinted) {
      this.footerHinted = true
      writeHomeLoadMoreInProgress(true)
    }
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
      this.finish(mode, `drain stop mode=${mode} reason=inactive-or-exhausted`, true)
      return
    }
    // 等用户停止 fling 才发起请求:isInteracting 在 DRAG 时为 true,但 FLING
    // 期间为 false,所以单看 isInteracting 不够。lastUserScrollAt 在 fling 期间
    // 每帧 onWillScroll 都会刷新,只在彻底静止后才停滞;此处用「最近 QUIESCENT_MS
    // 没有滚动事件」作为「fling 已结束」的近似判据。否则同步执行 requestLoadMore
    // 内的 visibleLimit 增长 + LazyForEach 增量通知会阻塞主线程,把 fling 帧
    // abort 掉(用户感受为「滑到一半被强制停下」)。
    const sinceLastScroll = Date.now() - this.state.homeScrollIntent.lastUserScrollAt
    if (
      this.state.homeScrollIntent.isInteracting
      || sinceLastScroll < HOME_LOAD_MORE_SCROLL_QUIESCENT_MS
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
        this.finish(mode, `drain stuck-bottom-exhausted mode=${mode} attempts=${attempt + 1}`, true)
        return
      }
      this.stuckRetryCount += 1
      this.actions.runManagedTimeout(() => {
        this.step(mode, token, attempt + 1)
      }, HOME_LOAD_MORE_DRAIN_RETRY_DELAY_MS)
      return
    }

    // request 已接管 footer 生命周期(包含 FOOTER_MIN_VISIBLE_MS 的兜底显示
    // 时长),drain 不再负责清理。
    this.finish(mode, `drain page-done mode=${mode} attempts=${attempt + 1} stuckRetries=${this.stuckRetryCount}`, false)
  }

  private finish(mode: SubscriptionMode, message: string, clearHintedFooter: boolean): void {
    if (this.drainingMode === mode) {
      this.drainingMode = ''
    }
    if (clearHintedFooter && this.footerHinted) {
      // drain 自己放弃(没有 dispatch request),需要把预亮的 footer 还原,
      // 否则 spinner 会一直转。
      writeHomeLoadMoreInProgress(false)
    }
    this.footerHinted = false
    this.actions.logHomeLoadMore(message)
  }
}