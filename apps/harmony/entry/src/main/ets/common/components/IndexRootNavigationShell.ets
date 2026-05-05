import { LengthMetrics, SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  HdsTabs,
  HdsTabsController,
  ScrollEffectType,
  SystemMaterialParams,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import { RootTabId } from '../navigation/AppRouter'
import { Entry, EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
  PAGE_HORIZONTAL_PADDING,
} from '../ui/UiTokens'
import {
  ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE,
  ROOT_PAGE_SECONDARY_TITLE_FONT_SIZE,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import {
  HdsBottomTabId,
  HdsBottomTabItem,
  resolveHdsBottomTabBarBottomMargin,
  resolveHdsBottomTabItems,
} from '../utils/HdsBottomTabConfig'
import {
  HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT,
  ROOT_BOTTOM_TITLE_HEIGHT,
  RootTabSymbolPair,
  SubscriptionMode,
} from './HomeRootConfig'
import { IndexHomeRootContentCallbacks } from './IndexHomeRootContent'
import { IndexRootTabBody } from './IndexRootTabBody'
import { TweetEntryPresentation } from '../utils/TweetEntryPresentation'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'

@Component
export struct IndexRootNavigationShell {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop rootSettings: HarmonySettings = {} as HarmonySettings
  @Prop showUnreadDot: boolean = true
  @Prop mode: SubscriptionMode = 'articles'
  @Prop homeInitialLoadPending: boolean = false
  @Prop isHomeStartupRefreshing: boolean = false
  @Prop renderedMode: SubscriptionMode = 'articles'
  @Prop previousMode: SubscriptionMode = 'articles'
  @Prop isModeTransitioning: boolean = false
  @Prop modeTransitionDirection: number = 1
  @Prop homeListSwapAnimating: boolean = false
  @Prop homeListSwapMode: SubscriptionMode = 'articles'
  @Prop homeListSwapOpacity: number = 1
  @Prop homeContentVersion: number = 0
  @Prop hideBottomTabs: boolean = false
  @Prop hideTitleBar: boolean = false
  @Prop isHomeRootTab: boolean = false
  @Prop isSettingsRootTab: boolean = false
  @Prop currentRootTitle: string = ''
  @Prop scrollEffectType: ScrollEffectType = ScrollEffectType.IMMERSIVE_GRADIENT_BLUR
  @Prop blurEffectiveEndOffset: LengthMetrics = LengthMetrics.vp(30)
  @Prop originalTitleBarBackgroundColor: ResourceColor = '#00000000'
  @Prop scrollEffectBackgroundColor: ResourceColor = '#00000000'
  @Prop originalTitleBarBlurRadius: number = 28
  @Prop scrollEffectTitleBarBlurRadius: number = 48
  @Prop originalTitleBarMaskExtraHeight: number = 0
  @Prop scrollEffectTitleBarMaskExtraHeight: number = 0
  @Prop blurStrategy: BlurStrategy | undefined = BlurStrategy.ENABLE
  @Prop systemMaterialEffect: SystemMaterialParams | undefined = undefined
  @Prop bindScrollers: Scroller[] = []

  controller: HdsTabsController = new HdsTabsController()
  homeCallbacks: IndexHomeRootContentCallbacks = {
    onModeSwipe: () => {},
    getEntries: () => [],
    getDataSource: () => new ArrayLazyDataSource<EntryCardModel>(() => []),
    getTotalCount: () => 0,
    isModeLoading: () => false,
    getEmptyStateTitle: () => '',
    getSceneOpacity: () => 1,
    getSceneOffsetX: () => 0,
    getSceneZIndex: () => 0,
    getSceneVisible: () => Visibility.Visible,
    getListSwapTranslateY: () => 0,
    getScroller: () => new Scroller(),
    onWillScroll: () => undefined,
    onDidScroll: () => {},
    onStopDragging: () => {},
    onEntryOpen: () => {},
    onItemAppear: () => {},
    onListEndReach: () => {},
    getTweetPresentation: () => ({} as TweetEntryPresentation),
    getPictureEntry: () => ({} as Entry),
    getPictureCaption: () => '',
    getPictureGalleryUrls: () => [],
  }
  rootTabSymbolPair: (tabId: HdsBottomTabId) => RootTabSymbolPair = () => ({
    normal: new SymbolGlyphModifier($r('sys.symbol.house')),
    selected: new SymbolGlyphModifier($r('sys.symbol.house_fill')),
  } as RootTabSymbolPair)
  onRootTabChange: (index: number) => void = () => {}
  onTabAppear: (tabId: RootTabId) => void = () => {}
  onSettingsContentScrollerReady: (scroller: Scroller) => void = () => {}
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onThemeChange: (theme: ThemePalette) => void = () => {}

  @Builder
  private SettingsLowerTitleBuilder() {
    Row() {
      Text(this.currentRootTitle)
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

  @Builder
  private HomeLowerTitleBuilder() {
    Row() {
      Text('首页')
        .fontSize(ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(HOME_ROOT_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  build() {
    HdsNavigation() {
      HdsTabs({ controller: this.controller }) {
        ForEach(resolveHdsBottomTabItems(), (item: HdsBottomTabItem) => {
          TabContent() {
            IndexRootTabBody({
              tabId: item.id as RootTabId,
              theme: this.theme,
              rootSettings: this.rootSettings,
              showUnreadDot: this.showUnreadDot,
              mode: this.mode,
              renderedMode: this.renderedMode,
              previousMode: this.previousMode,
              isModeTransitioning: this.isModeTransitioning,
              modeTransitionDirection: this.modeTransitionDirection,
              homeInitialLoadPending: this.homeInitialLoadPending,
              isHomeStartupRefreshing: this.isHomeStartupRefreshing,
              homeListSwapAnimating: this.homeListSwapAnimating,
              homeListSwapMode: this.homeListSwapMode,
              homeListSwapOpacity: this.homeListSwapOpacity,
              homeContentVersion: this.homeContentVersion,
              homeCallbacks: this.homeCallbacks,
              onTabAppear: (tabId: RootTabId) => {
                this.onTabAppear(tabId)
              },
              onSettingsContentScrollerReady: (scroller: Scroller) => {
                this.onSettingsContentScrollerReady(scroller)
              },
              onSettingsChange: (settings: HarmonySettings) => {
                this.onSettingsChange(settings)
              },
              onThemeChange: (theme: ThemePalette) => {
                this.onThemeChange(theme)
              },
            })
          }
          .tabBar(BottomTabBarStyle.of({
            normal: this.rootTabSymbolPair(item.id).normal,
            selected: this.rootTabSymbolPair(item.id).selected,
          }, item.label))
        }, (item: HdsBottomTabItem) => item.id)
      }
      .vertical(false)
      .scrollable(false)
      .cachedMaxCount(4, TabsCacheMode.CACHE_BOTH_SIDE)
      .animationDuration(0)
      .barPosition(BarPosition.End)
      .barOverlap(true)
      .barHeight(this.hideBottomTabs ? 0 : BOTTOM_TAB_BAR_HEIGHT)
      .barFloatingStyle({
        barBottomMargin: resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP),
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
        },
      })
      .onChange((index: number) => {
        this.onRootTabChange(index)
      })
    }
    .mode(NavigationMode.Stack)
    .titleBar({
      content: {
        title: {
          mainTitle: this.isHomeRootTab || this.isSettingsRootTab ? '' : this.currentRootTitle,
        },
        bottomBuilder: this.isHomeRootTab
          ? {
              builder: (): void => this.HomeLowerTitleBuilder(),
            }
          : this.isSettingsRootTab
          ? {
              builder: (): void => this.SettingsLowerTitleBuilder(),
            }
          : undefined,
      },
      style: {
        scrollEffectOpts: {
          enableScrollEffect: true,
          scrollEffectType: this.scrollEffectType,
          blurEffectiveStartOffset: LengthMetrics.vp(0),
          blurEffectiveEndOffset: this.blurEffectiveEndOffset,
        },
        blurStrategy: this.blurStrategy,
        originalStyle: {
          backgroundStyle: {
            backgroundColor: this.originalTitleBarBackgroundColor,
            maskExtraHeight: this.originalTitleBarMaskExtraHeight,
            blurRadius: this.originalTitleBarBlurRadius,
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
            backgroundColor: this.scrollEffectBackgroundColor,
            maskExtraHeight: this.scrollEffectTitleBarMaskExtraHeight,
            blurRadius: this.scrollEffectTitleBarBlurRadius,
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
        systemMaterialEffect: this.systemMaterialEffect,
      },
    })
    .titleMode(HdsNavigationTitleMode.MINI)
    .hideTitleBar(this.hideTitleBar)
    .hideBackButton(true)
    .bindToScrollable(this.bindScrollers)
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
    .width('100%')
    .height('100%')
  }
}
