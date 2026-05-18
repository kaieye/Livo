import { ArrayLazyDataSource } from '../data/ArrayLazyDataSource'
import { Entry, Feed, FeedViewType } from '../models/LivoModels'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { showToast } from '../utils/PageToastHelper'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { FeedDetailVideoPreviewService } from '../services/FeedDetailVideoPreviewService'
import {
  FeedDetailVideoPreviewCacheItem,
  mergeFeedDetailVideoPreviewCacheItem,
  resolveFeedDetailEntryVideoPreviewUrl,
  resolveFeedDetailEntryVideoUrl,
  resolveFeedDetailVideoSourceLabel,
} from '../utils/feed-detail/FeedDetailVideoPreview'
import { TweetEntryPresentation } from '../utils/social/TweetEntryPresentation'
import {
  FeedDetailDataCoordinator,
} from '../utils/feed-detail/FeedDetailDataCoordinator'
import {
  FeedDetailHeroAvatarCoordinator,
} from '../utils/feed-detail/FeedDetailHeroAvatarCoordinator'
import {
  FeedDetailPicturePreviewLeadUrlCache,
  FeedDetailTweetPresentationCache,
} from '../utils/feed-detail/FeedDetailEntryPresentationCaches'
import {
  feedDetailEntryStableKey,
} from '../utils/feed-detail/FeedDetailEntryCaches'
import {
  FeedDetailDisplaySnapshot,
  isFeedDetailPicturesPreview,
  isFeedDetailXPreview,
  resolveFeedDetailArticleFeed,
  resolveFeedDetailDisplayTitle,
  resolveFeedDetailGalleryCaption,
  resolveFeedDetailHeroDescription,
  resolveFeedDetailPicturePreviewLeadUrl,
} from '../utils/feed-detail/FeedDetailViewModel'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'
import { TweetEntryCard } from './TweetEntryCard'
import {
  FeedDetailDescriptionCard,
  FeedDetailHeroCard,
  FeedDetailNoticeCard,
  FeedDetailPicturePreviewEmptyStateCard,
  FeedDetailPicturePreviewEntryCard,
  FeedDetailPreviewEntryCard,
  FeedDetailPreviewSectionHeader,
} from './FeedDetailPreviewCards'

const X_PREVIEW_COLLAPSED_TEXT_LINES: number = 8

@Component
export struct FeedDetailView {
  @Prop feedId: string = ''
  @Prop targetUrl: string = ''
  @Prop initialTargetTitle: string = ''
  @Prop initialTargetSiteUrl: string = ''
  @Prop initialTargetImageUrl: string = ''
  @Prop initialTargetDescription: string = ''
  @Prop targetCategory: string = ''
  @Prop targetView: FeedViewType = FeedViewType.Articles
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onBack: () => void = () => {}
  onEdit: (feed: Feed) => void = () => {}
  onSubscribe: (payload: FeedRefreshPayload) => void = () => {}
  onOpenArticle: (entry: Entry, feed: Feed) => void = () => {}

  @State targetTitle: string = ''
  @State targetSiteUrl: string = ''
  @State targetImageUrl: string = ''
  @State targetDescription: string = ''
  @State previewPayload: FeedRefreshPayload | undefined = undefined
  @State resolvedPreviewEntries: Entry[] = []
  @State previewError: string = ''
  @State previewNotice: string = ''
  @State isLoading: boolean = true
  @State isRefreshing: boolean = false
  @State existingFeed: Feed | undefined = undefined
  @State resolvedDisplayTitle: string = ''
  @State videoPreviewCache: FeedDetailVideoPreviewCacheItem[] = []
  @State heroAvatarCandidates: string[] = []
  @State heroAvatarIndex: number = 0

  isRefreshBusy: boolean = false
  private readonly previewEntryDataSource: ArrayLazyDataSource<Entry> = new ArrayLazyDataSource<Entry>(
    () => this.resolvedPreviewEntries,
  )
  private readonly picturePreviewLeadUrlCache: FeedDetailPicturePreviewLeadUrlCache =
    new FeedDetailPicturePreviewLeadUrlCache()
  private readonly tweetPresentationCache: FeedDetailTweetPresentationCache =
    new FeedDetailTweetPresentationCache()
  private dataCoordinator: FeedDetailDataCoordinator = new FeedDetailDataCoordinator(this)
  private avatarCoordinator: FeedDetailHeroAvatarCoordinator = new FeedDetailHeroAvatarCoordinator(this)

