import {
  ROOT_MODE_RAIL_TOP_GAP,
} from '../../components/FloatingRootPageLayout'
import {
  HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT,
  HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA,
  HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET,
  HOME_COLLAPSED_MODE_RAIL_TOP_PADDING,
  HOME_MODE_CONTENT_TOP_SPACER_HEIGHT,
  HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL,
  HOME_MODE_SCENE_TOP_INSET,
  HomeModeScrollOffsetMap,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import { PAGE_HORIZONTAL_PADDING } from '../../ui/UiTokens'
import {
  createHomeScrollOffsetMap,
  perModeGet,
} from '../home/HomeModeMapHelpers'

export interface IndexHomeRailOwner {
  mode: SubscriptionMode
  currentHomeModeScrollOffset: number
  homeModeRailCollapseReady: boolean
  homeModeRailDismissedByScroll: boolean
  homeModeRailDismissProgress: number
  homeModeRailExpandedOverride: boolean
  homeModeRailExpandedLockOffset: number
  homeScrollerForMode(mode: SubscriptionMode): Scroller
  updateHeaderBlurProgress(offset: number): void
  maybeTriggerLoadMoreByScrollProgress(mode: SubscriptionMode, currentOffset: number): void
  animateModeRailDismiss(show: boolean): void
  resetModeRailProgress(): void
}

export class IndexHomeRailCoordinator {
  private readonly owner: IndexHomeRailOwner
  private readonly homeModeScrollOffsets: HomeModeScrollOffsetMap = createHomeScrollOffsetMap()

  constructor(owner: IndexHomeRailOwner) {
    this.owner = owner
  }

  private homeModeScrollOffsetFor(mode: SubscriptionMode): number {
    return perModeGet(mode, this.homeModeScrollOffsets)
  }

  private updateHomeModeScrollOffset(mode: SubscriptionMode, offset: number): void {
    switch (mode) {
      case 'social':
        this.homeModeScrollOffsets.social = offset
        break
      case 'pictures':
        this.homeModeScrollOffsets.pictures = offset
        break
      case 'videos':
        this.homeModeScrollOffsets.videos = offset
        break
      default:
        this.homeModeScrollOffsets.articles = offset
        break
    }
  }

  readHomeModeScrollOffset(mode: SubscriptionMode): number {
    try {
      return Math.max(0, this.owner.homeScrollerForMode(mode).currentOffset().yOffset)
    } catch (_) {
      return this.homeModeScrollOffsetFor(mode)
    }
  }

  // 折叠"准备态"由 firstCardTopBoundary <= modeRailTopBoundary 决定。这是个布尔
  // 阈值,滚动期间只在跨越阈值的瞬间翻转,因此独立成 @State,而连续变化的 offset
  // 本身保持为普通字段,不再参与 ArkUI 反应链。
  private computeCollapseReady(offset: number): boolean {
    return HOME_MODE_SCENE_TOP_INSET - offset <= HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
  }

  private updateCollapseReadySnapshot(offset: number): void {
    const next = this.computeCollapseReady(offset)
    if (next !== this.owner.homeModeRailCollapseReady) {
      this.owner.homeModeRailCollapseReady = next
    }
  }

  syncHomeModeRailState(mode: SubscriptionMode = this.owner.mode): void {
    const previousOffset = this.owner.currentHomeModeScrollOffset
    const nextOffset = this.readHomeModeScrollOffset(mode)
    this.updateHomeModeScrollOffset(mode, nextOffset)
    if (mode !== this.owner.mode) {
      return
    }

    const isReturningTowardsTop = nextOffset + 0.5 < previousOffset
    const isScrollingDeeper = nextOffset > previousOffset + 0.5
    // 当滚动距离在 0.5px 抖动以内时，跳过 @State 写入：避免 fling 期间每帧都触发
    // Index 重建。仍然让 maybeTriggerLoadMoreByScrollProgress 收到 nextOffset，
    // 因为它内部会按 offset 增量去重。
    const offsetEffectivelyUnchanged = !isReturningTowardsTop && !isScrollingDeeper

    // 模式切换后的"强制展开"覆盖态：用户再次向下滚动时解除
    if (this.owner.homeModeRailExpandedOverride && isScrollingDeeper) {
      this.owner.homeModeRailExpandedOverride = false
      this.owner.homeModeRailExpandedLockOffset = -1
    }

    if (!offsetEffectivelyUnchanged) {
      this.owner.currentHomeModeScrollOffset = nextOffset
      this.owner.updateHeaderBlurProgress(nextOffset)
      this.updateCollapseReadySnapshot(nextOffset)
    }
    this.owner.maybeTriggerLoadMoreByScrollProgress(mode, nextOffset)
  }

  requestExpandedModeRail(): void {
    this.owner.homeModeRailExpandedLockOffset = this.readHomeModeScrollOffset(this.owner.mode)
    this.owner.homeModeRailExpandedOverride = true
    this.owner.resetModeRailProgress()
    this.owner.currentHomeModeScrollOffset = this.owner.homeModeRailExpandedLockOffset
    this.owner.updateHeaderBlurProgress(this.owner.homeModeRailExpandedLockOffset)
    this.updateCollapseReadySnapshot(this.owner.homeModeRailExpandedLockOffset)
  }

  primeHomeModeRailForRootActivation(): void {
    this.owner.homeModeRailExpandedOverride = false
    this.owner.homeModeRailExpandedLockOffset = -1
    this.owner.resetModeRailProgress()
    this.owner.currentHomeModeScrollOffset = 0
    this.owner.updateHeaderBlurProgress(0)
    this.updateCollapseReadySnapshot(0)
  }

  homeFirstCardTopBoundary(): number {
    return HOME_MODE_SCENE_TOP_INSET - this.owner.currentHomeModeScrollOffset
  }

  homeModeRailTopBoundary(): number {
    return HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
  }

  homeModeRailCollapseReady(): boolean {
    // 读 owner 的 @State 快照,而不是用 firstCardTopBoundary 重新计算;
    // 让 build 路径只依赖布尔状态,不再依赖每帧变化的 offset。
    return this.owner.homeModeRailCollapseReady
  }

  homeModeRailCollapseProgress(): number {
    if (this.owner.homeModeRailExpandedOverride) {
      return 0
    }

    if (!this.homeModeRailCollapseReady()) {
      return 0
    }

    return this.owner.homeModeRailDismissProgress
  }

  isHomeModeRailCollapsed(): boolean {
    return this.homeModeRailCollapseProgress() >= 1
  }

  resolvedHomeCollapsedModeRailTopAvoidArea(): number {
    return HOME_COLLAPSED_MODE_RAIL_FALLBACK_TOP_AVOID_AREA
  }

  homeCollapsedModeRailTopPadding(): number {
    return this.resolvedHomeCollapsedModeRailTopAvoidArea()
      + HOME_COLLAPSED_MODE_RAIL_TOP_PADDING
      + HOME_COLLAPSED_MODE_RAIL_BASE_ADJUSTMENT
      - ROOT_MODE_RAIL_TOP_GAP
      + HOME_COLLAPSED_MODE_RAIL_TOP_OFFSET
  }

  homeModeRailRightInset(): number {
    return PAGE_HORIZONTAL_PADDING
  }

  homeModeRailLeftPadding(): number {
    return PAGE_HORIZONTAL_PADDING
  }

  homeModeRailTopPadding(): number {
    const progress = this.homeModeRailCollapseProgress()
    const interpolatedTopPadding = HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
      + (this.homeCollapsedModeRailTopPadding() - HOME_MODE_CONTENT_TOP_SPACER_HEIGHT) * progress
    // 折叠时保持 rail 位于首页标题区下方，避免滚动中和标题重叠。
    return Math.max(HOME_MODE_CONTENT_TOP_SPACER_HEIGHT, interpolatedTopPadding)
  }

  homeModeRailDismissTranslateY(): number {
    return -1 * HOME_MODE_RAIL_COLLAPSE_DISMISS_TRAVEL * this.homeModeRailCollapseProgress()
  }

  homeModeRailDismissOpacity(): number {
    const progress = this.homeModeRailCollapseProgress()
    return Math.max(0, 1 - progress)
  }

  homeModeRailDismissScale(): number {
    const progress = this.homeModeRailCollapseProgress()
    return 1 - (progress * 0.12)
  }
}
