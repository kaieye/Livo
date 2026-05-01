import { EntryCardModel } from '../models/LivoModels'
import { SubscriptionMode } from '../components/HomeRootConfig'

export interface IndexHomeRuntimeOwner {
  isComponentActive: boolean
  homePerfSessionId: number
  homePerfSessionStartedAt: number
  mode: SubscriptionMode
  featuredEntries: EntryCardModel[]
  hasLoadedInitialData: boolean
  homePostRefreshReloadPending: boolean
  homeListSwapToken: number
  homeListSwapAnimating: boolean
  homeListSwapOpacity: number
  homeListSwapTranslateY: number
  homeListSwapScale: number

  logHomePerf(message: string): void
  syncRequestedRootTab(): void
  resumeLoadedHome(): void
  loadInitialData(): Promise<void>
  invalidateHomeLoadMorePrefetch(): void
  persistHomeSnapshotNow(): void
  clearRefreshPercentAnimation(): void
  clearAutoRefreshTimer(): void
  logHomeAsyncError(stage: string, error: Error | string | Object): void
}

export class IndexHomeRuntimeCoordinator {
  private readonly owner: IndexHomeRuntimeOwner
  private managedTimeoutIds: number[] = []

  constructor(owner: IndexHomeRuntimeOwner) {
    this.owner = owner
  }

  aboutToAppear(): void {
    this.owner.isComponentActive = true
    this.owner.homePerfSessionId += 1
    this.owner.homePerfSessionStartedAt = Date.now()
    console.info('Livo Harmony Index aboutToAppear')
    this.owner.logHomePerf(
      `aboutToAppear mode=${this.owner.mode} featured=${this.owner.featuredEntries.length}`,
    )
    this.owner.syncRequestedRootTab()
    if (this.owner.hasLoadedInitialData) {
      this.owner.resumeLoadedHome()
      return
    }
    void this.owner.loadInitialData()
  }

  aboutToDisappear(): void {
    this.owner.isComponentActive = false
    this.owner.invalidateHomeLoadMorePrefetch()
    this.owner.persistHomeSnapshotNow()
    this.owner.clearRefreshPercentAnimation()
    this.owner.clearAutoRefreshTimer()
    this.clearManagedTimeouts()
    this.owner.homePostRefreshReloadPending = false
    this.owner.homeListSwapToken += 1
    this.owner.homeListSwapAnimating = false
    this.owner.homeListSwapOpacity = 1
    this.owner.homeListSwapTranslateY = 0
    this.owner.homeListSwapScale = 1
  }

  runManagedTimeout(callback: () => void, delayMs: number): void {
    const timeoutId = setTimeout(() => {
      const pendingIndex = this.managedTimeoutIds.indexOf(timeoutId)
      if (pendingIndex >= 0) {
        this.managedTimeoutIds.splice(pendingIndex, 1)
      }
      if (!this.owner.isComponentActive) {
        return
      }
      try {
        callback()
      } catch (error) {
        this.owner.logHomeAsyncError(`managed-timeout delayMs=${delayMs}`, error)
      }
    }, delayMs)
    this.managedTimeoutIds.push(timeoutId)
  }

  clearManagedTimeouts(): void {
    this.managedTimeoutIds.forEach((timeoutId: number) => {
      clearTimeout(timeoutId)
    })
    this.managedTimeoutIds = []
  }
}
