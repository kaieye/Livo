import { LengthMetrics, SymbolGlyphModifier } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationMenuContentOptions,
  HdsNavigationTitleMode,
  HdsTabs,
  HdsTabsController,
  BlurStrategy,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { rootTabTitleBarStyle } from '../utils/index-home/IndexRootChrome'
import { RootTabId } from '../navigation/AppRouter'
import { Entry, EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
} from '../ui/UiTokens'
import {
  HdsBottomTabId,
  resolveHdsBottomTabBarBottomMargin,
} from '../utils/index-home/HdsBottomTabConfig'
import { RootTabSymbolPair, SubscriptionMode } from './HomeRootConfig'
import { HomeRootTabBody } from './HomeRootTabBody'
import { IndexHomeRootContentCallbacks } from './IndexHomeRootContent'
import { IndexRootTabBody } from './IndexRootTabBody'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'

const ROOT_BOTTOM_TAB_BAR_SMALL_WIDTH: number = 260
const ROOT_BOTTOM_TAB_BAR_MEDIUM_WIDTH: number = 300
const ROOT_BOTTOM_TAB_BAR_LARGE_WIDTH: number = 340
const ROOT_BOTTOM_TAB_MINI_BAR_SIZE: number = 48

@Component
export struct IndexRootNavigationShell {
  @Prop theme: ThemePalette = ThemeService.currentPalette()
  @Prop rootSettings: HarmonySettings = {} as HarmonySettings
  @Prop showUnreadDot: boolean = true
  @Prop mode: SubscriptionMode = 'articles'
  @Prop homeInitialLoadPending: boolean = false
  @Prop isHomeStartupRefreshing: boolean = false
  @Prop homeLoadMoreInProgress: boolean = false
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
  @Prop showHomeTitleActions: boolean = false
  @Prop isHomeRootTab: boolean = false
  @Prop currentRootTitle: string = ''
  @Prop bindScrollers: Scroller[] = []

