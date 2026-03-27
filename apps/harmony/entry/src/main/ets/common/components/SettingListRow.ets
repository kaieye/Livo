import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'

@Component
export struct SettingListRow {
  @Prop title: string = ''
  @Prop symbol: Resource = $r('sys.symbol.gearshape')
  @Prop symbolColor: string = '#4B5563'
  @Prop subtitle: string = ''
  @Prop hint: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  onTap: () => void = () => {}

  build() {
    Row() {
      SymbolGlyph(this.symbol)
        .fontSize(23)
        .margin({ left: 14, right: 12 })
        .fontColor([this.symbolColor])

      Column({ space: this.subtitle ? 2 : 0 }) {
        Text(this.title)
          .fontSize(17)
          .fontWeight(FontWeight.Medium)
          .fontColor(this.theme.textPrimary)

        if (this.subtitle) {
          Text(this.subtitle)
            .fontSize(13)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      if (this.hint) {
        Text(this.hint)
          .fontSize(13)
          .fontColor(this.theme.textSecondary)
          .maxLines(1)
          .textOverflow({ overflow: TextOverflow.Ellipsis })
          .padding({ left: 8 })
      }

      SymbolGlyph($r('sys.symbol.chevron_right'))
        .fontSize(22)
        .margin({ left: 12, right: 14 })
        .fontColor([this.theme.textMuted])
    }
    .width('100%')
    .height(this.subtitle ? 64 : 58)
    .borderRadius(20)
    .backgroundColor(this.theme.surface)
    .border({ width: 0.8, color: this.theme.divider })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .transition(livoMotion.enterScale())
    .alignItems(VerticalAlign.Center)
    .onClick(() => this.onTap())
  }
}
