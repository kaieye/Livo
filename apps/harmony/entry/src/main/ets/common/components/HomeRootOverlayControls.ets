import { ContentModeRail } from './ContentModeRail'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  SubscriptionMode,
} from './HomeRootConfig'
import { ROOT_MODE_RAIL_TOP_GAP } from './FloatingRootPageLayout'
import { HOME_INLINE_SEARCH_MOTION_DURATION } from './HomeInlineSearchOverlay'

@Component
export struct HomeRootOverlayControls {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  @Prop showSearch: boolean = false
  @Prop collapsedModeRailTopPadding: number = 0
  @Prop collapseProgress: number = 0
  @Prop modeRailTopPadding: number = 0
  @Prop modeRailLeftPadding: number = 0
  @Prop modeRailRightInset: number = 0
  @Prop modeRailDismissTranslateY: number = 0
  @Prop modeRailDismissOpacity: number = 1
  @Prop modeRailDismissScale: number = 1
  @Prop modeRailCollapsed: boolean = false
  @Prop horizontalPadding: number = 0

  onExpandRequest: () => void = () => {}
  onModeChange: (mode: SubscriptionMode) => void = () => {}

  @Builder
  private HomeModeRail(collapsed: boolean) {
    ContentModeRail({
      mode: this.mode,
      theme: this.theme,
      interactionLocked: this.interactionLocked,
      enableEnterTransition: false,
      collapsed,
      collapseProgress: this.collapseProgress,
      onExpandRequest: () => {
        this.onExpandRequest()
      },
      onChange: (mode: SubscriptionMode) => {
        this.onModeChange(mode)
      },
    })
  }

  @Builder
  private CollapsingModeRailLayer() {
    Stack({ alignContent: Alignment.Top }) {
      Column({ space: ROOT_MODE_RAIL_TOP_GAP }) {
        Row()
          .width('100%')
          .height(0)

        Row() {
          this.HomeModeRail(false)
        }
        .width('100%')
        .justifyContent(FlexAlign.Start)
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)
      .align(Alignment.Top)
    }
    .width('100%')
    .padding({
      top: this.modeRailTopPadding,
      left: this.modeRailLeftPadding,
      right: this.horizontalPadding,
    })
    .translate({ y: this.modeRailDismissTranslateY })
    .opacity(this.modeRailDismissOpacity)
    .scale({ x: this.modeRailDismissScale, y: this.modeRailDismissScale })
    .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
    .enabled(!this.modeRailCollapsed)
    .zIndex(100)
  }

  @Builder
  private CollapsedModeRailLayer() {
    Row() {
      this.HomeModeRail(true)
    }
    .width('100%')
    .justifyContent(FlexAlign.End)
    .alignItems(VerticalAlign.Top)
    .padding({
      top: this.collapsedModeRailTopPadding,
      left: this.horizontalPadding,
      right: this.modeRailRightInset,
    })
    .opacity(this.showSearch ? 0 : this.collapseProgress)
    .translate({
      x: this.showSearch ? 10 : 0,
      y: (1 - this.collapseProgress) * 14,
    })
    .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
    .enabled(this.modeRailCollapsed && !this.showSearch)
    .hitTestBehavior(HitTestMode.Transparent)
    .zIndex(132)
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      this.CollapsingModeRailLayer()
      this.CollapsedModeRailLayer()
    }
    .width('100%')
  }
}
