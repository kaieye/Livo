import { Entry, Feed, FeedCardModel, FeedViewType, toArticleDetailModel } from '../models/LivoModels'
import { openArticleDetail } from '../navigation/AppRouter'
import { FeedRepository } from '../repositories/FeedRepository'
import { feedCardFromFeed } from '../data/AppRepositoryEntryHelpers'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'


import {
  SubscriptionsAvatarHydrationCoordinator,
} from '../utils/subscriptions/SubscriptionsAvatarHydrationCoordinator'
import { SubscriptionMode, HOME_MODE_SCENE_TOP_INSET } from './HomeRootConfig'
import { resolveSubscriptionModeLabel } from '../utils/subscriptions/SubscriptionsModePresentation'
import { SubscriptionsFeedListSection } from './SubscriptionsFeedListSection'
import { SubscriptionsOverlayLayer } from './SubscriptionsOverlayLayer'
import {
  HEADER_BLUR_SCROLL_RANGE,
  SUBSCRIPTIONS_REFRESH_DIAG_PREFIX,
  SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER,
  SubscriptionFeedConfigParams,
  SubscriptionFeedDetailParams,
} from './SubscriptionsConstants'
import {
  ROOT_TAB_SCROLL_TO_TOP_AT_KEY,
  ROOT_TAB_SCROLL_TO_TOP_TAB_KEY,
  scrollScrollerToTop,
} from '../utils/index-home/RootTabScrollToTopSignal'

@Component
export struct SubscriptionsContent {
  @State feeds: FeedCardModel[] = []
  @Prop @Watch('onModeChanged') mode: SubscriptionMode = 'articles'
  @State headerBlurProgress: number = 0
  @State theme: ThemePalette = ThemeService.currentPalette()
  @State sourceHint: string = '正在加载订阅内容...'
  @State hasLoaded: boolean = false
  @State isLoading: boolean = false
  @State overlayLevel: number = 0
  @State activeFeedDetailParams: SubscriptionFeedDetailParams | undefined = undefined
  @State activeFeedConfigParams: SubscriptionFeedConfigParams | undefined = undefined
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0
  @StorageProp(ROOT_TAB_SCROLL_TO_TOP_AT_KEY) @Watch('handleRootTabScrollToTopSignal') rootTabScrollToTopAt: number = 0
  @StorageProp(ROOT_TAB_SCROLL_TO_TOP_TAB_KEY) rootTabScrollToTopTab: string = ''
  @StorageProp('subscriptionsOverlayBackAt') @Watch('handleOverlayBackSignal') subscriptionsOverlayBackAt: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  scroller: Scroller = new Scroller()
  private readonly hydratedFeedIds: Set<string> = new Set()
  private headerBlurOffset: number = 0
  private avatarCoordinator: SubscriptionsAvatarHydrationCoordinator =
    new SubscriptionsAvatarHydrationCoordinator(this)
  onReady: () => void = () => {}
  private subscriptionsScrollOffset: number = 0

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

  private filteredFeeds(): FeedCardModel[] {
    const targetView = this.modeToFeedViewType(this.mode)
    return this.feeds.filter((f: FeedCardModel) => f.view === targetView)
  }

  private modeToFeedViewType(mode: SubscriptionMode): FeedViewType {
    switch (mode) {
      case 'social': return FeedViewType.SocialMedia
      case 'pictures': return FeedViewType.Pictures
      case 'videos': return FeedViewType.Videos
      default: return FeedViewType.Articles
    }
  }

  private modeEmptyTitle(): string {
    return resolveSubscriptionModeLabel(this.mode)
  }

  private prevMode: SubscriptionMode = 'articles'

  private onModeChanged(): void {
    if (this.mode === this.prevMode) {
      return
    }
    this.prevMode = this.mode
    scrollScrollerToTop(this.scroller, '订阅')
  }

  aboutToAppear(): void {
    this.overlayLevel = this.subscriptionsOverlayLevel
    this.theme = this.inheritedTheme

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
    this.logSubscriptionsDiag(`load start`)
    try {
      this.avatarCoordinator.bumpToken()
      this.theme = this.inheritedTheme

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
    this.theme = this.inheritedTheme
  }

  private updateHeaderBlurProgress(offset: number): void {
    const clampedOffset = Math.max(0, Math.min(offset, HEADER_BLUR_SCROLL_RANGE))
    this.headerBlurOffset = clampedOffset
    this.headerBlurProgress = clampedOffset / HEADER_BLUR_SCROLL_RANGE
  }

  private handleHeaderBlurScrollDelta(delta: number): void {
    this.updateHeaderBlurProgress(this.headerBlurOffset + delta)
    const nextOffset = this.readSubscriptionsScrollOffset()
    const previousOffset = this.subscriptionsScrollOffset
    this.subscriptionsScrollOffset = nextOffset

    const isReturningTowardsTop = nextOffset + 0.5 < previousOffset
    const isScrollingDeeper = nextOffset > previousOffset + 0.5

    if (isReturningTowardsTop) {
      if (this.subscriptionsRailDismissedByScroll) {
        this.subscriptionsRailDismissedByScroll = false
        AppStorage.setOrCreate<number>('subscriptionsRailDismissProgress', 0)
        this.lastRailShownAt = Date.now()
      }
    } else if (isScrollingDeeper && nextOffset >= 48) {
      if (!this.subscriptionsRailDismissedByScroll && Date.now() - this.lastRailShownAt >= 200) {
        this.subscriptionsRailDismissedByScroll = true
        AppStorage.setOrCreate<number>('subscriptionsRailDismissProgress', 1)
      }
    }
  }

  private readSubscriptionsScrollOffset(): number {
    try {
      return Math.max(0, this.scroller.currentOffset().yOffset)
    } catch (_) {
      return this.subscriptionsScrollOffset
    }
  }

  private subscriptionsRailDismissedByScroll: boolean = false
  private lastRailShownAt: number = 0

  private handleOverlayBackSignal(): void {
    if (this.overlayLevel >= 2 && this.activeFeedConfigParams) {
      this.activeFeedConfigParams = undefined
      this.syncOverlayState(1)
    } else {
      this.closeFeedDetailPage()
    }
  }

  private handleFeedsChanged(): void {
    this.logSubscriptionsDiag(`feedsChanged received count=${this.feeds.length} loading=${this.isLoading}`)
    void this.refreshFeeds()
  }

  private handleRootTabScrollToTopSignal(): void {
    if (this.rootTabScrollToTopTab !== 'subscriptions' || this.overlayLevel > 0) {
      return
    }

    this.updateHeaderBlurProgress(0)
    scrollScrollerToTop(this.scroller, '订阅')
  }

  private syncOverlayState(level: number): void {
    this.syncOverlayLevel(level)
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
  private SubscriptionsRoot() {
    Stack({ alignContent: Alignment.TopStart }) {
      SubscriptionsFeedListSection({
        feeds: this.filteredFeeds(),
        theme: this.theme,
        emptyTitle: this.modeEmptyTitle(),
        additionalTopSpacer: HOME_MODE_SCENE_TOP_INSET - SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER,
        enableRootEnterTransition: false,
        scroller: this.scroller,
        onFeedClick: (feedId: string) => { this.openFeedDetailPage(feedId) },
        onScrollDelta: (yOffset: number) => { this.handleHeaderBlurScrollDelta(yOffset) },
      })

      this.OverlayHost()
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
    this.SubscriptionsRoot()
  }
}
