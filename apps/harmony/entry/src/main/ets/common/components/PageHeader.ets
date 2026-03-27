import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { ACTION_ICON_SIZE, TITLE_FONT_SIZE } from '../ui/UiTokens'

@Component
export struct PageHeader {
  @Prop title: string = ''
  @Prop subtitle: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop trailingSymbol: Resource | null = null
  onTrailingClick: () => void = () => {}

  build() {
    Row({ space: 14 }) {
      Column({ space: this.subtitle ? 6 : 0 }) {
        if (this.subtitle) {
          Text(this.subtitle)
            .fontSize(11)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }

        Text(this.title)
          .fontSize(TITLE_FONT_SIZE)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)

      Blank()

      if (this.trailingSymbol !== null) {
        Row() {
          SymbolGlyph(this.trailingSymbol)
            .fontSize(ACTION_ICON_SIZE)
            .fontColor([this.theme.textPrimary])
        }
        .padding(9)
        .backgroundColor(this.theme.surface)
        .borderRadius(15)
        .border({ width: 0.8, color: this.theme.divider })
        .clickEffect({ level: ClickEffectLevel.MIDDLE })
        .onClick(() => {
          this.onTrailingClick()
        })
      }
    }
    .width('100%')
    .padding({ top: 2, bottom: 2 })
    .alignItems(VerticalAlign.Center)
    .transition(livoMotion.enterRise(20))
  }
}
