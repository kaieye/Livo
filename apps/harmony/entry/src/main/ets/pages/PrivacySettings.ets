import { AppRepository } from '../common/data/AppRepository'
import { goBack } from '../common/navigation/AppRouter'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { PAGE_HORIZONTAL_PADDING, CARD_RADIUS_LG } from '../common/ui/UiTokens'

@Entry
@Component
struct PrivacySettings {
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
        Text('隐私')
          .fontSize(22)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)

        Text('代理、权限与本地隐私')
          .fontSize(12)
          .fontColor(this.theme.textSecondary)
      }
      .alignItems(HorizontalAlign.Start)
      Blank()
    }
    .width('100%')
  }

  @Builder
  private TextCard(title: string, content: string) {
    Column({ space: 8 }) {
      Text(title)
        .fontSize(16)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.textPrimary)

      Text(content)
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
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
          Text('Livo 默认以本地存储为主，不依赖账户云端。')
            .fontSize(12)
            .fontColor(this.theme.textMuted)
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 10 })
      }

      ListItem() {
        Column({ space: 10 }) {
          this.TextCard('本地优先', '订阅源、文章状态与设置会优先保存在本机，不需要登录即可使用。')
          this.TextCard('网络请求', '仅在刷新订阅、发现内容或加载远程媒体时才会访问网络。')
          this.TextCard('代理与媒体', '如果你启用了图片代理，远程图片请求会经过代理地址再加载。')
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
