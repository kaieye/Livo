import { curves } from '@kit.ArkUI'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { ACTION_ICON_SIZE, HEADER_BACK_SLOT_SIZE, HEADER_MIN_HEIGHT, HEADER_TITLE_GAP, TITLE_FONT_SIZE } from '../ui/UiTokens'

@Component
export struct PageHeader {
  @State private isBackPressed: boolean = false
  @State private isTrailingPressed: boolean = false
  @Prop title: string = ''
  @Prop subtitle: string = ''
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop showBackButton: boolean = false
  @Prop trailingSymbol: Resource | null = null
  @Prop trailingText: string = ''
  @Prop trailingButtonCircular: boolean = false
  @Prop trailingSymbolSize: number = ACTION_ICON_SIZE
  @Prop trailingSymbolColor: string = ''
  @Prop trailingButtonBackground: string = ''
  @Prop showTrailingBuilder: boolean = false
  @Prop titleSize: number = TITLE_FONT_SIZE
  @Prop subtitleSize: number = 11
  @Prop minHeight: number = HEADER_MIN_HEIGHT
  @Prop topPadding: number = 0
  @Prop bottomPadding: number = 0
  onTrailingClick: () => void = () => {}
  onBack: () => void = () => {}

  @Builder
  private EmptyTrailingBuilder() {
  }

  @BuilderParam trailingBuilder: () => void = this.EmptyTrailingBuilder

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
          .fontSize(this.trailingSymbolSize)
          .fontColor([this.trailingSymbolColor || this.theme.textPrimary])
      }
      .width(HEADER_BACK_SLOT_SIZE)
      .height(HEADER_BACK_SLOT_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .margin(this.trailingButtonCircular ? { top: -2, left: -5 } : {})
      .backgroundColor(this.trailingButtonBackground || this.theme.elevated)
      .borderRadius(this.trailingButtonCircular ? HEADER_BACK_SLOT_SIZE : 15)
      .border(this.trailingButtonCircular ? { width: 0 } : { width: 0.8, color: this.theme.divider })
      .shadow(this.trailingButtonCircular
        ? { radius: 0, color: 'rgba(0,0,0,0)', offsetY: 0 }
        : { radius: 8, color: this.theme.isDark ? 'rgba(0,0,0,0.16)' : 'rgba(15,23,42,0.06)', offsetY: 2 })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .scale({
        x: this.isTrailingPressed ? 0.84 : 1,
        y: this.isTrailingPressed ? 0.84 : 1,
      })
      .opacity(this.isTrailingPressed ? 0.76 : 1)
      .animation({
        duration: this.isTrailingPressed ? 90 : 280,
        curve: this.isTrailingPressed ? Curve.EaseOut : curves.springMotion(0.32, 0.88),
      })
      .onTouch((event: TouchEvent) => {
        if (event.type === TouchType.Down) {
          this.isTrailingPressed = true
          return
        }
        this.isTrailingPressed = false
      })
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

      if (this.showTrailingBuilder) {
        this.trailingBuilder()
      } else if (this.trailingText || this.trailingSymbol !== null) {
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
