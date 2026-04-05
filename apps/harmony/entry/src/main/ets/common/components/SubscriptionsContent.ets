import { AppRepository } from '../data/AppRepository'
import { AvatarTile } from './AvatarTile'
import { BottomTabs } from './BottomTabs'
import { openArticleDetail } from '../navigation/AppRouter'
import { ContentModeRail } from './ContentModeRail'
import { FeedDetailView } from './FeedDetailView'
import { FeedSubscribeConfigView } from './FeedSubscribeConfigView'
import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationTitleMode,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { BlurStrategy } from '@hms.hds.hdsBaseComponent'
import { ROOT_MODE_RAIL_TOP_GAP } from './FloatingRootPageLayout'
import { Entry, Feed, FeedCardModel, FeedViewType, toArticleDetailModel } from '../models/LivoModels'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { shouldAcceptModeSwitch } from '../utils/ModeSwitchGuard'
import {
  CARD_RADIUS_LG,
  CARD_RADIUS_MD,
  META_FONT_SIZE,
  PAGE_BOTTOM_GAP,
  LIST_ROW_DIVIDER_INSET,
  LIST_ROW_HORIZONTAL_PADDING,
  LIST_ROW_TITLE_SIZE,
  LIST_ROW_VERTICAL_PADDING,
  PAGE_HORIZONTAL_PADDING,
} from '../ui/UiTokens'

type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'
const SUBSCRIPTION_MODES: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
const MODE_SWIPE_TRIGGER_OFFSET: number = 56
const SUBSCRIPTIONS_ROUTE_FEED_DETAIL: string = 'subscriptions-feed-detail'
const SUBSCRIPTIONS_ROUTE_SUBSCRIBE_CONFIG: string = 'subscriptions-subscribe-config'
const HEADER_BLUR_SCROLL_RANGE: number = 72
const SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT: number = 56
const SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = 36
const SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER: number =
  SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT + SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT

class SubscriptionFeedDetailParams {
  feedId: string = ''
}

class SubscriptionFeedConfigParams {
  targetUrl: string = ''
  targetTitle: string = ''
  targetSiteUrl: string = ''
  targetImageUrl: string = ''
  targetDescription: string = ''
  targetCategory: string = ''
  sourceKind: string = ''
  initialSelectedView: FeedViewType = FeedViewType.Articles
}

@Component
export struct SubscriptionsContent {
  @State feeds: FeedCardModel[] = []
  @State mode: SubscriptionMode = 'articles'
  @State renderedMode: SubscriptionMode = 'articles'
  @State previousMode: SubscriptionMode = 'articles'
  @State isModeTransitioning: boolean = false
  @State modeTransitionDirection: number = 1
  @State headerBlurProgress: number = 0
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State sourceHint: string = '正在加载订阅内容...'
  @State hasLoaded: boolean = false
  @State isLoading: boolean = false
  @State overlayLevel: number = 0
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @Prop showBottomTabs: boolean = true
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  private subscriptionPathStack: NavPathStack = new NavPathStack()
  private readonly articlesScroller: Scroller = new Scroller()
  private readonly socialScroller: Scroller = new Scroller()
  private readonly picturesScroller: Scroller = new Scroller()
  private readonly videosScroller: Scroller = new Scroller()
  private headerBlurOffset: number = 0
  onReady: () => void = () => {}
  private syncOverlayLevel(level: number): void {
    this.overlayLevel = level
    AppStorage.setOrCreate('subscriptionsOverlayLevel', level)
  }

  private settleSubscriptionsRootVisible(): void {
    this.syncOverlayLevel(0)
  }

  aboutToAppear(): void {
    this.overlayLevel = this.subscriptionsOverlayLevel
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
      if (this.hasLoaded || this.isLoading) {
        this.onReady()
        return
      }
    }

