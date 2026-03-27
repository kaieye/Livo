import { AppRepository } from '../common/data/AppRepository'
import { goBack } from '../common/navigation/AppRouter'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'

@Entry
@Component
struct DataControlSettings {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.config = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(this.config)
  }

  private syncSettings(next: HarmonySettings): void {
    this.config = next
    void AppRepository.persistSettings(next).then((saved: HarmonySettings) => {
      this.config = saved
      void ThemeService.resolvePalette(saved).then((palette: ThemePalette) => {
        this.theme = palette
      })
    })
  }

  @Builder
  private Header() {
    Row({ space: 12 }) {
      Button({ type: ButtonType.Circle, stateEffect: true }) {
        SymbolGlyph($r('sys.symbol.chevron_left'))
          .fontSize(24)
          .fontColor([this.theme.textPrimary])
      }
      .width(38)
      .height(38)
      .backgroundColor(this.theme.surface)
      .border({ width: 0.8, color: this.theme.divider })
      .onClick(() => { void goBack() })

      Column({ space: 2 }) {
        Text('数据控制')
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)

        Text('本地数据、缓存与同步控制')
          .fontSize(12)
          .fontColor(this.theme.textSecondary)
      }
      .alignItems(HorizontalAlign.Start)
      Blank()
    }
    .width('100%')
  }

  @Builder
  private ToggleRow(symbol: Resource, title: string, subtitle: string, checked: boolean, onToggle: () => void) {
    Row({ space: 12 }) {
      SymbolGlyph(symbol)
        .fontSize(22)
        .fontColor([this.theme.textPrimary])
        .margin({ left: 14 })

      Column({ space: 2 }) {
        Text(title)
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        Text(subtitle)
          .fontSize(13)
          .fontColor(this.theme.textSecondary)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Toggle({ type: ToggleType.Switch, isOn: checked })
        .selectedColor(this.theme.accent)
        .switchPointColor('#FFFFFF')
        .onChange(() => onToggle())
        .margin({ right: 14 })
    }
    .width('100%')
    .height(64)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  build() {
    List({ space: 16 }) {
      ListItem() {
        Column({ space: 8 }) {
          this.Header()
          Text('管理本地缓存与内容请求策略')
            .fontSize(12)
            .fontColor(this.theme.textMuted)
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 10 })
      }

      ListItem() {
        Column({ space: 10 }) {
          this.ToggleRow(
            $r('sys.symbol.externaldrive_fill'),
            '图片代理',
            '通过代理加载远程图片资源',
            this.config.imageProxyEnabled,
            () => {
              this.syncSettings({
                autoRefresh: this.config.autoRefresh,
                aiSummaryEnabled: this.config.aiSummaryEnabled,
                imageProxyEnabled: !this.config.imageProxyEnabled,
                refreshIntervalMinutes: this.config.refreshIntervalMinutes,
                themeMode: this.config.themeMode,
                language: this.config.language,
                remoteFeedUrl: this.config.remoteFeedUrl,
              })
            },
          )
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
      }
    }
    .width('100%')
    .height('100%')
    .scrollBar(BarState.Off)
    .backgroundColor(this.theme.background)
  }
}