  @StorageProp('feedsChangedAt') @Watch('handleFeedsChanged') feedsChangedAt: number = 0

  aboutToAppear(): void {
    this.previewPayload = undefined
    this.resolvedPreviewEntries = []
    this.picturePreviewLeadUrlCache.clear()
    this.previewError = ''
    this.previewNotice = ''
    this.existingFeed = undefined
    this.videoPreviewCache = []
    this.heroAvatarCandidates = []
    this.heroAvatarIndex = 0
    this.tweetPresentationCache.clear()

    this.targetTitle = this.initialTargetTitle
    this.targetSiteUrl = this.initialTargetSiteUrl
    this.targetImageUrl = this.initialTargetImageUrl
    this.targetDescription = this.initialTargetDescription
    this.refreshDisplayTitle()
    this.resetHeroAvatarCandidates()
    void this.dataCoordinator.load()
  }

  private handleFeedsChanged(): void {
    if (!this.feedId || this.isLoading || this.isRefreshing) {
      return
    }
    void this.dataCoordinator.reloadSubscribedFeedSnapshot()
  }

  setIsLoading(value: boolean): void { this.isLoading = value }
  setIsRefreshing(value: boolean): void { this.isRefreshing = value }
  setIsRefreshBusy(value: boolean): void { this.isRefreshBusy = value }
  setPreviewError(value: string): void { this.previewError = value }
  setPreviewNotice(value: string): void { this.previewNotice = value }
  setExistingFeed(feed: Feed | undefined): void {
    this.existingFeed = feed
    this.refreshDisplayTitle()
  }
  setTargetTitle(value: string): void {
    this.targetTitle = value
    this.refreshDisplayTitle()
  }
  setTargetSiteUrl(value: string): void {
    this.targetSiteUrl = value
    this.refreshDisplayTitle()
  }
  setTargetImageUrl(value: string): void { this.targetImageUrl = value }
  setTargetDescription(value: string): void { this.targetDescription = value }
  setHeroAvatarCandidates(candidates: string[]): void { this.heroAvatarCandidates = candidates }
  setHeroAvatarIndex(index: number): void { this.heroAvatarIndex = index }

  applyPreviewPayload(payload: FeedRefreshPayload | undefined): void {
    this.previewPayload = payload
    this.refreshDisplayTitle()
    this.avatarCoordinator.rememberFromPayload(payload)
    this.resolvedPreviewEntries = payload?.entries ?? []
    this.reconcileEntryCaches()
    this.previewEntryDataSource.notifyDataReloaded()
  }

  resetHeroAvatarCandidates(): void { this.avatarCoordinator.resetCandidates() }

  async hydrateSubscribedAvatar(feed: Feed, currentImageUrl: string): Promise<void> {
    await this.avatarCoordinator.hydrateSubscribedAvatar(feed, currentImageUrl)
  }

  async hydratePreviewAvatar(feedUrl: string, siteUrl: string, currentImageUrl: string): Promise<void> {
    await this.avatarCoordinator.hydratePreviewAvatar(feedUrl, siteUrl, currentImageUrl)
  }

  async hydrateVideoPreviews(entries: Entry[]): Promise<void> {
    for (const entry of entries) {
      const videoUrl = resolveFeedDetailEntryVideoUrl(entry)
      if (!videoUrl || resolveFeedDetailEntryVideoPreviewUrl(entry, this.videoPreviewCache)) {
        continue
      }
      const previewUrl = await FeedDetailVideoPreviewService.fetchBilibiliPreviewUrl(videoUrl)
      if (!previewUrl) {
        continue
      }
      this.videoPreviewCache = mergeFeedDetailVideoPreviewCacheItem(this.videoPreviewCache, {
        videoUrl,
        previewUrl,
      })
    }
  }

  showToast(message: string, duration: number = 1800): void {
    showToast(this.getUIContext(), message, duration)
  }

  private reconcileEntryCaches(): void {
    if (this.isPicturesPreview()) {
      this.picturePreviewLeadUrlCache.reconcile(this.resolvedPreviewEntries)
    } else {
      this.picturePreviewLeadUrlCache.clear()
    }
    if (this.isXPreview()) {
      this.tweetPresentationCache.reconcile(this.resolvedPreviewEntries)
    } else {
      this.tweetPresentationCache.clear()
    }
  }

  private shouldEnablePreviewItemTransition(): boolean { return !(this.isRefreshing || this.isRefreshBusy) }

