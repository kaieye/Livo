import { ThemePalette, ThemeService } from '../services/ThemeService'
import { CARD_RADIUS_MD } from '../ui/UiTokens'

export interface HomeSkeletonEntryCardParams {
  theme?: ThemePalette
  index?: number
}

@Reusable
@Component
export struct HomeSkeletonEntryCard {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop index: number = 0

  build() {
    Row({ space: 10 }) {
      Column({ space: 6 }) {
        Row({ space: 6 }) {
          Blank()
            .width(16)
            .height(16)
            .backgroundColor(this.theme.elevated)
            .borderRadius(8)

          Blank()
            .width(80)
            .height(12)
            .backgroundColor(this.theme.elevated)
            .borderRadius(6)

          Blank()
            .width(6)
            .height(6)
            .borderRadius(3)
            .backgroundColor(this.theme.elevated)

          Blank()
            .width(50)
            .height(12)
            .backgroundColor(this.theme.elevated)
            .borderRadius(6)
        }
        .width('100%')
        .alignItems(VerticalAlign.Center)

        Column({ space: 6 }) {
          Blank()
            .width('100%')
            .height(16)
            .backgroundColor(this.theme.elevated)
            .borderRadius(8)

          Blank()
            .width('75%')
            .height(16)
            .backgroundColor(this.theme.elevated)
            .borderRadius(8)
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Blank()
        .width(72)
        .height(72)
        .backgroundColor(this.theme.elevated)
        .borderRadius(8)
    }
    .width('100%')
    .padding({ left: 14, right: 14, top: 10, bottom: 10 })
    .backgroundColor(this.theme.surface)
    .borderRadius(CARD_RADIUS_MD)
    .border({ width: 0.8, color: this.theme.divider })
    .shadow({
      radius: this.theme.isDark ? 10 : 14,
      color: this.theme.isDark ? 'rgba(0,0,0,0.18)' : 'rgba(15,23,42,0.04)',
      offsetX: 0,
      offsetY: 4,
    })
  }
}
