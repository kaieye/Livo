import { ThemePalette } from '../services/ThemeService'
import { CARD_RADIUS_XL } from '../ui/UiTokens'

@Component
export struct DiscoverNoResultState {
  @Prop theme: ThemePalette

  build() {
    Column({ space: 8 }) {
      Text('没有匹配结果')
        .fontSize(17)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)
      Text('换一个关键字，或者输入更完整的链接。')
        .fontSize(13)
        .lineHeight(20)
        .fontColor(this.theme.textSecondary)
        .textAlign(TextAlign.Center)
    }
    .width('100%')
    .padding({ left: 20, right: 20, top: 24, bottom: 24 })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_XL)
    .border({ width: 0.8, color: this.theme.divider })
  }
}
