import { ThemePalette } from '../../services/ThemeService'
import { SECTION_TITLE_FONT_SIZE } from '../../ui/UiTokens'
import { livoMotion } from '../../ui/Motion'

@Component
export struct DiscoverSectionHeader {
  @Prop title: string
  @Prop trailingText: string = ''
  @Prop showMoreButton: boolean = false
  @Prop theme: ThemePalette
  @Prop showBottomTabs: boolean = true
  leadingIcon?: Resource
  onMoreClick: () => void = () => {}

  build() {
    Row() {
      if (this.leadingIcon) {
        Image(this.leadingIcon)
          .width(20)
          .height(20)
          .objectFit(ImageFit.Contain)
          .margin({ right: 6 })
      }

      Text(this.title)
        .fontSize(SECTION_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor(this.theme.textPrimary)

      Blank()
        .layoutWeight(1)

      if (this.trailingText) {
        Text(this.trailingText)
          .fontSize(11)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textMuted)
      }

      if (this.showMoreButton) {
        Text('更多')
          .fontSize(12)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textMuted)
          .padding({ left: 8, right: 4, top: 2, bottom: 2 })
          .clickEffect({ level: ClickEffectLevel.LIGHT })
          .onClick(() => {
            this.onMoreClick()
          })
      }
    }
    .width('100%')
    .transition(this.showBottomTabs ? livoMotion.enterFromRight(20) : TransitionEffect.IDENTITY)
  }
}
