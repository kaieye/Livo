import { openArticleDetail, RootTabId } from '../../navigation/AppRouter'
import { articleDetailModelFromCard, EntryCardModel, HarmonySettings } from '../../models/LivoModels'
import { ThemePalette } from '../../services/ThemeService'
import { HomeEntryDataManager } from '../../coordinators/home/HomeEntryDataManager'
import { HomeInlineSearchController } from '../../coordinators/home/HomeInlineSearchController'
import {
  settingsActiveSheet,
  subscriptionsOverlayLevel as subscriptionsOverlayLevelSignal,
  discoverOverlayBackAt,
  subscriptionsOverlayBackAt,
} from '../../utils/AppSignals'

export interface IndexPageLifecycleOwner {
  rootSettings: HarmonySettings
  theme: ThemePalette
  discoverOverlayLevel: number
  searchOverlayVisible: boolean
  homeInlineSearchController: HomeInlineSearchController
  homeEntryDataManager: HomeEntryDataManager

  currentRootTabId(): RootTabId
  isHomeRootTab(): boolean
  syncRequestedRootTab(): void
  configureAutoRefreshTimer(): void
  refreshFeaturedEntries(showResultToast?: boolean): Promise<void>
  applySystemBarStyle(theme: ThemePalette): Promise<void>
  runManagedTimeout(callback: () => void, delayMs: number): void
}

export class IndexPageLifecycleController {
  private readonly owner: IndexPageLifecycleOwner

  constructor(owner: IndexPageLifecycleOwner) {
    this.owner = owner
  }

  onPageShow(): void {
    console.info('Livo Harmony Index onPageShow')
    this.owner.syncRequestedRootTab()
    this.restoreSettingsSheetIfNeeded()
  }

  private restoreSettingsSheetIfNeeded(): void {
    const storedSheet = settingsActiveSheet.read()
    if (!storedSheet) {
      return
    }
    settingsActiveSheet.write('')
    settingsActiveSheet.write(storedSheet)
  }

  onBackPress(): boolean {
    if (this.owner.currentRootTabId() === 'discover' && this.owner.discoverOverlayLevel > 0) {
      discoverOverlayBackAt.write(Date.now())
      return true
    }
    if (this.owner.currentRootTabId() === 'subscriptions') {
      const subscriptionsOverlayLevel = subscriptionsOverlayLevelSignal.read()
      if (subscriptionsOverlayLevel > 0) {
        subscriptionsOverlayBackAt.write(Date.now())
        return true
      }
    }
    if (this.owner.isHomeRootTab() && this.owner.searchOverlayVisible) {
      this.owner.homeInlineSearchController.close(true)
      return true
    }
    return false
  }

  handleRootSettingsChange(settings: HarmonySettings): void {
    const previousSettings = this.owner.rootSettings
    this.owner.rootSettings = settings
    this.owner.configureAutoRefreshTimer()
    if (
      settings.autoRefresh
      && (!previousSettings.autoRefresh
        || previousSettings.refreshIntervalMinutes !== settings.refreshIntervalMinutes)
    ) {
      void this.owner.refreshFeaturedEntries(false)
    }
  }

  handleRootThemeChange(theme: ThemePalette): void {
    this.owner.theme = theme
    void this.owner.applySystemBarStyle(theme)
  }

  openEntry(entry: EntryCardModel): void {
    this.owner.runManagedTimeout(() => {
      this.owner.homeEntryDataManager.markEntryReadLocally(entry)
    }, 120)

    const model = articleDetailModelFromCard(entry)
    void openArticleDetail(entry.id, JSON.stringify(model))
  }
}
