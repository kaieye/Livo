import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import { ThemePalette, ThemeService } from '../services/ThemeService'

@Component
export struct SubscriptionsHdsNavigationShell {
  @Prop hideTitleBar: boolean = false
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  bindScrollers: Scroller[] = []

  @Builder
  private EmptyBuilder() {
  }

  @BuilderParam content: () => void = this.EmptyBuilder
  @BuilderParam lowerTitle: () => void = this.EmptyBuilder

  build() {
    HdsNavigation() {
      this.content()
    }
    .titleBar({
      padding: {
        start: LengthMetrics.vp(2),
        end: LengthMetrics.vp(2),
      },
      style: {
        scrollEffectOpts: {
          enableScrollEffect: true,
          scrollEffectType: ScrollEffectType.IMMERSIVE_GRADIENT_BLUR,
          blurEffectiveStartOffset: LengthMetrics.vp(0),
          blurEffectiveEndOffset: LengthMetrics.vp(30),
        },
        blurStrategy: BlurStrategy.ENABLE,
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.IMMERSIVE,
          materialLevel: hdsMaterial.MaterialLevel.EXQUISITE,
        },
        originalStyle: {
          backgroundStyle: {
            backgroundColor: '#00000000',
            maskExtraHeight: 0,
            blurRadius: 28,
          },
          contentStyle: {
            titleStyle: {
              mainTitleColor: $r('sys.color.font_primary'),
              subTitleColor: $r('sys.color.font_secondary'),
            },
            menuStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
            backIconStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
          },
        },
        scrollEffectStyle: {
          backgroundStyle: {
            backgroundColor: '#00000000',
            maskExtraHeight: 0,
            blurRadius: 48,
          },
          contentStyle: {
            titleStyle: {
              mainTitleColor: $r('sys.color.font_primary'),
              subTitleColor: $r('sys.color.font_secondary'),
            },
            menuStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
            backIconStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
          },
        },
      },
      content: {
        title: {
          mainTitle: '',
        },
        bottomBuilder: {
          builder: (): void => this.lowerTitle(),
        },
      },
    })
    .titleMode(HdsNavigationTitleMode.MINI)
    .hideTitleBar(this.hideTitleBar)
    .hideBackButton(true)
    .bindToScrollable(this.bindScrollers)
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
