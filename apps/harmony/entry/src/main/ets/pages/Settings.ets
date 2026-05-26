import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
} from '@kit.UIDesignKit'
import { SettingsContent } from '../common/components/SettingsContent'
import { DEFAULT_HARMONY_SETTINGS, HarmonySettings } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { PAGE_HORIZONTAL_PADDING } from '../common/ui/UiTokens'
import {
  ROOT_PAGE_SECONDARY_TITLE_FONT_SIZE,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from '../common/components/FloatingRootPageLayout'
import { ROOT_BOTTOM_TITLE_HEIGHT } from '../common/components/HomeRootConfig'
import { rootTabTitleBarStyle } from '../common/coordinators/index-home/IndexRootChrome'

@Entry
@Component
struct Settings {
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State config: HarmonySettings = DEFAULT_HARMONY_SETTINGS

  @Builder
  private SettingsLowerTitleBuilder() {
    Row() {
      Text('设置')
        .fontSize(ROOT_PAGE_SECONDARY_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(ROOT_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  build() {
    Stack({ alignContent: Alignment.TopStart }) {
      HdsNavigation() {
        SettingsContent({
          inheritedTheme: this.theme,
          inheritedSettings: this.config,
          onSettingsChange: (settings: HarmonySettings) => {
            this.config = settings
          },
          onThemeChange: (theme: ThemePalette) => {
            this.theme = theme
          },
        })
      }
      .mode(NavigationMode.Stack)
      .titleBar({
        padding: {
          start: LengthMetrics.vp(2),
          end: LengthMetrics.vp(2),
        },
        style: rootTabTitleBarStyle(),
        content: {
          title: {
            mainTitle: '',
          },
          bottomBuilder: {
            builder: (): void => this.SettingsLowerTitleBuilder(),
          },
        },
        avoidLayoutSafeArea: true,
        enableComponentSafeArea: false,
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideBackButton(true)
      .ignoreLayoutSafeArea(
        [LayoutSafeAreaType.SYSTEM],
        [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM],
      )
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: Curve.EaseOut }).opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut }).opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut }).opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut }).opacity(0)
  }
}