  private displaySnapshot(): FeedDetailDisplaySnapshot {
    return {
      previewPayload: this.previewPayload,
      existingFeed: this.existingFeed,
      targetTitle: this.targetTitle,
      targetSiteUrl: this.targetSiteUrl,
      targetUrl: this.targetUrl,
      targetDescription: this.targetDescription,
      targetCategory: this.targetCategory,
      targetView: this.targetView,
      feedId: this.feedId,
    }
  }

  private heroDescription(): string { return resolveFeedDetailHeroDescription(this.displaySnapshot()) }

  private refreshDisplayTitle(): void {
    this.resolvedDisplayTitle = resolveFeedDetailDisplayTitle(this.displaySnapshot())
  }

  private previewEntryCount(): number { return this.resolvedPreviewEntries.length }

  private isPicturesPreview(): boolean { return isFeedDetailPicturesPreview(this.displaySnapshot()) }

  private isXPreview(): boolean { return isFeedDetailXPreview(this.displaySnapshot()) }

  private cachedTweetPresentation(entry: Entry): TweetEntryPresentation {
    return this.tweetPresentationCache.get(entry, this.resolvedAvatarUrl(), this.heroTitle())
  }

  private picturePreviewLeadUrl(entry: Entry): string {
    return this.picturePreviewLeadUrlCache.get(entry, (current: Entry) =>
      resolveFeedDetailPicturePreviewLeadUrl(current, this.displaySnapshot()),
    )
  }

  private articleDetailFeed(entry: Entry): Feed { return resolveFeedDetailArticleFeed(entry, this.displaySnapshot()) }

  private resolvedAvatarUrl(): string { return this.avatarCoordinator.currentUrl() }

  private heroTitle(): string {
    return this.resolvedDisplayTitle || resolveFeedDetailDisplayTitle(this.displaySnapshot())
  }

