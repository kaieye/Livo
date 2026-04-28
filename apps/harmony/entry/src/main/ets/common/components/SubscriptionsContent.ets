import { AppRepository } from '../data/AppRepository'
import { curves } from '@kit.ArkUI'
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
import {
  ROOT_MODE_RAIL_TOP_GAP,
  ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT,
  ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
  ROOT_PAGE_MODE_TOP_OFFSET,
  ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET,
} from './FloatingRootPageLayout'
import { Entry, Feed, FeedCardModel, FeedViewType, toArticleDetailModel } from '../models/LivoModels'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { shouldAcceptModeSwitch } from '../utils/ModeSwitchGuard'
import { resolveSocialFeedDisplayImageUrl, resolveSocialFeedDisplayTitle } from '../utils/SocialFeedPresentation'
import { extractXUsername, extractInstagramUsername } from '../utils/SocialFeedTitles'
import { bumpFeedsChangedSignal } from '../utils/FeedChangeSignal'
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
const HEADER_BLUR_SCROLL_RANGE: number = 72
const SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT: number = 56
const SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
const SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER: number =
  SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT + SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET
const SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT: number = 12
const SUBSCRIPTIONS_REFRESH_DIAG_PREFIX: string = '[SubscriptionsDiag]'

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
  @State activeFeedDetailParams?: SubscriptionFeedDetailParams = undefined
  @State activeFeedConfigParams?: SubscriptionFeedConfigParams = undefined
  @StorageProp('subscriptionsOverlayLevel') subscriptionsOverlayLevel: number = 0
  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0
  @Prop showBottomTabs: boolean = true
  @Prop @Watch('syncInheritedTheme') inheritedTheme: ThemePalette = ThemeService.currentPalette()
  private readonly articlesScroller: Scroller = new Scroller()
  private readonly socialScroller: Scroller = new Scroller()
  private readonly picturesScroller: Scroller = new Scroller()
  private readonly videosScroller: Scroller = new Scroller()
  private headerBlurOffset: number = 0
  private avatarHydrationToken: number = 0
  private avatarHydrationRunning: boolean = false
  private avatarHydrationPending: boolean = false
  private readonly hydratedFeedIds: Set<string> = new Set()
  onReady: () => void = () => {}

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
      this.avatarHydrationToken += 1
      if (this.showBottomTabs) {
        const settings = await AppRepository.settings()
        this.theme = await ThemeService.resolvePalette(settings)
      } else {
        this.theme = this.inheritedTheme
      }

      this.feeds = await AppRepository.feedsFast()
      this.sourceHint = '已加载本地订阅内容'
      this.hasLoaded = true
      this.onReady()
      this.logSubscriptionsDiag(`load feeds done elapsedMs=${Date.now() - startedAt} count=${this.feeds.length}`)
      void this.hydrateFeedAvatarsInBackground()
    } finally {
      this.isLoading = false
    }
  }

  private async refreshFeeds(): Promise<void> {
    const startedAt = Date.now()
    this.avatarHydrationToken += 1
    this.feeds = await AppRepository.feedsFast()
    this.sourceHint = '已加载本地订阅内容'
    this.hasLoaded = true
    this.logSubscriptionsDiag(`refresh done elapsedMs=${Date.now() - startedAt} count=${this.feeds.length}`)
    void this.hydrateFeedAvatarsInBackground()
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
    this.logSubscriptionsDiag(`feedsChanged received count=${this.feeds.length} loading=${this.isLoading} mode=${this.mode}`)
    void this.refreshFeeds()
  }

  private rootEnterTransition(delay: number) {
    return this.showBottomTabs ? livoMotion.enterScale(delay) : undefined
  }

  private overlayEnterTransition() {
    return livoMotion.enterSoft()
  }

  private syncOverlayState(level: number): void {
    this.syncOverlayLevel(level)
  }

  @Builder
  private SubscriptionsLowerTitleBuilder() {
    Row() {
      Text('订阅')
        .fontSize(28)
        .fontWeight(FontWeight.Bold)
        .fontColor($r('sys.color.font_primary'))
        .margin({ bottom: ROOT_PAGE_TITLE_TEXT_BOTTOM_OFFSET })
    }
    .width('100%')
    .height(SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT)
    .alignItems(VerticalAlign.Bottom)
    .padding({
      left: PAGE_HORIZONTAL_PADDING,
      right: PAGE_HORIZONTAL_PADDING,
      bottom: ROOT_PAGE_TITLE_CONTENT_BOTTOM_PADDING,
    })
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
    this.avatarHydrationPending = true
    void this.hydrateFeedAvatarsInBackground()
  }

  private startModeTransition(nextMode: SubscriptionMode): void {
    this.modeTransitionDirection = this.modeIndex(nextMode) > this.modeIndex(this.renderedMode) ? 1 : -1
    this.previousMode = this.renderedMode
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
    return mode === this.mode ? Visibility.Visible : Visibility.Hidden
  }

  private modeSceneOpacity(mode: SubscriptionMode): number {
    return mode === this.mode ? 1 : 0
  }

  private modeSceneOffset(mode: SubscriptionMode): number {
    return 0
  }

  private modeSceneZIndex(mode: SubscriptionMode): number {
    return mode === this.mode ? 2 : 0
  }

  private deriveFallbackIcon(siteUrl: string): string {
    const trimmed = siteUrl.trim()
    if (!trimmed) {
      return ''
    }

    try {
      const withoutProtocol = trimmed.replace(/^https?:\/\//, '')
      const host = withoutProtocol.split('/')[0]
      return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`
    } catch (_) {
      return ''
    }
  }

  private normalizeSiteUrl(value: string): string {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }
    if (/^https?:\/\//i.test(trimmed)) {
      return trimmed
    }
    if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#].*)?$/i.test(trimmed)) {
      return `https://${trimmed.replace(/^\/\/+/, '')}`
    }
    return trimmed
  }

  private shouldHydrateAvatar(feed: FeedCardModel): boolean {
    if (this.hydratedFeedIds.has(feed.id)) {
      return false
    }
    const primaryUrl = this.normalizeSiteUrl(feed.url)
    const secondaryUrl = this.normalizeSiteUrl(feed.siteUrl)
    return !!(extractXUsername(primaryUrl) || extractXUsername(secondaryUrl))
      || !!(extractInstagramUsername(primaryUrl) || extractInstagramUsername(secondaryUrl))
      || !!(this.extractYouTubeIdentity(primaryUrl) || this.extractYouTubeIdentity(secondaryUrl))
      || !!(this.extractBilibiliUid(primaryUrl) || this.extractBilibiliUid(secondaryUrl))
  }

  private async hydrateFeedAvatarsInBackground(): Promise<void> {
    if (this.avatarHydrationRunning || this.feeds.length === 0) {
      this.avatarHydrationPending = true
      this.logSubscriptionsDiag(`avatar hydrate pending running=${this.avatarHydrationRunning} count=${this.feeds.length}`)
      return
    }

    const candidates = this.feeds
      .filter((feed: FeedCardModel) => this.shouldHydrateAvatar(feed))
      .filter((feed: FeedCardModel) => feed.viewLabel === this.modeLabel(this.mode))
      .slice(0, SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT)
    if (candidates.length === 0) {
      this.avatarHydrationPending = false
      this.logSubscriptionsDiag(`avatar hydrate skipped no candidates mode=${this.mode}`)
      return
    }

    this.avatarHydrationPending = false
    const currentToken = this.avatarHydrationToken + 1
    this.avatarHydrationToken = currentToken
    this.avatarHydrationRunning = true
    const startedAt = Date.now()
    this.logSubscriptionsDiag(`avatar hydrate start mode=${this.mode} count=${candidates.length}`)

    let changedCount = 0
    try {
      for (const feed of candidates) {
        if (this.avatarHydrationToken !== currentToken) {
          break
        }

        let didHydrate = false
        try {
          const changed = await AppRepository.resolveFeedAvatarOnly(feed.id)
          if (changed) {
            changedCount += 1
          }
          didHydrate = true
        } catch (error) {
          this.logSubscriptionsDiag(
            `avatar hydrate failed feedId=${feed.id} error=${error instanceof Error ? error.message : error}`,
          )
        }
        if (didHydrate) {
          this.hydratedFeedIds.add(feed.id)
        }
      }
    } finally {
      this.avatarHydrationRunning = false
    }

    if (changedCount > 0 && this.avatarHydrationToken === currentToken) {
      bumpFeedsChangedSignal()
    }

    this.logSubscriptionsDiag(`avatar hydrate finished elapsedMs=${Date.now() - startedAt} changed=${changedCount} mode=${this.mode}`)

    if (this.avatarHydrationPending && !this.avatarHydrationRunning) {
      void this.hydrateFeedAvatarsInBackground()
    }
  }

  private iconSource(feed: FeedCardModel | undefined): string {
    if (!feed) {
      return ''
    }

    const normalizedFeedUrl = this.normalizeSiteUrl(feed.url)
    const normalizedSiteUrl = this.normalizeSiteUrl(feed.siteUrl)

    const resolved = resolveSocialFeedDisplayImageUrl(
      feed.imageUrl,
      normalizedFeedUrl,
      normalizedSiteUrl,
      feed.title,
    )
    if (resolved.trim().length > 0) {
      return resolved.trim()
    }

    return this.deriveFallbackIcon(normalizedSiteUrl)
  }

  private iconCandidates(feed: FeedCardModel | undefined): string[] {
    if (!feed) {
      return []
    }

    const candidates: string[] = []
    const pushCandidate = (value: string): void => {
      const trimmed = (value || '').trim()
      if (!trimmed || candidates.includes(trimmed)) {
        return
      }
      candidates.push(trimmed)
    }

    const normalizedSiteUrl = this.normalizeSiteUrl(feed.siteUrl)
    const normalizedFeedUrl = this.normalizeSiteUrl(feed.url)
    const resolvedPrimary = this.iconSource(feed)
    pushCandidate(resolvedPrimary)
    this.platformAvatarCandidates(normalizedFeedUrl, normalizedSiteUrl).forEach((url: string) => pushCandidate(url))

    const hostSource = (normalizedSiteUrl || normalizedFeedUrl || '').trim()
    const host = hostSource
      ? hostSource.replace(/^https?:\/\//i, '').split('/')[0].replace(/^www\./i, '')
      : ''

    if (host) {
      pushCandidate(`https://icons.duckduckgo.com/ip3/${host}.ico`)
      pushCandidate(`https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`)
      pushCandidate(`https://${host}/favicon.ico`)
      pushCandidate(`https://www.${host}/favicon.ico`)
    }

    return candidates
  }

  private extractBilibiliUid(value: string): string {
    const matched = (value || '').trim().match(
      /\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i,
    )
    return matched?.[1]?.trim() || ''
  }

  private extractYouTubeIdentity(value: string): string {
    const trimmed = (value || '').trim()
    if (!trimmed) {
      return ''
    }

    const identity = trimmed.match(/[?&]channel_id=([^&]+)/i)?.[1]
      || trimmed.match(/\/youtube\/channel\/([^/?#]+)/i)?.[1]
      || trimmed.match(/\/channel\/([^/?#]+)/i)?.[1]
      || trimmed.match(/\/youtube\/user\/(@?[^/?#]+)/i)?.[1]
      || trimmed.match(/\/@([^/?#]+)/i)?.[1]
      || trimmed.match(/youtube\.com\/(?:user|c)\/([^/?#]+)/i)?.[1]

    return identity ? decodeURIComponent(identity).trim().replace(/^@+/, '').toLowerCase() : ''
  }

  private platformAvatarCandidates(feedUrl: string, siteUrl: string): string[] {
    const result: string[] = []
    const push = (value: string): void => {
      const trimmed = (value || '').trim()
      if (!trimmed || result.includes(trimmed)) {
        return
      }
      result.push(trimmed)
    }

    const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
    if (xUsername) {
      push(`https://unavatar.io/x/${encodeURIComponent(xUsername)}`)
    }

    const instagramUsername = extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
    if (instagramUsername) {
      push(`https://unavatar.io/instagram/${encodeURIComponent(instagramUsername)}?fallback=false`)
    }

    const youTubeIdentity = this.extractYouTubeIdentity(feedUrl) || this.extractYouTubeIdentity(siteUrl)
    if (youTubeIdentity) {
      push(`https://unavatar.io/youtube/${encodeURIComponent(youTubeIdentity)}?fallback=false`)
    }

    const bilibiliUid = this.extractBilibiliUid(feedUrl) || this.extractBilibiliUid(siteUrl)
    if (bilibiliUid) {
      push(`https://unavatar.io/bilibili/${encodeURIComponent(bilibiliUid)}?fallback=false`)
    }

    return result
  }

  @Builder
  private FeedAvatar(feed: FeedCardModel | undefined) {
    AvatarTile({
      imageUrl: this.iconSource(feed),
      fallbackImageUrls: this.iconCandidates(feed),
      refreshToken: 0,
      fallbackLabel: feed ? feed.title : 'Livo',
      accent: this.theme.elevated,
      theme: this.theme,
      avatarSize: 22,
      radius: 6,
      textSize: 11,
    })
  }

  private getDisplaySubscriptionTitle(feed: FeedCardModel): string {
    return resolveSocialFeedDisplayTitle(feed.title, feed.url, feed.siteUrl || '')
  }

  @Builder
  private FeedRow(feed: FeedCardModel, index: number, showDivider: boolean) {
    Column() {
      Row({ space: 12 }) {
        this.FeedAvatar(feed)

        Column() {
          Text(this.getDisplaySubscriptionTitle(feed))
            .fontSize(LIST_ROW_TITLE_SIZE)
            .fontWeight(FontWeight.Medium)
            .fontColor(this.theme.textPrimary)
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
      .height(52)
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
    .onWillScroll((_xOffset: number, yOffset: number, _scrollState: ScrollState, _scrollSource: ScrollSource) => {
      this.handleHeaderBlurScrollDelta(yOffset)
    })
    .visibility(this.modeSceneVisible(mode))
    .opacity(this.modeSceneOpacity(mode))
    .translate({ x: this.modeSceneOffset(mode) })
    .zIndex(this.modeSceneZIndex(mode))
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
  private FeedDetailDestination(params?: SubscriptionFeedDetailParams) {
    FeedDetailView({
      feedId: params?.feedId ?? '',
      theme: this.theme,
      onBack: () => { this.closeFeedDetailPage() },
      onEdit: (feed: Feed) => { this.openEditPage(feed) },
      onSubscribe: (_payload: FeedRefreshPayload) => {},
      onOpenArticle: (entry: Entry, feed: Feed) => { this.openEntryDetail(entry, feed) },
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
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(1)
      },
      onSubscribed: async () => {
        await this.refreshFeeds()
        this.activeFeedDetailParams = undefined
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(0)
      },
      onSaved: async () => {
        await this.refreshFeeds()
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(1)
      },
      onUnsubscribed: async () => {
        await this.refreshFeeds()
        this.activeFeedDetailParams = undefined
        this.activeFeedConfigParams = undefined
        this.syncOverlayState(0)
      },
    })
  }

  @Builder
  private OverlayLayer() {
    if (this.activeFeedDetailParams) {
      Stack() {
        this.FeedDetailDestination(this.activeFeedDetailParams)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
      .transition(this.overlayEnterTransition())
      .zIndex(this.activeFeedConfigParams ? 1 : 2)
    }

    if (this.activeFeedConfigParams) {
      Stack() {
        this.FeedSubscribeConfigDestination(this.activeFeedConfigParams)
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
      .transition(this.overlayEnterTransition())
      .zIndex(3)
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

      this.OverlayLayer()

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
      HdsNavigation() {
        this.SubscriptionsRoot()
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
