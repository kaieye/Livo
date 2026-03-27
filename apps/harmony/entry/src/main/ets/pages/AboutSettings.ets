import { AppRepository } from '../common/data/AppRepository'
import { goBack } from '../common/navigation/AppRouter'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { PAGE_HORIZONTAL_PADDING, CARD_RADIUS_LG } from '../common/ui/UiTokens'

@Entry
@Component
struct AboutSettings {
  @State theme: ThemePalette = ThemeService.currentPalette()

  aboutToAppear(): void {
    void this.loadTheme()
  }

  private async loadTheme(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
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
        Text('关于')
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)

        Text('版本信息与项目说明')
          .fontSize(12)
          .fontColor(this.theme.textSecondary)
      }
      .alignItems(HorizontalAlign.Start)
      Blank()
    }
    .width('100%')
  }

  @Builder
  private InfoRow(title: string, value: string) {
    Row() {
      Text(title)
        .fontSize(15)
        .fontColor(this.theme.textPrimary)
        .layoutWeight(1)

      Text(value)
        .fontSize(13)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .padding(16)
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_LG)
    .border({ width: 0.8, color: this.theme.divider })
  }

  build() {
    List({ space: 16 }) {
      ListItem() {
        Column({ space: 8 }) {
          this.Header()
          Text('一个自由开源的 RSS 阅读器，支持本地优先与多端体验。')
            .fontSize(12)
            .fontColor(this.theme.textMuted)
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 10 })
      }

      ListItem() {
        Column({ space: 10 }) {
          this.InfoRow('应用名称', 'Livo')
          this.InfoRow('Harmony 端', 'ArkTS / ArkUI')
          this.InfoRow('数据策略', '本地优先')
          this.InfoRow('项目状态', '开发中')
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
