import { openArticleDetail, RootTabId } from '../../navigation/AppRouter'
import { articleDetailModelFromCard, EntryCardModel, HarmonySettings } from '../../models/LivoModels'
import { ThemePalette } from '../../services/ThemeService'
import { HomeEntryDataManager } from '../home/HomeEntryDataManager'
import { HomeInlineSearchController } from '../home/HomeInlineSearchController'

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
    const storedSheet = AppStorage.get<string>('settingsActiveSheetKey')
    if (!storedSheet) {
      return
    }
    // 通过短暂清空再恢复来触发 @Watch，让 SettingsContent 重新打开 sheet
    AppStorage.setOrCreate('settingsActiveSheetKey', '')
    AppStorage.setOrCreate('settingsActiveSheetKey', storedSheet)
  }

  onBackPress(): boolean {
    if (this.owner.currentRootTabId() === 'discover' && this.owner.discoverOverlayLevel > 0) {
      AppStorage.setOrCreate('discoverOverlayBackAt', Date.now())
      return true
    }
    if (this.owner.currentRootTabId() === 'subscriptions') {
      const subscriptionsOverlayLevel = AppStorage.get<number>('subscriptionsOverlayLevel') ?? 0
      if (subscriptionsOverlayLevel > 0) {
        AppStorage.setOrCreate('subscriptionsOverlayBackAt', Date.now())
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
