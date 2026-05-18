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
  HOME_MODE_RAIL_COLLAPSE_OFFSET,
  HOME_MODE_SCENE_TOP_INSET,
  HomeModeScrollOffsetMap,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import { PAGE_HORIZONTAL_PADDING } from '../../ui/UiTokens'
import {
  createHomeScrollOffsetMap,
  homeModeNumberValue,
} from '../home/HomeModeMapHelpers'

export interface IndexHomeRailOwner {
  mode: SubscriptionMode
  currentHomeModeScrollOffset: number
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
  private lastRailShownAt: number = 0

  constructor(owner: IndexHomeRailOwner) {
    this.owner = owner
  }

  private homeModeScrollOffsetFor(mode: SubscriptionMode): number {
    return homeModeNumberValue(mode, this.homeModeScrollOffsets)
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

    if (this.owner.homeModeRailExpandedOverride) {
      if (!isScrollingDeeper) {
        if (!offsetEffectivelyUnchanged) {
          this.owner.currentHomeModeScrollOffset = nextOffset
          this.owner.updateHeaderBlurProgress(nextOffset)
        }
        this.owner.maybeTriggerLoadMoreByScrollProgress(mode, nextOffset)
        return
      }

      this.owner.homeModeRailExpandedOverride = false
      this.owner.homeModeRailExpandedLockOffset = -1
    }

    if (isReturningTowardsTop) {
      if (this.owner.homeModeRailDismissedByScroll) {
        this.owner.animateModeRailDismiss(true)
        this.lastRailShownAt = Date.now()
      }
    } else if (isScrollingDeeper && nextOffset >= HOME_MODE_RAIL_COLLAPSE_OFFSET) {
      if (!this.owner.homeModeRailDismissedByScroll) {
        const hysteresisElapsed = Date.now() - this.lastRailShownAt
        // 迟滞保护：rail 刚显示后 200ms 内，不允许因微小抖动立即重新隐藏
        if (hysteresisElapsed < 200) {
          // 仍然更新偏移量，仅跳过隐藏动画
        } else {
          this.owner.animateModeRailDismiss(false)
        }
      }
    }

    if (!offsetEffectivelyUnchanged) {
      this.owner.currentHomeModeScrollOffset = nextOffset
      this.owner.updateHeaderBlurProgress(nextOffset)
    }
    this.owner.maybeTriggerLoadMoreByScrollProgress(mode, nextOffset)
  }

  requestExpandedModeRail(): void {
    this.owner.homeModeRailExpandedLockOffset = this.readHomeModeScrollOffset(this.owner.mode)
    this.owner.homeModeRailExpandedOverride = true
    this.owner.resetModeRailProgress()
    this.owner.currentHomeModeScrollOffset = this.owner.homeModeRailExpandedLockOffset
    this.owner.updateHeaderBlurProgress(this.owner.homeModeRailExpandedLockOffset)
  }

  primeHomeModeRailForRootActivation(): void {
    this.owner.homeModeRailExpandedOverride = false
    this.owner.homeModeRailExpandedLockOffset = -1
    this.owner.resetModeRailProgress()
    this.owner.currentHomeModeScrollOffset = 0
    this.owner.updateHeaderBlurProgress(0)
  }

  homeFirstCardTopBoundary(): number {
    return HOME_MODE_SCENE_TOP_INSET - this.owner.currentHomeModeScrollOffset
  }

  homeModeRailTopBoundary(): number {
    return HOME_MODE_CONTENT_TOP_SPACER_HEIGHT
  }

  homeModeRailCollapseReady(): boolean {
    return this.homeFirstCardTopBoundary() <= this.homeModeRailTopBoundary()
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