    void this.loadPageData()
  }

  private async loadPageData(): Promise<void> {
    if (this.isLoading) {
      return
    }

    this.isLoading = true
    try {
      if (this.showBottomTabs) {
        const settings = await AppRepository.settings()
        this.theme = await ThemeService.resolvePalette(settings)
      } else {
        this.theme = this.inheritedTheme
      }

      this.feeds = await AppRepository.feeds()
      this.sourceHint = '已加载本地订阅内容'
      this.hasLoaded = true
      this.onReady()
    } finally {
      this.isLoading = false
    }
  }

  private async refreshFeeds(): Promise<void> {
    this.feeds = await AppRepository.feeds()
    this.sourceHint = '已加载本地订阅内容'
    this.hasLoaded = true
  }

  private syncInheritedTheme(): void {
    if (!this.showBottomTabs) {
      this.theme = this.inheritedTheme
    }
  }

  private updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    this.headerBlurOffset = clampedOffset
    this.headerBlurProgress = clampedOffset / HEADER_BLUR_SCROLL_RANGE
  }

  private handleHeaderBlurScrollDelta(delta: number): void {
    this.updateHeaderBlurProgress(this.headerBlurOffset + delta)
  }

  private scrollerForMode(mode: SubscriptionMode): Scroller {
    switch (mode) {
      case 'social':
        return this.socialScroller
      case 'pictures':
        return this.picturesScroller
      case 'videos':
        return this.videosScroller
      default:
        return this.articlesScroller
    }
  }

  private handleFeedsChanged(): void {
    void this.refreshFeeds()
  }

  private rootEnterTransition(delay: number): TransitionEffect {
    return this.showBottomTabs ? livoMotion.enterScale(delay) : TransitionEffect.IDENTITY
  }

  @Builder
  private SubscriptionsLowerTitleBuilder() {
    Row() {
      Text('订阅')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ top: -20 })
    }
    .width('100%')
    .height(SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Center)
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING })
  }

  private headerTitle(mode: SubscriptionMode = this.mode): string {
    switch (mode) {
      case 'social':
        return '社交'
      case 'pictures':
        return '图片'
      case 'videos':
        return '视频'
      default:
        return '文章'
    }
  }

  private modeLabel(mode: SubscriptionMode = this.mode): string {
    return this.headerTitle(mode)
  }

  private filteredFeedsFor(mode: SubscriptionMode): FeedCardModel[] {
    return this.feeds.filter((feed: FeedCardModel) => feed.viewLabel === this.modeLabel(mode))
  }

  private filteredFeeds(): FeedCardModel[] {
    return this.filteredFeedsFor(this.mode)
  }

  private modeIndex(mode: SubscriptionMode): number {
    return SUBSCRIPTION_MODES.indexOf(mode)
  }

  private requestModeSwitch(nextMode: SubscriptionMode): void {
    if (!shouldAcceptModeSwitch({
      currentMode: this.mode,
      nextMode,
      isTransitioning: this.isModeTransitioning,
    })) {
      return
    }

    this.mode = nextMode
    this.startModeTransition(nextMode)
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    this.modeTransitionDirection = this.modeIndex(nextMode) > this.modeIndex(this.renderedMode) ? 1 : -1
    this.previousMode = nextMode
    this.renderedMode = nextMode
    this.isModeTransitioning = false
  }

  private adjacentMode(offsetX: number): SubscriptionMode | undefined {
    const currentIndex = this.modeIndex(this.mode)
    if (currentIndex < 0) {
      return undefined
    }

    const nextIndex = offsetX < 0 ? currentIndex + 1 : currentIndex - 1
    if (nextIndex < 0 || nextIndex >= SUBSCRIPTION_MODES.length) {
      return undefined
    }

    return SUBSCRIPTION_MODES[nextIndex]
  }

  private handleModeSwipe(event: GestureEvent): void {
    if (this.isModeTransitioning) {
      return
    }

    const offsetX = event.offsetX
    const offsetY = event.offsetY
    if (Math.abs(offsetX) < MODE_SWIPE_TRIGGER_OFFSET || Math.abs(offsetX) <= Math.abs(offsetY)) {
      return
    }

    const nextMode = this.adjacentMode(offsetX)
    if (nextMode) {
      this.requestModeSwitch(nextMode)
    }
  }

  private modeSceneVisible(mode: SubscriptionMode): Visibility {
    if (mode === this.renderedMode) {
      return Visibility.Visible
    }

    if (this.isModeTransitioning && mode === this.previousMode) {
      return Visibility.Visible
    }

    return Visibility.Hidden
  }

  private modeSceneOpacity(mode: SubscriptionMode): number {
    return mode === this.renderedMode ? 1 : 0
  }

  private modeSceneOffset(mode: SubscriptionMode): number {
    if (mode === this.renderedMode) {
      return 0
    }

    if (!this.isModeTransitioning || mode !== this.previousMode) {
      return 0
    }

    return this.modeTransitionDirection > 0 ? -16 : 16
  }

  private modeSceneZIndex(mode: SubscriptionMode): number {
    if (mode === this.renderedMode) {
      return 2
    }

    if (this.isModeTransitioning && mode === this.previousMode) {
      return 1
    }

    return 0
  }

  private deriveFallbackIcon(siteUrl: string): string {
    const trimmed = siteUrl.trim()
    if (!trimmed) {
      return ''
    }

    try {
      const protocolMatch = trimmed.match(/^(https?:)/)
      const protocol = protocolMatch ? protocolMatch[1] : 'https:'
      const withoutProtocol = trimmed.replace(/^https?:\/\//, '')
      const host = withoutProtocol.split('/')[0]
      return `${protocol}//${host}/favicon.ico`
    } catch (_) {
      return ''
    }
  }

  private iconSource(feed: FeedCardModel | undefined): string {
    if (!feed) {
      return ''
    }

    if (feed.imageUrl.trim().length > 0) {
      return feed.imageUrl.trim()
    }

    return this.deriveFallbackIcon(feed.siteUrl)
  }

  @Builder
  private FeedAvatar(feed: FeedCardModel | undefined) {
    AvatarTile({
      imageUrl: this.iconSource(feed),
      fallbackLabel: feed ? feed.title : 'Livo',
      accent: this.theme.elevated,
      theme: this.theme,
      avatarSize: 22,
      radius: 6,
      textSize: 11,
    })
  }

  @Builder
  private FeedRow(feed: FeedCardModel, index: number, showDivider: boolean) {
    Column() {
      Row({ space: 12 }) {
        this.FeedAvatar(feed)

        Column({ space: 4 }) {
          Text(feed.title)
            .fontSize(LIST_ROW_TITLE_SIZE)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          Text(feed.siteUrl.replace(/^https?:\/\//, ''))
            .fontSize(META_FONT_SIZE)
            .fontColor(this.theme.textSecondary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)

        Row()
          .width(4)
          .height(4)
          .borderRadius(999)
          .backgroundColor(this.theme.textMuted)
      }
      .width('100%')
      .height(62)
      .padding({ left: LIST_ROW_HORIZONTAL_PADDING, right: LIST_ROW_HORIZONTAL_PADDING, top: LIST_ROW_VERTICAL_PADDING, bottom: LIST_ROW_VERTICAL_PADDING })
      .clickEffect({ level: ClickEffectLevel.MIDDLE })
      .onClick(() => {
        this.openFeedDetailPage(feed.id)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: LIST_ROW_DIVIDER_INSET, right: LIST_ROW_DIVIDER_INSET })
      }
    }
    .width('100%')
    .transition(this.rootEnterTransition(index * 18 + 30))
  }

  @Builder
  private FeedSection(mode: SubscriptionMode) {
    Column({ space: 0 }) {
      Blank()
        .height(SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER)

      Column({ space: ROOT_MODE_RAIL_TOP_GAP }) {
        Row()
          .width('100%')
          .height(0)

        Column() {
          ContentModeRail({
            mode: this.mode,
            theme: this.theme,
            interactionLocked: this.isModeTransitioning,
            enableEnterTransition: false,
            onChange: (mode: SubscriptionMode) => {
              this.requestModeSwitch(mode)
            },
          })
        }
        .width('100%')
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .alignItems(HorizontalAlign.Start)

      Column({ space: 20 }) {
        if (this.filteredFeedsFor(mode).length === 0) {
          Column({ space: 10 }) {
            Text(`您还没有收藏任何${this.headerTitle(mode)}源`)
              .fontSize(18)
              .fontWeight(FontWeight.Bold)
              .fontColor(this.theme.textPrimary)

            Text('先添加对应类型的订阅源，或者刷新现有订阅后再回来看看。')
              .fontSize(14)
              .lineHeight(22)
              .fontColor(this.theme.textSecondary)
          }
          .width('100%')
          .alignItems(HorizontalAlign.Start)
          .padding(18)
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_MD)
          .border({ width: 0.8, color: this.theme.divider })
          .transition(this.rootEnterTransition(70))
        } else {
          Column() {
            ForEach(this.filteredFeedsFor(mode), (feed: FeedCardModel, index: number) => {
              this.FeedRow(
                feed,
                index,
                index < this.filteredFeedsFor(mode).length - 1,
              )
            }, (feed: FeedCardModel) => feed.id)
          }
          .width('100%')
          .backgroundColor(this.theme.surface)
          .borderRadius(CARD_RADIUS_LG)
          .border({ width: 0.8, color: this.theme.divider })
          .clip(true)
          .transition(this.rootEnterTransition(70))
        }

        Row().height(88).width('100%')
      }
      .width('100%')
      .padding({ top: 12 })

    }
    .width('100%')
    .alignItems(HorizontalAlign.Start)
    .justifyContent(FlexAlign.Start)
    .constraintSize({ minHeight: '100%' })
    .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 0, bottom: PAGE_BOTTOM_GAP })
  }

  @Builder
  private ModeFeedsScene(mode: SubscriptionMode) {
    Scroll(this.scrollerForMode(mode)) {
      this.FeedSection(mode)
    }
    .width('100%')
    .height('100%')
    .nestedScroll({
      scrollForward: NestedScrollMode.SELF_FIRST,
      scrollBackward: NestedScrollMode.SELF_FIRST,
    })
    .scrollBar(BarState.Off)
    .edgeEffect(EdgeEffect.Spring)
    .onWillScroll((scrollOffset: number, _scrollSource: ScrollSource, _scrollState: ScrollState) => {
      this.handleHeaderBlurScrollDelta(scrollOffset)
    })
    .visibility(this.modeSceneVisible(mode))
    .opacity(this.modeSceneOpacity(mode))
    .translate({ x: this.modeSceneOffset(mode) })
    .zIndex(this.modeSceneZIndex(mode))
  }

  private openFeedDetailPage(feedId: string): void {
    const params = new SubscriptionFeedDetailParams()
    params.feedId = feedId
    this.syncOverlayLevel(1)
    this.subscriptionPathStack.pushPathByName(SUBSCRIPTIONS_ROUTE_FEED_DETAIL, params, true)
  }

  private closeFeedDetailPage(): void {
    this.syncOverlayLevel(0)
    this.subscriptionPathStack.pop(true)
  }

  private createFeedConfigParams(feed: Feed): SubscriptionFeedConfigParams {
    const params = new SubscriptionFeedConfigParams()
    params.targetUrl = feed.url
    params.targetTitle = feed.title
    params.targetSiteUrl = feed.siteUrl || ''
    params.targetImageUrl = feed.imageUrl || ''
    params.targetDescription = feed.description || ''
    params.targetCategory = feed.category || ''
    params.sourceKind = '编辑'
    params.initialSelectedView = feed.view as FeedViewType
    return params
  }

  private openEditPage(feed: Feed): void {
    this.syncOverlayLevel(2)
    this.subscriptionPathStack.pushPathByName(
      SUBSCRIPTIONS_ROUTE_SUBSCRIBE_CONFIG,
      this.createFeedConfigParams(feed),
      true,
    )
  }

  private openEntryDetail(entry: Entry, feed: Feed): void {
    const model = toArticleDetailModel(entry, feed)
    void openArticleDetail(entry.id || feed.id || 'entry', JSON.stringify(model))
  }

  @Builder
  private FeedDetailDestination(params?: SubscriptionFeedDetailParams) {
    FeedDetailView({
      feedId: params?.feedId ?? '',
      theme: this.theme,
      onBack: () => { this.closeFeedDetailPage() },
      onEdit: (feed: Feed) => { this.openEditPage(feed) },
      onSubscribe: (_payload: FeedRefreshPayload) => {},
      onOpenArticle: (entry: Entry, feed: Feed) => { this.openEntryDetail(entry, feed) },
    })
    .onAppear(() => {
      this.syncOverlayLevel(1)
    })
    .onDisAppear(() => {
      const currentLevel = AppStorage.get<number>('subscriptionsOverlayLevel') ?? 0
      if (currentLevel <= 1) {
        this.syncOverlayLevel(0)
      }
    })
  }

  @Builder
  private FeedSubscribeConfigDestination(params?: SubscriptionFeedConfigParams) {
    FeedSubscribeConfigView({
      targetUrl: params?.targetUrl ?? '',
      targetTitle: params?.targetTitle ?? '',
      targetSiteUrl: params?.targetSiteUrl ?? '',
      targetImageUrl: params?.targetImageUrl ?? '',
      targetDescription: params?.targetDescription ?? '',
      targetCategory: params?.targetCategory ?? '',
      sourceKind: params?.sourceKind ?? '',
      initialSelectedView: params?.initialSelectedView ?? FeedViewType.Articles,
      theme: this.theme,
      onBack: () => {
        this.syncOverlayLevel(1)
        this.subscriptionPathStack.pop(true)
      },
      onSubscribed: async () => {
        await this.refreshFeeds()
        this.syncOverlayLevel(0)
        this.subscriptionPathStack.clear()
      },
      onSaved: async () => {
        await this.refreshFeeds()
        this.syncOverlayLevel(1)
        this.subscriptionPathStack.pop(true)
      },
      onUnsubscribed: async () => {
        await this.refreshFeeds()
        this.syncOverlayLevel(0)
        this.subscriptionPathStack.clear()
      },
    })
    .onAppear(() => {
      this.syncOverlayLevel(2)
    })
    .onDisAppear(() => {
      const currentLevel = AppStorage.get<number>('subscriptionsOverlayLevel') ?? 0
      if (currentLevel > 1) {
        this.syncOverlayLevel(1)
      } else {
        this.syncOverlayLevel(currentLevel)
      }
    })
  }

  @Builder
  private Destinations(name: string, params?: SubscriptionFeedDetailParams | SubscriptionFeedConfigParams) {
    if (name === SUBSCRIPTIONS_ROUTE_FEED_DETAIL) {
      NavDestination() {
        this.FeedDetailDestination(params as SubscriptionFeedDetailParams)
      }
      .hideTitleBar(true)
    } else if (name === SUBSCRIPTIONS_ROUTE_SUBSCRIBE_CONFIG) {
      NavDestination() {
        this.FeedSubscribeConfigDestination(params as SubscriptionFeedConfigParams)
      }
      .hideTitleBar(true)
    }
  }

  @Builder
  private SubscriptionsRoot() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack() {
        this.ModeFeedsScene('articles')
        this.ModeFeedsScene('social')
        this.ModeFeedsScene('pictures')
        this.ModeFeedsScene('videos')
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
      .gesture(
        PanGesture({ direction: PanDirection.Horizontal })
          .onActionEnd((event: GestureEvent) => {
            this.handleModeSwipe(event)
          })
      )

      if (this.showBottomTabs && this.overlayLevel === 0) {
        BottomTabs({ activeTab: 'subscriptions', theme: this.theme })
          .align(Alignment.Bottom)
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .onAppear(() => {
      this.settleSubscriptionsRootVisible()
    })
  }

  build() {
    if (this.showBottomTabs) {
      Navigation(this.subscriptionPathStack) {
        this.SubscriptionsRoot()
      }
      .hideToolBar(true)
      .hideTitleBar(true)
      .hideBackButton(true)
      .mode(NavigationMode.Stack)
      .navDestination(this.Destinations)
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    } else {
      HdsNavigation() {
        Navigation(this.subscriptionPathStack) {
          this.SubscriptionsRoot()
        }
        .hideToolBar(true)
        .hideTitleBar(true)
        .hideBackButton(true)
        .mode(NavigationMode.Stack)
        .navDestination(this.Destinations)
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme.background)
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
              maskExtraHeight: 134,
              blurRadius: 42,
            },
            contentStyle: {
              titleStyle: {
                mainTitleColor: $r('sys.color.font_primary'),
                subTitleColor: $r('sys.color.font_secondary'),
              },
            },
          },
          scrollEffectStyle: {
            backgroundStyle: {
              backgroundColor: '#00000000',
              maskExtraHeight: 138,
              blurRadius: 42,
            },
            contentStyle: {
              titleStyle: {
                mainTitleColor: $r('sys.color.font_primary'),
                subTitleColor: $r('sys.color.font_secondary'),
              },
            },
          },
        },
        content: {
          title: {
            mainTitle: '',
          },
          bottomBuilder: {
            builder: (): void => this.SubscriptionsLowerTitleBuilder(),
          },
        },
      })
      .titleMode(HdsNavigationTitleMode.MINI)
      .hideTitleBar(this.overlayLevel > 0)
      .hideBackButton(true)
      .bindToScrollable([
        this.articlesScroller,
        this.socialScroller,
        this.picturesScroller,
        this.videosScroller,
      ])
      .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.BOTTOM])
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    }
  }
}
