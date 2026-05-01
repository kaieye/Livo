import { ThemePalette, ThemeService } from '../services/ThemeService'
import { HEADER_BACK_SLOT_SIZE } from '../ui/UiTokens'

@Component
export struct ArticleDetailHeaderActions {
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  @Prop isStarred: boolean = false
  @Prop starScale: number = 1

  onRunAi: () => void = () => {}
  onOpenBrowser: () => void = () => {}
  onToggleStar: () => void = () => {}

  @Builder
  private HeaderIconAction(
    symbol: Resource,
    size: number,
    onTap?: () => void,
    symbolColors?: ResourceColor[],
    backgroundColor?: string,
    buttonScale: number = 1,
  ) {
    Row() {
      SymbolGlyph(symbol)
        .fontSize(size)
        .fontColor(symbolColors ?? [this.theme.textSecondary])
        .renderingStrategy(symbol === $r('sys.symbol.lightbulb')
          ? SymbolRenderingStrategy.MULTIPLE_COLOR
          : SymbolRenderingStrategy.SINGLE)
    }
    .width(HEADER_BACK_SLOT_SIZE)
    .height(HEADER_BACK_SLOT_SIZE)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(backgroundColor ?? Color.Transparent)
    .borderRadius(HEADER_BACK_SLOT_SIZE)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .scale({ x: buttonScale, y: buttonScale })
    .animation({ duration: 180, curve: Curve.FastOutSlowIn })
    .onClick(() => {
      if (onTap) {
        onTap()
      }
    })
  }

  @Builder
  private HeaderImageAction(
    image: Resource,
    size: number,
    onTap?: () => void,
    backgroundColor?: string,
    buttonScale: number = 1,
  ) {
    Row() {
      Image(image)
        .width(size)
        .height(size)
        .objectFit(ImageFit.Contain)
    }
    .width(HEADER_BACK_SLOT_SIZE)
    .height(HEADER_BACK_SLOT_SIZE)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor(backgroundColor ?? Color.Transparent)
    .borderRadius(HEADER_BACK_SLOT_SIZE)
    .clickEffect({ level: ClickEffectLevel.LIGHT })
    .scale({ x: buttonScale, y: buttonScale })
    .animation({ duration: 180, curve: Curve.FastOutSlowIn })
    .onClick(() => {
      if (onTap) {
        onTap()
      }
    })
  }

  build() {
    Row({ space: 4 }) {
      this.HeaderImageAction(
        $r('app.media.ri_ai'),
        22,
        () => { this.onRunAi() },
      )

      this.HeaderIconAction(
        $r('sys.symbol.arrow_right_up_and_square'),
        22,
        () => { this.onOpenBrowser() },
      )

      Row() {
        SymbolGlyph($r(this.isStarred ? 'sys.symbol.star_fill' : 'sys.symbol.star'))
          .fontSize(22)
          .fontColor([this.isStarred ? '#F6C343' : this.theme.textSecondary])
          .renderingStrategy(SymbolRenderingStrategy.SINGLE)
      }
      .width(HEADER_BACK_SLOT_SIZE)
      .height(HEADER_BACK_SLOT_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .borderRadius(HEADER_BACK_SLOT_SIZE)
      .clickEffect({ level: ClickEffectLevel.LIGHT })
      .scale({ x: this.starScale, y: this.starScale })
      .animation({ duration: 180, curve: Curve.FastOutSlowIn })
      .onClick(() => { this.onToggleStar() })
    }
    .height(HEADER_BACK_SLOT_SIZE)
  }
}
