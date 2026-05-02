import { FeedViewType } from '../../models/LivoModels'
import { ThemePalette } from '../../services/ThemeService'
import { CARD_RADIUS_SM, CHIP_RADIUS } from '../../ui/UiTokens'
import {
  FeedSubscribeViewOption,
  feedSubscribeViewIndex,
  feedSubscribeViewOptions,
  feedSubscribeViewSymbol,
  feedSubscribeViewLabel,
} from '../../utils/FeedSubscribeViewOptions'

const RAIL_HEIGHT: number = 46
const RAIL_PADDING: number = 4
const PILL_HEIGHT: number = 38

/**
 * Segment-control with a sliding "pill" indicator that animates to the
 * selected view-type.
 *
 * Owns its own measurement (`railWidth`) — the parent only needs to know
 * which view is selected and react when the user picks a new one.
 */
@Component
export struct FeedSubscribeViewTypeRail {
  @Prop theme: ThemePalette
  @Prop selectedView: FeedViewType = FeedViewType.Articles
  onSelect: (view: FeedViewType) => void = () => {}

  @State private railWidth: number = 0

  private indicatorColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.92)'
  }

  private indicatorBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.05)'
  }

  private indicatorShadowColor(): string {
    return this.theme.isDark ? 'rgba(0,0,0,0.12)' : 'rgba(15,23,42,0.08)'
  }

  private slotWidth(): number {
    if (this.railWidth <= 0) {
      return 0
    }
    return (this.railWidth - RAIL_PADDING * 2) / feedSubscribeViewOptions().length
  }

  private indicatorOffsetX(): number {
    return this.slotWidth() * feedSubscribeViewIndex(this.selectedView)
  }

  @Builder
  private OptionButton(option: FeedSubscribeViewOption) {
    Row({ space: 6 }) {
      SymbolGlyph(feedSubscribeViewSymbol(option.view))
        .fontSize(16)
        .fontColor([this.selectedView === option.view ? this.theme.accent : this.theme.textSecondary])

      Text(feedSubscribeViewLabel(option.view))
        .fontSize(14)
        .fontWeight(FontWeight.Regular)
        .fontColor(this.theme.textSecondary)
    }
    .layoutWeight(1)
    .height(PILL_HEIGHT)
    .justifyContent(FlexAlign.Center)
    .borderRadius(CHIP_RADIUS)
    .animation({ duration: 160, curve: Curve.EaseInOut })
    .clickEffect({ level: ClickEffectLevel.MIDDLE })
    .onClick(() => {
      this.onSelect(option.view)
    })
  }

  build() {
    Stack({ alignContent: Alignment.Center }) {
      Row() {
        Row()
          .width(this.slotWidth())
          .height(PILL_HEIGHT)
          .translate({ x: this.indicatorOffsetX() })
          .backgroundColor(this.indicatorColor())
          .borderRadius(CHIP_RADIUS)
          .border({ width: 0.6, color: this.indicatorBorderColor() })
          .shadow({
            radius: 8,
            color: this.indicatorShadowColor(),
            offsetX: 0,
            offsetY: 2,
          })
          .animation({ duration: 100, curve: Curve.EaseOut })
          .hitTestBehavior(HitTestMode.None)
      }
      .width('100%')
      .height('100%')
      .justifyContent(FlexAlign.Start)

      Row({ space: 0 }) {
        ForEach(
          feedSubscribeViewOptions(),
          (option: FeedSubscribeViewOption) => {
            this.OptionButton(option)
          },
          (option: FeedSubscribeViewOption) => `view-${option.view}`,
        )
      }
      .width('100%')
      .height('100%')
    }
    .width('100%')
    .height(RAIL_HEIGHT)
    .padding(RAIL_PADDING)
    .backgroundColor(this.theme.elevated)
    .borderRadius(CARD_RADIUS_SM)
    .border({ width: 0.8, color: this.theme.divider })
    .onSizeChange((_, newValue) => {
      if (typeof newValue.width === 'number') {
        this.railWidth = newValue.width
      }
    })
  }
}