  @Builder
  private HeaderSection() {
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.heroTitle(),
        theme: this.theme,
        showBackButton: true,
        trailingText: !this.isLoading && this.existingFeed ? '编辑' : '',
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => { this.onBack() },
        onTrailingClick: () => {
          if (this.existingFeed) {
            this.onEdit(this.existingFeed)
          }
        },
      })
        .width('100%')
    }
  }

  @Builder
  private HeroCard() {
    FeedDetailHeroCard({
      title: this.heroTitle(),
      avatarUrl: this.resolvedAvatarUrl(),
      fallbackLabel: this.avatarCoordinator.fallbackLabel(this.heroTitle()),
      theme: this.theme,
      onAvatarLoaded: (imageUrl: string) => {
        this.avatarCoordinator.rememberCurrentPreview(imageUrl)
      },
      onAvatarError: () => {
        this.avatarCoordinator.advance()
      },
    })
  }

  @Builder
  private DescriptionCard() {
    if (this.heroDescription()) {
      FeedDetailDescriptionCard({
        description: this.heroDescription(),
        theme: this.theme,
      })
    }
  }

  @Builder
  private NoticeCard() {
    if (this.previewNotice) {
      FeedDetailNoticeCard({
        notice: this.previewNotice,
        theme: this.theme,
      })
    }
  }

  @Builder
  private PicturePreviewEntryCard(entry: Entry, index: number) {
    FeedDetailPicturePreviewEntryCard({
      entry,
      index,
      leadImageUrl: this.picturePreviewLeadUrl(entry),
      authorLabel: this.heroTitle(),
      caption: resolveFeedDetailGalleryCaption(entry),
      enableTransition: this.shouldEnablePreviewItemTransition(),
      theme: this.theme,
      onOpen: () => {
        this.onOpenArticle(entry, this.articleDetailFeed(entry))
      },
    })
  }

  @Builder
  private EntryCard(entry: Entry, index: number) {
    FeedDetailPreviewEntryCard({
      entry,
      index,
      videoPreviewUrl: resolveFeedDetailEntryVideoPreviewUrl(entry, this.videoPreviewCache),
      videoSourceLabel: resolveFeedDetailVideoSourceLabel(resolveFeedDetailEntryVideoUrl(entry)),
      enableTransition: this.shouldEnablePreviewItemTransition(),
      theme: this.theme,
      onOpen: () => {
        this.onOpenArticle(entry, this.articleDetailFeed(entry))
      },
    })
  }

  @Builder
  private PreviewSectionHeader() {
    FeedDetailPreviewSectionHeader({
      entryCount: this.previewEntryCount(),
      theme: this.theme,
    })
  }

  @Builder
  private PicturePreviewEmptyStateCard() {
    FeedDetailPicturePreviewEmptyStateCard({
      theme: this.theme,
    })
  }

  @Builder
  private PreviewEntryListItem(entry: Entry, index: number) {
    if (this.isPicturesPreview()) {
      this.PicturePreviewEntryCard(entry, index)
    } else if (this.isXPreview()) {
      TweetEntryCard({
        presentation: this.cachedTweetPresentation(entry),
        theme: this.theme,
        isUnread: !entry.isRead,
        flatMode: true,
        showBottomDivider: index < this.previewEntryCount() - 1,
        collapsedTextLines: X_PREVIEW_COLLAPSED_TEXT_LINES,
        enableEnterTransition: false,
        onOpen: () => {
          this.onOpenArticle(entry, this.articleDetailFeed(entry))
        },
      })
    } else {
      this.EntryCard(entry, index)
    }
  }

  build() {
    Column({ space: 0 }) {
      this.HeaderSection()

      if (this.previewError) {
        Column({ space: 16 }) {
          Text('预览失败')
            .fontSize(20)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)

          Text(this.previewError)
            .fontSize(14)
            .fontColor(this.theme.textSecondary)
            .textAlign(TextAlign.Center)
            .padding({ left: 32, right: 32 })

          Button('重试')
            .onClick(() => { void this.dataCoordinator.load() })
            .backgroundColor(this.theme.accent)
            .fontColor('#FFFFFF')
        }
        .width('100%')
        .layoutWeight(1)
        .justifyContent(FlexAlign.Center)
      } else if (this.previewPayload) {
        Stack({ alignContent: Alignment.TopStart }) {
          Refresh({ refreshing: $$this.isRefreshing }) {
            List({ space: 12 }) {
              ListItem() {
                this.HeroCard()
              }
              .width('100%')

              if (this.heroDescription()) {
                ListItem() {
                  this.DescriptionCard()
                }
                .width('100%')
              }

              if (this.previewNotice) {
                ListItem() {
                  this.NoticeCard()
                }
                .width('100%')
              }

              ListItem() {
                this.PreviewSectionHeader()
              }
              .width('100%')

              if (this.previewEntryCount() > 0) {
                LazyForEach(this.previewEntryDataSource, (entry: Entry, index: number) => {
                  ListItem() {
                    this.PreviewEntryListItem(entry, index)
                  }
                  .width('100%')
                }, (entry: Entry) => feedDetailEntryStableKey(entry))
              } else if (this.isPicturesPreview()) {
                ListItem() {
                  this.PicturePreviewEmptyStateCard()
                }
                .width('100%')
              }

              ListItem() {
                Row().height(100).width('100%')
              }
            }
            .width('100%')
            .height('100%')
            .padding({ left: 18, right: 18, top: 0, bottom: 24 })
            .scrollBar(BarState.Off)
            .edgeEffect(EdgeEffect.Spring, { alwaysEnabled: true })
          }
          .onRefreshing(() => { this.dataCoordinator.triggerRefresh() })

          if (this.previewPayload && !this.existingFeed) {
            Row() {
              Button('订阅')
                .type(ButtonType.Capsule)
                .width('80%')
                .height(50)
                .fontSize(16)
                .fontWeight(FontWeight.Bold)
                .backgroundColor(this.theme.accent)
                .fontColor('#FFFFFF')
                .shadow({ radius: 20, color: 'rgba(0,0,0,0.15)', offsetY: 8 })
                .onClick(() => {
                  this.onSubscribe(this.previewPayload!)
                })
            }
            .width('100%')
            .justifyContent(FlexAlign.Center)
            .padding({ bottom: 24 })
            .position({ x: 0, y: '100%' })
            .markAnchor({ x: 0, y: '100%' })
            .transition(TransitionEffect.move(TransitionEdge.BOTTOM).combine(TransitionEffect.OPACITY))
          }
        }
        .width('100%')
        .layoutWeight(1)
      } else if (this.isLoading) {
        this.LoadingState('正在加载预览...')
      } else {
        this.LoadingState('正在初始化预览...')
      }
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  @Builder
  private LoadingState(message: string) {
    Column({ space: 12 }) {
      LoadingProgress().width(42).height(42).color(this.theme.accent)
      Text(message)
        .fontSize(14)
        .fontColor(this.theme.textSecondary)
    }
    .width('100%')
    .layoutWeight(1)
    .justifyContent(FlexAlign.Center)
  }
}
