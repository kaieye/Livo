import { ThemePalette, ThemeService } from '../services/ThemeService'
import { loadThemeForComponent } from '../utils/PageThemeHelper'
import { showToast, TOAST_DURATION_DEFAULT } from '../utils/PageToastHelper'
import {
  OPML_IMPORT_AUTO_REFRESH_LIMIT,
  OPML_IMPORT_LARGE_BATCH_HINT,
  SubscriptionOpmlExportResult,
  SubscriptionOpmlImportMode,
  SubscriptionOpmlImportResult,
  SubscriptionOpmlRefreshResult,
  SubscriptionOpmlService,
} from '../services/SubscriptionOpmlService'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  PANEL_SECTION_SPACING,
  SettingsPanelSheetHandle,
  SettingsPanelTitle,
} from './SettingsPanelShared'

@Component
export struct SubscriptionsSettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State isOpmlProcessing: boolean = false
  @Prop useInheritedTheme: boolean = false
  @Prop inheritedTheme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    if (this.useInheritedTheme) {
      this.theme = this.inheritedTheme
      return
    }
    void this.loadTheme()
  }

  private async loadTheme(): Promise<void> {
    this.theme = await loadThemeForComponent()
  }

  private showToast(message: string, duration: number = TOAST_DURATION_DEFAULT): void {
    showToast(this.getUIContext(), message, duration)
  }

  private async exportOpmlToFile(): Promise<void> {
    if (this.isOpmlProcessing) {
      return
    }
    this.isOpmlProcessing = true
    try {
      const result = await SubscriptionOpmlService.exportToFile()
      this.handleExportResult(result)
    } catch (error) {
      this.showToast(`导出失败：${error instanceof Error ? error.message : String(error)}`, 3000)
    } finally {
      this.isOpmlProcessing = false
    }
  }

  private handleExportResult(result: SubscriptionOpmlExportResult): void {
    if (result.status === 'cancelled') {
      this.showToast('已取消导出')
      return
    }
    this.showToast(`导出完成，共 ${result.feedCount} 条`)
  }

  private async importOpmlFromFile(mode: SubscriptionOpmlImportMode): Promise<void> {
    if (this.isOpmlProcessing) {
      return
    }
    this.isOpmlProcessing = true
    try {
      const result = await SubscriptionOpmlService.importFromFile(mode)
      this.handleImportResult(result)
    } catch (error) {
      this.showToast(`导入失败：${error instanceof Error ? error.message : String(error)}`, 3200)
    } finally {
      this.isOpmlProcessing = false
    }
  }

  private handleImportResult(result: SubscriptionOpmlImportResult): void {
    if (result.status === 'cancelled') {
      this.showToast('已取消导入')
      return
    }
    if (result.status === 'empty') {
      this.showToast('OPML 文件中未发现可导入订阅', 3000)
      return
    }

    this.showToast(`导入完成：新增 ${result.imported}，跳过 ${result.skipped}，失败 ${result.failed}`, 3200)
    if (result.importedFeedIds.length === 0) {
      return
    }

    if (result.importedFeedIds.length > OPML_IMPORT_AUTO_REFRESH_LIMIT) {
      this.showToast(OPML_IMPORT_LARGE_BATCH_HINT, 3000)
      return
    }

    this.showToast('正在后台同步导入订阅的头像与内容…', 2200)
    void this.refreshImportedFeedsInBackground(result.importedFeedIds)
  }

  private async refreshImportedFeedsInBackground(feedIds: string[]): Promise<void> {
    const result = await SubscriptionOpmlService.refreshImportedFeedsInBackground(feedIds)
    this.handleRefreshResult(result)
  }

  private handleRefreshResult(result: SubscriptionOpmlRefreshResult): void {
    if (result.total <= 0) {
      return
    }
    const failedSuffix = result.failed > 0 ? `，失败 ${result.failed}` : ''
    this.showToast(`后台同步完成：成功 ${result.success}/${result.total}${failedSuffix}`, 3200)
  }

  private openOpmlImportChoiceDialog(): void {
    this.getUIContext().showAlertDialog({
      title: '导入 OPML',
      message: '请选择导入方式',
      primaryButton: {
        value: '合并导入',
        action: () => {
          void this.importOpmlFromFile('merge')
        },
      },
      secondaryButton: {
        value: '覆盖导入',
        fontColor: '#D94848',
        action: () => {
          void this.importOpmlFromFile('overwrite')
        },
      },
    })
  }

  @Builder
  private SheetHandle() {
    SettingsPanelSheetHandle({ theme: this.theme })
  }

  @Builder
  private PanelHeader() {
    SettingsPanelTitle({ title: '订阅', theme: this.theme })
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        Column({ space: 12 }) {
          Button(this.isOpmlProcessing ? '处理中...' : '导入 OPML')
            .width('100%')
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .enabled(!this.isOpmlProcessing)
            .backgroundColor(this.theme.surface)
            .fontColor(this.theme.textPrimary)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => {
              this.openOpmlImportChoiceDialog()
            })

          Button(this.isOpmlProcessing ? '处理中...' : '导出 OPML')
            .width('100%')
            .height(44)
            .type(ButtonType.Capsule)
            .fontSize(14)
            .fontWeight(FontWeight.Medium)
            .enabled(!this.isOpmlProcessing)
            .backgroundColor(this.theme.surface)
            .fontColor(this.theme.textPrimary)
            .border({ width: 0.8, color: this.theme.divider })
            .onClick(() => {
              void this.exportOpmlToFile()
            })

          Text('导入支持“合并导入 / 覆盖导入”，导出会生成标准 OPML 文件。')
            .fontSize(12)
            .lineHeight(18)
            .fontColor(this.theme.textSecondary)
            .width('100%')
        }
        .width('100%')
        .padding(16)
        .backgroundColor(this.theme.surface)
        .borderRadius(CARD_RADIUS_LG)
        .border({ width: 0.8, color: this.theme.divider })
        .transition(livoMotion.enterSoft(30))

        Row()
          .height(28)
          .width('100%')
      }
      .width('100%')
      .constraintSize({ minHeight: '100%' })
      .justifyContent(FlexAlign.Start)
      .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: 12 })
      .alignItems(HorizontalAlign.Start)
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
    .edgeEffect(EdgeEffect.Spring)
  }
}
