import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { ACTION_ICON_SIZE, HEADER_BACK_SLOT_SIZE, HEADER_MIN_HEIGHT, HEADER_TITLE_GAP, TITLE_FONT_SIZE } from '../ui/UiTokens'

@Component
export struct PageHeader {
  @State private isBackPressed: boolean = false
  @Prop title: string = ''
  @Prop subtitle: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop showBackButton: boolean = false
  @Prop trailingSymbol: Resource | null = null
  @Prop trailingText: string = ''
  @Prop titleSize: number = TITLE_FONT_SIZE
  @Prop subtitleSize: number = 11
  @Prop minHeight: number = HEADER_MIN_HEIGHT
  @Prop topPadding: number = 2
  @Prop bottomPadding: number = 2
  onTrailingClick: () => void = () => {}
  onBack: () => void = () => {}

  @Builder
  private BackButton() {
    Text('‹')
      .fontSize(28)
      .fontWeight(FontWeight.Medium)
      .fontColor(this.theme.textPrimary)
      .width(HEADER_BACK_SLOT_SIZE)
      .height(HEADER_BACK_SLOT_SIZE)
      .textAlign(TextAlign.Center)
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .scale({
        x: this.isBackPressed ? 0.92 : 1,
        y: this.isBackPressed ? 0.92 : 1,
      })
      .opacity(this.isBackPressed ? 0.72 : 1)
      .animation({ duration: 120, curve: Curve.EaseOut })
      .onTouch((event: TouchEvent) => {
        if (event.type === TouchType.Down) {
          this.isBackPressed = true
          return
        }
        this.isBackPressed = false
      })
      .onClick(() => {
        this.onBack()
      })
  }

  @Builder
  private TrailingAction() {
    if (this.trailingText) {
      Text(this.trailingText)
        .fontSize(14)
        .fontWeight(FontWeight.Medium)
        .fontColor(this.theme.accent)
        .height(HEADER_BACK_SLOT_SIZE)
        .padding({ left: 12, right: 4 })
        .textAlign(TextAlign.End)
        .clickEffect({ level: ClickEffectLevel.MIDDLE })
        .onClick(() => {
          this.onTrailingClick()
        })
    } else if (this.trailingSymbol !== null) {
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

  build() {
    Row() {
      if (this.showBackButton) {
        this.BackButton()
      }

      Column({ space: this.subtitle ? 6 : 0 }) {
        if (this.subtitle) {
          Text(this.subtitle)
            .fontSize(this.subtitleSize)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textMuted)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }

        Text(this.title)
          .fontSize(this.titleSize)
          .fontWeight(FontWeight.Bold)
          .fontColor(this.theme.textPrimary)
      }
      .layoutWeight(1)
      .alignItems(HorizontalAlign.Start)
      .padding({ left: this.showBackButton ? HEADER_TITLE_GAP : 0 })

      if (this.trailingText || this.trailingSymbol !== null) {
        this.TrailingAction()
      }
    }
    .width('100%')
    .constraintSize({ minHeight: this.minHeight })
    .padding({ top: this.topPadding, bottom: this.bottomPadding })
    .alignItems(VerticalAlign.Center)
    .transition(livoMotion.enterRise(20))
  }
}
