import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'

@Component
export struct SettingListRow {
  @Prop title: string = ''
  @Prop icon: string = '◎'
  @Prop iconColor: string = '#FF7A1A'
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop showDivider: boolean = false

  build() {
    Column() {
      Row({ space: 16 }) {
        Stack({ alignContent: Alignment.Center }) {
          Row()
            .width(44)
            .height(44)
            .borderRadius(12)
            .backgroundColor(this.iconColor)

          Text(this.icon)
            .fontSize(18)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.accentText)
        }

        Text(this.title)
          .fontSize(18)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)
          .layoutWeight(1)

        Text('›')
          .fontSize(24)
          .fontColor(this.theme.textMuted)
      }
      .width('100%')
      .padding({ left: 18, right: 18, top: 18, bottom: 18 })

      if (this.showDivider) {
        Divider()
          .strokeWidth(0.5)
          .color(this.theme.divider)
          .margin({ left: 78, right: 18 })
      }
    }
    .width('100%')
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .transition(livoMotion.enterScale())
  }
}
