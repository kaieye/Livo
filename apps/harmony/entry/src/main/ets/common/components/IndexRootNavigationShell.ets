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
import { rootTabTitleBarStyle } from '../utils/IndexRootChrome'
import { RootTabId } from '../navigation/AppRouter'
import { Entry, EntryCardModel, HarmonySettings } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import {
  BOTTOM_TAB_BAR_HEIGHT,
  BOTTOM_TAB_FLOAT_GAP,
} from '../ui/UiTokens'
import {
  HdsBottomTabId,
  HdsBottomTabItem,
  resolveHdsBottomTabBarBottomMargin,
  resolveHdsBottomTabItems,
} from '../utils/HdsBottomTabConfig'
import {
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
              homeLoadMoreInProgress: this.homeLoadMoreInProgress,
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
      // 首页运行在全屏窗口中，标题和菜单需要主动避让手机状态栏。
      avoidLayoutSafeArea: true,
      enableComponentSafeArea: false,
    })
    .titleMode(HdsNavigationTitleMode.MINI)
    .hideTitleBar(this.hideTitleBar)
    .hideBackButton(true)
    .bindToScrollable(this.bindScrollers)
    // 根页运行在全屏窗口中，内容需要进入顶部区域供 HDS 页头采样模糊。
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    .width('100%')
    .height('100%')
  }
}
