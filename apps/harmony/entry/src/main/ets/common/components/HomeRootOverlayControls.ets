import { ContentModeRail } from './ContentModeRail'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  HOME_INLINE_SEARCH_ACTION_GAP,
  HOME_INLINE_SEARCH_ACTION_SIZE,
  SubscriptionMode,
} from './HomeRootConfig'
import { ROOT_MODE_RAIL_TOP_GAP } from './FloatingRootPageLayout'
import { HOME_INLINE_SEARCH_MOTION_DURATION } from './HomeInlineSearchOverlay'

@Component
export struct HomeRootOverlayControls {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop mode: SubscriptionMode = 'articles'
  @Prop interactionLocked: boolean = false
  @Prop isRefreshing: boolean = false
  @Prop refreshTotalCount: number = 0
  @Prop displayRefreshPercent: number = 0
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

  onRefresh: () => void = () => {}
  onSearchOpen: () => void = () => {}
  onExpandRequest: () => void = () => {}
  onModeChange: (mode: SubscriptionMode) => void = () => {}

  private actionBackgroundColor(): string {
    return this.theme.isDark ? 'rgba(20,22,28,0.74)' : 'rgba(255,255,255,0.84)'
  }

  private actionBorderColor(): string {
    return this.theme.isDark ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.08)'
  }

  private actionBackdropBlur(): number {
    return this.theme.isDark ? 10 : 18
  }

  private actionShadow(): ShadowOptions {
    return {
      radius: 10,
      color: this.theme.isDark ? 'rgba(0,0,0,0.28)' : 'rgba(15,23,42,0.12)',
      offsetX: 0,
      offsetY: 2,
    }
  }

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
  private QuickActionsLayer() {
    Row({ space: HOME_INLINE_SEARCH_ACTION_GAP }) {
      Row() {
        if (this.isRefreshing && this.refreshTotalCount > 0) {
          Text(`${this.displayRefreshPercent}%`)
            .fontSize(12)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
        } else {
          SymbolGlyph($r('sys.symbol.arrow_clockwise'))
            .fontSize(18)
            .fontColor([this.theme.textPrimary])
        }
      }
      .width(HOME_INLINE_SEARCH_ACTION_SIZE)
      .height(HOME_INLINE_SEARCH_ACTION_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.actionBackgroundColor())
      .backdropBlur(this.isRefreshing ? this.actionBackdropBlur() + 2 : this.actionBackdropBlur())
      .borderRadius(HOME_INLINE_SEARCH_ACTION_SIZE / 2)
      .border({ width: 0.8, color: this.actionBorderColor() })
      .shadow(this.actionShadow())
      .enabled(!this.showSearch)
      .onClick(() => {
        this.onRefresh()
      })

      Row() {
        SymbolGlyph($r('sys.symbol.magnifyingglass'))
          .fontSize(18)
          .fontColor([this.theme.textPrimary])
      }
      .width(HOME_INLINE_SEARCH_ACTION_SIZE)
      .height(HOME_INLINE_SEARCH_ACTION_SIZE)
      .justifyContent(FlexAlign.Center)
      .alignItems(VerticalAlign.Center)
      .backgroundColor(this.actionBackgroundColor())
      .backdropBlur(this.actionBackdropBlur())
      .borderRadius(HOME_INLINE_SEARCH_ACTION_SIZE / 2)
      .border({ width: 0.8, color: this.actionBorderColor() })
      .shadow(this.actionShadow())
      .enabled(!this.showSearch)
      .onClick(() => {
        this.onSearchOpen()
      })
    }
    .padding({
      top: this.collapsedModeRailTopPadding,
      left: this.horizontalPadding,
      right: this.horizontalPadding,
    })
    .width('100%')
    .justifyContent(FlexAlign.End)
    .alignItems(VerticalAlign.Top)
    .opacity(this.showSearch ? 0 : 1)
    .translate({ x: this.showSearch ? 10 : 0 })
    .animation({ duration: HOME_INLINE_SEARCH_MOTION_DURATION, curve: Curve.FastOutSlowIn })
    .enabled(!this.showSearch)
    .zIndex(130)
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
    Row({ space: HOME_INLINE_SEARCH_ACTION_GAP }) {
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
      this.QuickActionsLayer()
    }
    .width('100%')
  }
}
