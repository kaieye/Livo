import { AppRepository } from '../common/data/AppRepository'
import { goBack } from '../common/navigation/AppRouter'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { CARD_RADIUS_LG, PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'

@Entry
@Component
struct GeneralSettings {
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State saveHint: string = '通用设置将保存到本地'

  aboutToAppear(): void {
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    this.config = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(this.config)
    this.saveHint = '已加载通用配置'
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
        Text('通用')
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)

        Text('语言、刷新与基础偏好')
          .fontSize(12)
          .fontColor(this.theme.textSecondary)
      }
      .alignItems(HorizontalAlign.Start)

      Blank()
    }
    .width('100%')
  }

  @Builder
  private InfoRow(symbol: Resource, title: string, subtitle: string, hint: string) {
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
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Text(hint)
        .fontSize(13)
        .fontColor(this.theme.textSecondary)
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

          Text(this.saveHint)
            .fontSize(12)
            .fontColor(this.theme.textMuted)
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 10 })
      }

      ListItem() {
        Column({ space: 10 }) {
          this.InfoRow($r('sys.symbol.translate_c2e'), '应用语言', '当前界面语言', this.config.language)
          this.InfoRow($r('sys.symbol.arrow_clockwise'), '刷新间隔', '后台自动刷新频率', `${this.config.refreshIntervalMinutes} 分钟`)
          this.InfoRow($r('sys.symbol.link'), '默认订阅源', '远程订阅源地址', this.config.remoteFeedUrl ? '已配置' : '未配置')
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