  controller: HdsTabsController = new HdsTabsController()
  homeCallbacks: IndexHomeRootContentCallbacks = {
    onModeSwipe: () => {},
    getDataSource: () => new ArrayLazyDataSource<EntryCardModel>(() => []),
    isModeLoading: () => false,
    isModeLoadingMore: () => false,
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
  onRootTabBarClick: (index: number) => void = () => {}
  onTabAppear: (tabId: RootTabId) => void = () => {}
  onSettingsContentScrollerReady: (scroller: Scroller) => void = () => {}
  onSettingsChange: (settings: HarmonySettings) => void = () => {}
  onThemeChange: (theme: ThemePalette) => void = () => {}
  onHomeRefresh: () => void = () => {}
  onHomeSearchOpen: () => void = () => {}
  private homeTitleMenus: HdsNavigationMenuContentOptions = {
    value: [{
      content: {
        label: '刷新',
        icon: $r('sys.symbol.arrow_clockwise'),
        isEnabled: true,
        action: () => {
          this.onHomeRefresh()
        },
      },
    }, {
      content: {
        label: '搜索',
        icon: $r('sys.symbol.magnifyingglass'),
        isEnabled: true,
        action: () => {
          this.onHomeSearchOpen()
        },
      },
    }],
  }

  @Builder
  private RootBottomMiniBarBuilder() {
    Row() {
      Image($r('app.media.ri_ai'))
        .width(20)
        .height(20)
        .objectFit(ImageFit.Contain)
        .fillColor('#7A5AF8')
    }
    .width(ROOT_BOTTOM_TAB_MINI_BAR_SIZE)
    .height(ROOT_BOTTOM_TAB_MINI_BAR_SIZE)
    .justifyContent(FlexAlign.Center)
    .alignItems(VerticalAlign.Center)
    .backgroundColor($r('sys.color.comp_background_tertiary'))
    .borderRadius(ROOT_BOTTOM_TAB_MINI_BAR_SIZE / 2)
  }

  build() {
    HdsNavigation() {
      HdsTabs({ controller: this.controller }) {
        TabContent() {
          HomeRootTabBody({
            mode: this.mode,
            renderedMode: this.renderedMode,
            previousMode: this.previousMode,
            isModeTransitioning: this.isModeTransitioning,
            modeTransitionDirection: this.modeTransitionDirection,
            theme: this.theme,
            showUnreadDot: this.showUnreadDot,
            homeInitialLoadPending: this.homeInitialLoadPending,
            isHomeStartupRefreshing: this.isHomeStartupRefreshing,
            homeLoadMoreInProgress: this.homeLoadMoreInProgress,
            homeListSwapAnimating: this.homeListSwapAnimating,
            homeListSwapMode: this.homeListSwapMode,
            homeListSwapOpacity: this.homeListSwapOpacity,
            homeContentVersion: this.homeContentVersion,
            homeCallbacks: this.homeCallbacks,
          })
        }
        .tabBar(BottomTabBarStyle.of({
          normal: this.rootTabSymbolPair('home').normal,
          selected: this.rootTabSymbolPair('home').selected,
        }, '首页'))

        TabContent() {
          IndexRootTabBody({
            tabId: 'subscriptions',
            theme: this.theme,
            rootSettings: this.rootSettings,
            showUnreadDot: this.showUnreadDot,
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
          normal: this.rootTabSymbolPair('subscriptions').normal,
          selected: this.rootTabSymbolPair('subscriptions').selected,
        }, '订阅'))

        TabContent() {
          IndexRootTabBody({
            tabId: 'discover',
            theme: this.theme,
            rootSettings: this.rootSettings,
            showUnreadDot: this.showUnreadDot,
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
          normal: this.rootTabSymbolPair('discover').normal,
          selected: this.rootTabSymbolPair('discover').selected,
        }, '发现'))

        TabContent() {
          IndexRootTabBody({
            tabId: 'settings',
            theme: this.theme,
            rootSettings: this.rootSettings,
            showUnreadDot: this.showUnreadDot,
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
          normal: this.rootTabSymbolPair('settings').normal,
          selected: this.rootTabSymbolPair('settings').selected,
        }, '设置'))
      }
      .vertical(false)
      .scrollable(false)
      .cachedMaxCount(4, TabsCacheMode.CACHE_BOTH_SIDE)
      .animationDuration(0)
      .barPosition(BarPosition.End)
      .barOverlap(true)
      .barHeight(this.hideBottomTabs ? 0 : BOTTOM_TAB_BAR_HEIGHT)
      .barFloatingStyle({
        barWidth: {
          smallWidth: ROOT_BOTTOM_TAB_BAR_SMALL_WIDTH,
          mediumWidth: ROOT_BOTTOM_TAB_BAR_MEDIUM_WIDTH,
          largeWidth: ROOT_BOTTOM_TAB_BAR_LARGE_WIDTH,
        },
        barBottomMargin: resolveHdsBottomTabBarBottomMargin(BOTTOM_TAB_FLOAT_GAP),
        miniBar: {
          miniBarBuilder: (): void => this.RootBottomMiniBarBuilder(),
          miniBarWidth: {
            smallWidth: ROOT_BOTTOM_TAB_MINI_BAR_SIZE,
            mediumWidth: ROOT_BOTTOM_TAB_MINI_BAR_SIZE,
            largeWidth: ROOT_BOTTOM_TAB_MINI_BAR_SIZE,
          },
          enableMiniBarBackground: false,
          enableMiniBarClip: true,
        },
        adaptToHandedness: true,
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
        },
      })
      .onChange((index: number) => {
        this.onRootTabChange(index)
      })
      .onTabBarClick((index: number) => {
        this.onRootTabBarClick(index)
      })
    }
    .mode(NavigationMode.Stack)
    .titleBar({
      content: {
        title: {
          mainTitle: this.isHomeRootTab ? '首页' : this.currentRootTitle,
        },
        menu: this.isHomeRootTab && this.showHomeTitleActions && !this.hideTitleBar
          ? this.homeTitleMenus
          : undefined,
      },
      style: this.isHomeRootTab ? {
        scrollEffectOpts: {
          enableScrollEffect: false,
          scrollEffectType: ScrollEffectType.GRADIENT_BLUR,
          blurEffectiveStartOffset: LengthMetrics.vp(0),
          blurEffectiveEndOffset: LengthMetrics.vp(30),
        },
        blurStrategy: BlurStrategy.ENABLE,
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
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
        scrollEffectStyle: undefined,
      } : rootTabTitleBarStyle(),
      // 首页运行在全屏窗口中，标题和菜单需要主动避让手机状态栏�?      avoidLayoutSafeArea: true,
      enableComponentSafeArea: false,
    })
    .titleMode(HdsNavigationTitleMode.MINI)
    .hideTitleBar(this.hideTitleBar)
    .hideBackButton(true)
    .bindToScrollable(this.bindScrollers)
    // 根页运行在全屏窗口中，内容需要进入顶部区域供 HDS 页头采样模糊�?    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    .width('100%')
    .height('100%')
  }
}
