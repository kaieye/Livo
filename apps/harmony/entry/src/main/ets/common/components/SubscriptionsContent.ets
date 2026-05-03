import { Entry, Feed, FeedCardModel, FeedViewType, toArticleDetailModel } from '../models/LivoModels'
import { openArticleDetail } from '../navigation/AppRouter'
import { FeedRepository } from '../repositories/FeedRepository'
import { feedCardFromFeed } from '../data/AppRepositoryEntryHelpers'
import { SettingsStore } from '../services/SettingsStore'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { BottomTabs } from './BottomTabs'
import {
  ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import {
  SubscriptionsAvatarHydrationCoordinator,
} from '../utils/SubscriptionsAvatarHydrationCoordinator'
import {
  resolveSubscriptionModeLabel,
  resolveSubscriptionSwipeTarget,
  subscriptionModeIndex,
} from '../utils/SubscriptionsModePresentation'
import { SubscriptionsFeedListSection } from './SubscriptionsFeedListSection'
import { SubscriptionsHdsNavigationShell } from './SubscriptionsHdsNavigationShell'
import { SubscriptionsOverlayLayer } from './SubscriptionsOverlayLayer'
import {
  HEADER_BLUR_SCROLL_RANGE,
  SUBSCRIPTIONS_REFRESH_DIAG_PREFIX,
  SubscriptionFeedConfigParams,
  SubscriptionFeedDetailParams,
  SubscriptionMode,
} from './SubscriptionsConstants'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'

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
  @State activeFeedDetailParams: SubscriptionFeedDetailParams | undefined = undefined
  @State activeFeedConfigParams: SubscriptionFeedConfigParams | undefined = undefined
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @Prop showBottomTabs: boolean = true
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  private readonly articlesScroller: Scroller = new Scroller()
  private readonly socialScroller: Scroller = new Scroller()
  private readonly picturesScroller: Scroller = new Scroller()
  private readonly videosScroller: Scroller = new Scroller()
  private readonly hydratedFeedIds: Set<string> = new Set()
  private headerBlurOffset: number = 0
  private avatarCoordinator: SubscriptionsAvatarHydrationCoordinator =
    new SubscriptionsAvatarHydrationCoordinator(this)
  onReady: () => void = () => {}

  isFeedHydrated(feedId: string): boolean {
    return this.hydratedFeedIds.has(feedId)
  }

  markFeedHydrated(feedId: string): void {
    this.hydratedFeedIds.add(feedId)
  }

  logHydrationDiag(message: string): void {
    this.logSubscriptionsDiag(message)
  }

  private logSubscriptionsDiag(message: string): void {
    console.info(`${SUBSCRIPTIONS_REFRESH_DIAG_PREFIX} ${message}`)
  }

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
    }

    if (this.hasLoaded || this.isLoading) {
      this.onReady()
      return
    }

    void this.loadPageData()
  }

  private async loadPageData(): Promise<void> {
    if (this.isLoading) {
      return
    }

    this.isLoading = true
    const startedAt = Date.now()
    this.logSubscriptionsDiag(`load start showBottomTabs=${this.showBottomTabs} mode=${this.mode}`)
    try {
      this.avatarCoordinator.bumpToken()
      if (this.showBottomTabs) {
        const settings = await SettingsStore.load()
        this.theme = await ThemeService.resolvePalette(settings)
      } else {
        this.theme = this.inheritedTheme
      }

      const feedList = await FeedRepository.list()
      this.feeds = feedList.map((f: Feed) => feedCardFromFeed(f))
      this.sourceHint = '已加载本地订阅内容'
      this.hasLoaded = true
      this.onReady()
      this.logSubscriptionsDiag(`load feeds done elapsedMs=${Date.now() - startedAt} count=${this.feeds.length}`)
      void this.avatarCoordinator.run()
    } finally {
      this.isLoading = false
    }
  }

  private async refreshFeeds(): Promise<void> {
    const startedAt = Date.now()
    this.avatarCoordinator.bumpToken()
    const feedList = await FeedRepository.list()
    this.feeds = feedList.map((f: Feed) => feedCardFromFeed(f))
    this.sourceHint = '已加载本地订阅内容'
    this.hasLoaded = true
    this.logSubscriptionsDiag(`refresh done elapsedMs=${Date.now() - startedAt} count=${this.feeds.length}`)
    void this.avatarCoordinator.run()
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

  private handleFeedsChanged(): void {
    this.logSubscriptionsDiag(`feedsChanged received count=${this.feeds.length} loading=${this.isLoading} mode=${this.mode}`)
    void this.refreshFeeds()
  }

  private syncOverlayState(level: number): void {
    this.syncOverlayLevel(level)
  }

  @Builder
  private SubscriptionsLowerTitleBuilder() {
    Row() {
      Text('订阅')
        .fontSize(ROOT_PAGE_PRIMARY_TITLE_FONT_SIZE)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
  }

  private filteredFeedsFor(mode: SubscriptionMode): FeedCardModel[] {
    const label = resolveSubscriptionModeLabel(mode)
    return this.feeds.filter((feed: FeedCardModel) => feed.viewLabel === label)
  }

  private requestModeSwitch(nextMode: SubscriptionMode): void {
    this.mode = nextMode
    this.startModeTransition(nextMode)
    this.avatarCoordinator.markPending()
    void this.avatarCoordinator.run()
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    this.modeTransitionDirection =
      subscriptionModeIndex(nextMode) > subscriptionModeIndex(this.renderedMode) ? 1 : -1
    this.previousMode = this.renderedMode
    this.renderedMode = nextMode
    this.isModeTransitioning = false
  }

  private handleModeSwipe(event: GestureEvent): void {
    const target = resolveSubscriptionSwipeTarget({
      currentMode: this.mode,
      isTransitioning: this.isModeTransitioning,
      offsetX: event.offsetX,
      offsetY: event.offsetY,
    })
    if (target) {
      this.requestModeSwitch(target)
    }
  }

  private openFeedDetailPage(feedId: string): void {
    const params = new SubscriptionFeedDetailParams()
    params.feedId = feedId
    this.activeFeedDetailParams = params
    this.activeFeedConfigParams = undefined
    this.syncOverlayState(1)
  }

  private closeFeedDetailPage(): void {
    this.activeFeedDetailParams = undefined
    this.activeFeedConfigParams = undefined
    this.syncOverlayState(0)
    this.hydratedFeedIds.clear()
    void this.refreshFeeds()
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
    this.activeFeedConfigParams = this.createFeedConfigParams(feed)
    this.syncOverlayState(2)
  }

  private openEntryDetail(entry: Entry, feed: Feed): void {
    const model = toArticleDetailModel(entry, feed)
    void openArticleDetail(entry.id || feed.id || 'entry', JSON.stringify(model))
  }

  @Builder
  private OverlayHost() {
    SubscriptionsOverlayLayer({
      activeFeedDetailParams: this.activeFeedDetailParams,
      activeFeedConfigParams: this.activeFeedConfigParams,
      theme: this.theme,
      onCloseDetail: () => { this.closeFeedDetailPage() },
      onEditFeed: (feed: Feed) => { this.openEditPage(feed) },
      onSubscribeFromDetail: (_payload: FeedRefreshPayload) => {},
      onOpenArticle: (entry: Entry, feed: Feed) => { this.openEntryDetail(entry, feed) },
      onConfigBack: () => {
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(1)
      },
      onConfigSubscribed: async () => {
        await this.refreshFeeds()
        this.activeFeedDetailParams = undefined
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(0)
      },
      onConfigSaved: async () => {
        await this.refreshFeeds()
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(1)
      },
      onConfigUnsubscribed: async () => {
        await this.refreshFeeds()
        this.activeFeedDetailParams = undefined
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(0)
      },
    })
  }

  @Builder
  private ModeScene(sceneMode: SubscriptionMode, scroller: Scroller) {
    SubscriptionsFeedListSection({
      sceneMode,
      activeMode: this.mode,
      feeds: this.filteredFeedsFor(sceneMode),
      theme: this.theme,
      interactionLocked: this.isModeTransitioning,
      emptyTitle: resolveSubscriptionModeLabel(sceneMode),
      enableRootEnterTransition: this.showBottomTabs,
      scroller,
      onModeChange: (mode: SubscriptionMode) => { this.requestModeSwitch(mode) },
      onFeedClick: (feedId: string) => { this.openFeedDetailPage(feedId) },
      onScrollDelta: (yOffset: number) => { this.handleHeaderBlurScrollDelta(yOffset) },
    })
  }

  @Builder
  private SubscriptionsRoot() {
    Stack({ alignContent: Alignment.TopStart }) {
      Stack() {
        this.ModeScene('articles', this.articlesScroller)
        this.ModeScene('social', this.socialScroller)
        this.ModeScene('pictures', this.picturesScroller)
        this.ModeScene('videos', this.videosScroller)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
      .gesture(
        PanGesture({ direction: PanDirection.Horizontal })
          .onActionEnd((event: GestureEvent) => { this.handleModeSwipe(event) })
      )

      this.OverlayHost()

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
      if (this.hasLoaded && !this.activeFeedDetailParams && !this.activeFeedConfigParams) {
        this.hydratedFeedIds.clear()
        void this.refreshFeeds()
      }
    })
  }

  build() {
    if (this.showBottomTabs) {
      this.SubscriptionsRoot()
    } else {
      SubscriptionsHdsNavigationShell({
        hideTitleBar: this.overlayLevel > 0,
        theme: this.theme,
        bindScrollers: [
          this.articlesScroller,
          this.socialScroller,
          this.picturesScroller,
          this.videosScroller,
        ],
        content: () => { this.SubscriptionsRoot() },
        lowerTitle: () => { this.SubscriptionsLowerTitleBuilder() },
      })
    }
  }
}
