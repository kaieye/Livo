import window from '@ohos.window'
import { SettingsStore } from '../../services/SettingsStore'
import {
  AUTO_REFRESH_MIN_INTERVAL_MINUTES,
  SubscriptionMode,
} from '../../components/HomeRootConfig'
import { DEFAULT_HARMONY_SETTINGS, EntryCardModel, HarmonySettings } from '../../models/LivoModels'
import { ThemePalette, ThemeService } from '../../services/ThemeService'
import { resolveSystemBarStyle } from '../SystemBarStyle'
import { shouldRefreshThemeOnSystemColorModeChange } from '../ThemeRefresh'

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
  theme: ThemePalette
  rootSettings: HarmonySettings

  logHomePerf(message: string): void
  syncRequestedRootTab(): void
  resumeLoadedHome(): void
  loadInitialData(): Promise<void>
  invalidateHomeLoadMorePrefetch(): void
  persistHomeSnapshotNow(): void
  clearRefreshPercentAnimation(): void
  refreshFeaturedEntries(showResultToast: boolean): Promise<void>
  logHomeAsyncError(stage: string, error: Error | string | Object): void
}

export class IndexHomeRuntimeCoordinator {
  private readonly owner: IndexHomeRuntimeOwner
  private managedTimeoutIds: number[] = []
  private autoRefreshTimer: number = -1

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
    this.clearAutoRefreshTimer()
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

  async applySystemBarStyle(theme: ThemePalette): Promise<void> {
    const mainWindow = AppStorage.get<window.Window>('WindowClass')
    if (!mainWindow) {
      return
    }

    try {
      const systemBarStyle = resolveSystemBarStyle(theme)
      await mainWindow.setWindowSystemBarProperties({
        statusBarColor: systemBarStyle.statusBarColor,
        navigationBarColor: systemBarStyle.navigationBarColor,
        isStatusBarLightIcon: systemBarStyle.isStatusBarLightIcon,
        statusBarContentColor: systemBarStyle.statusBarContentColor,
      })
    } catch (_) {
    }
  }

  async handleSystemThemeChanged(): Promise<void> {
    const settings = await SettingsStore.load()
    if (!shouldRefreshThemeOnSystemColorModeChange(settings.themeMode)) {
      return
    }

    this.owner.theme = await ThemeService.resolvePaletteForSystemChange(settings)
    void this.applySystemBarStyle(this.owner.theme)
  }

  clearAutoRefreshTimer(): void {
    if (this.autoRefreshTimer < 0) {
      return
    }
    clearInterval(this.autoRefreshTimer)
    this.autoRefreshTimer = -1
  }

  configureAutoRefreshTimer(): void {
    this.clearAutoRefreshTimer()
    if (!this.owner.rootSettings.autoRefresh) {
      return
    }
    const intervalMs = this.autoRefreshIntervalMs()
    this.autoRefreshTimer = setInterval(() => {
      void this.owner.refreshFeaturedEntries(false)
    }, intervalMs)
  }

  private autoRefreshIntervalMs(): number {
    const configuredMinutes = Number(this.owner.rootSettings.refreshIntervalMinutes)
    const normalizedMinutes = Number.isFinite(configuredMinutes) && configuredMinutes > 0
      ? configuredMinutes
      : DEFAULT_HARMONY_SETTINGS.refreshIntervalMinutes
    const safeMinutes = Math.max(AUTO_REFRESH_MIN_INTERVAL_MINUTES, Math.floor(normalizedMinutes))
    return safeMinutes * 60 * 1000
  }
}
