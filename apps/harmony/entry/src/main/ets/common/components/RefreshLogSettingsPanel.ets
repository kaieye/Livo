import { RefreshLogStore } from '../services/RefreshLogStore'
import { HarmonySettings, RefreshLogEntry } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { loadThemeForComponent } from '../utils/PageThemeHelper'
import { livoMotion } from '../ui/Motion'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import {
  PANEL_HINT_SIZE,
  PANEL_SECTION_SPACING,
  PANEL_SUBTITLE_SIZE,
  PANEL_TITLE_SIZE,
  SettingsPanelSheetHandle,
  SettingsPanelTitle,
} from './SettingsPanelShared'

@Component
export struct RefreshLogSettingsPanel {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State logs: RefreshLogEntry[] = []
  @State isLoading: boolean = true
  @Prop useInheritedTheme: boolean = false
  @Prop inheritedTheme: ThemePalette = ThemeService.currentPalette()
  onSettingsChange: (settings: HarmonySettings) => void = () => {}

  aboutToAppear(): void {
    if (this.useInheritedTheme) {
      this.theme = this.inheritedTheme
    }
    void this.loadData()
  }

  private async loadData(): Promise<void> {
    this.isLoading = true
    try {
      if (!this.useInheritedTheme) {
        this.theme = await loadThemeForComponent()
      }
      this.logs = await RefreshLogStore.load()
    } finally {
      this.isLoading = false
    }
  }

  private formatDateTime(timestamp: number): string {
    if (timestamp <= 0) {
      return '未知时间'
    }
    const date = new Date(timestamp)
    const month = `${date.getMonth() + 1}`.padStart(2, '0')
    const day = `${date.getDate()}`.padStart(2, '0')
    const hour = `${date.getHours()}`.padStart(2, '0')
    const minute = `${date.getMinutes()}`.padStart(2, '0')
    return `${month}-${day} ${hour}:${minute}`
  }

  private failedFeedsLabel(log: RefreshLogEntry): string {
    if (!log.failedFeedTitles || log.failedFeedTitles.length === 0) {
      return '无'
    }
    return log.failedFeedTitles.join('、')
  }

  private async clearLogs(): Promise<void> {
    await RefreshLogStore.clear()
    this.logs = []
  }

  @Builder
  private SheetHandle() {
    SettingsPanelSheetHandle({ theme: this.theme })
  }

  @Builder
  private PanelHeader() {
    SettingsPanelTitle({ title: '刷新日志', theme: this.theme })
  }

  @Builder
  private EmptyState() {
    Column({ space: 8 }) {
      Text('暂无刷新记录')
        .fontSize(PANEL_TITLE_SIZE)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)

      Text('在首页执行刷新后，这里会显示刷新时间、成功数、失败数和失败订阅源。')
        .fontSize(PANEL_SUBTITLE_SIZE)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .padding(14)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  @Builder
  private LogCard(log: RefreshLogEntry, index: number) {
    Column({ space: 8 }) {
      Row() {
        Text(this.formatDateTime(log.refreshedAt))
          .fontSize(PANEL_TITLE_SIZE)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Text(`#${this.logs.length - index}`)
          .fontSize(PANEL_HINT_SIZE)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')

      Text(`成功刷新 ${log.successFeedCount} 个订阅源 · 失败 ${log.failedFeedCount} 个`)
        .fontSize(PANEL_SUBTITLE_SIZE)
        .fontColor(this.theme.textSecondary)
        .width('100%')

      Text(`失败订阅源：${this.failedFeedsLabel(log)}`)
        .fontSize(PANEL_SUBTITLE_SIZE)
        .lineHeight(18)
        .fontColor(this.theme.textSecondary)
        .maxLines(3)
        .textOverflow({ overflow: TextOverflow.Ellipsis })
        .width('100%')
    }
    .width('100%')
    .padding({ left: 12, right: 12, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(16)
    .border({ width: 0.8, color: this.theme.divider })
    .transition(livoMotion.enterSoft(index * 18 + 20))
  }

  build() {
    Scroll() {
      Column({ space: PANEL_SECTION_SPACING }) {
        this.SheetHandle()
        this.PanelHeader()

        if (this.isLoading) {
          Column({ space: 10 }) {
            LoadingProgress()
              .width(26)
              .height(26)
              .color(this.theme.accent)

            Text('正在加载刷新日志')
              .fontSize(PANEL_SUBTITLE_SIZE)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .padding({ top: 24, bottom: 12 })
          .alignItems(HorizontalAlign.Center)
        } else {
          Row({ space: 10 }) {
            Button('清空日志')
              .type(ButtonType.Capsule)
              .height(36)
              .fontSize(13)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)
              .backgroundColor(this.theme.surface)
              .border({ width: 0.8, color: this.theme.divider })
              .onClick(() => {
                void this.clearLogs()
              })

            Button('刷新列表')
              .type(ButtonType.Capsule)
              .height(36)
              .fontSize(13)
              .fontWeight(FontWeight.Medium)
              .fontColor(this.theme.textPrimary)
              .backgroundColor(this.theme.surface)
              .border({ width: 0.8, color: this.theme.divider })
              .onClick(() => {
                void this.loadData()
              })
          }
          .width('100%')
          .justifyContent(FlexAlign.End)
          .padding({ top: 8, bottom: 10 })

          if (this.logs.length === 0) {
            this.EmptyState()
          } else {
            Column({ space: 10 }) {
              ForEach(this.logs, (log: RefreshLogEntry, index: number) => {
                this.LogCard(log, index)
              }, (log: RefreshLogEntry) => log.id)
            }
            .width('100%')
          }
        }

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
