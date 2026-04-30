export interface RefreshPercentAnimationPlan {
  startPercent: number
  targetPercent: number
  steps: number
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
}
