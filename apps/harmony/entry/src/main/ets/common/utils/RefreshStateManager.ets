export interface RefreshPercentAnimationPlan {
  startPercent: number
  targetPercent: number
  steps: number
}

export interface HomeRefreshGapInput {
  shouldShowGap: boolean
  indicatorOffset: number
  contentHoldOffset: number
  gapOpenPullDistance: number
  followRatio: number
  visualOffset: number
}

export class RefreshStateManager {
  static clampPercent(value: number): number {
    return Math.min(100, Math.max(0, Math.round(value)))
  }

  static resolveRefreshPercent(completedCount: number, totalCount: number): number {
    if (totalCount <= 0) {
      return 0
    }

    return RefreshStateManager.clampPercent((completedCount / totalCount) * 100)
  }

  static createPercentAnimationPlan(currentPercent: number, targetPercent: number): RefreshPercentAnimationPlan {
    const startPercent = RefreshStateManager.clampPercent(currentPercent)
    const nextTarget = RefreshStateManager.clampPercent(targetPercent)
    const steps = Math.max(4, Math.min(10, Math.abs(nextTarget - startPercent)))
    return {
      startPercent,
      targetPercent: nextTarget,
      steps,
    }
  }

  static resolvePullDistance(nextOffset: number, maxPullDistance: number): number {
    return Math.max(0, Math.min(nextOffset, maxPullDistance))
  }

  static resolveIndicatorProgress(indicatorOffset: number, pullDistance: number): number {
    if (pullDistance <= 0) {
      return 0
    }

    return Math.max(0, Math.min(indicatorOffset / pullDistance, 1))
  }

  static resolveGapHeight(input: HomeRefreshGapInput): number {
    if (!input.shouldShowGap) {
      return 0
    }

    const indicatorHeight = 18 + 10 * 2
    const expandedGapHeight = indicatorHeight + input.visualOffset
    const dragGapHeight = Math.max(0, input.indicatorOffset - input.gapOpenPullDistance) * input.followRatio
    return Math.max(0, Math.min(Math.max(dragGapHeight, input.contentHoldOffset), expandedGapHeight))
  }

  static resolveIndicatorOpacity(isRefreshing: boolean, isRefreshStatusActive: boolean, progress: number): number {
    if (isRefreshing || isRefreshStatusActive) {
      return 1
    }
    return progress
  }

  static resolveIndicatorScale(progress: number): number {
    return 0.84 + progress * 0.16
  }
}
