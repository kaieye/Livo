import { ThemePalette, ThemeService } from '../services/ThemeService'
import { CARD_RADIUS_MD } from '../ui/UiTokens'

@Component
export struct HomeEmptyStateCard {
  @Prop message: string = ''
  @Prop loading: boolean = false
  @Prop loadingMessage: string = '正在加载内容...'
  @Prop theme: ThemePalette = ThemeService.currentPalette()

  build() {
    Column({ space: 12 }) {
      if (this.loading) {
        LoadingProgress()
          .width(42)
          .height(42)
          .color(this.theme.accent)

        Text(this.loadingMessage)
          .fontSize(14)
          .fontColor(this.theme.textSecondary)
      } else {
        Text(this.message)
          .fontSize(14)
          .fontWeight(FontWeight.Medium)
          .lineHeight(20)
          .fontColor(this.theme.textSecondary)
          .textAlign(TextAlign.Center)
          .maxLines(2)
      }
    }
    .width('100%')
    .alignItems(HorizontalAlign.Center)
    .justifyContent(FlexAlign.Center)
    .padding({ left: 20, right: 20, top: 24, bottom: 24 })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_MD)
    .border({ width: 0.8, color: this.theme.divider })
  }
}
