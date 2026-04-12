import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'

@Component
export struct SettingListRow {
  @Prop title: string = ''
  @Prop symbol: Resource = $r('sys.symbol.gearshape')
  @Prop symbolIsImage: boolean = false
  @Prop symbolColor: string = '#4B5563'
  @Prop subtitle: string = ''
  @Prop hint: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop enableEnterTransition: boolean = true
  onTap: () => void = () => {}

  build() {
    Row() {
      if (this.symbolIsImage) {
        Image(this.symbol)
          .width(24)
          .height(24)
          .objectFit(ImageFit.Contain)
          .fillColor(this.symbolColor)
          .margin({ left: 12, right: 10 })
      } else {
        SymbolGlyph(this.symbol)
          .fontSize(24)
          .margin({ left: 12, right: 10 })
          .fontColor([this.symbolColor])
      }

      Column({ space: this.subtitle ? 2 : 0 }) {
        Text(this.title)
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        if (this.subtitle) {
          Text(this.subtitle)
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      if (this.hint) {
        Text(this.hint)
          .fontSize(14)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .padding({ left: 8 })
      }

      SymbolGlyph($r('sys.symbol.chevron_right'))
        .fontSize(24)
        .margin({ left: 12, right: 12 })
        .fontColor([this.theme.textSecondary])
    }
    .width('100%')
    .height(this.subtitle ? 60 : 56)
    .borderRadius(20)
    .backgroundColor(this.theme.elevated)
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .transition(this.enableEnterTransition ? livoMotion.enterScale() : TransitionEffect.IDENTITY)
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.onTap())
  }
}
