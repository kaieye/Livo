import { builtinDiscoverInsGroups, DiscoverBuiltinFeedSeed, InsGroupFeed, resolveDescription } from '../data/DiscoverBuiltinFeeds'
import { FeedViewType } from '../models/LivoModels'
import { discoverViewLabel } from '../services/discover/DiscoverLabels'
import { filteredRecommendedFeeds } from '../services/discover/DiscoverFeedCatalog'
import { RecommendedFeed } from '../services/discover/DiscoverTypes'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { PAGE_HORIZONTAL_PADDING } from '../ui/UiTokens'
import { candidateAvatarFallbackUrls } from '../utils/DiscoverCandidatePresentation'
import {
  initialDiscoverBrowseVisibleCount,
  nextDiscoverBrowseVisibleCount,
  shouldPreloadDiscoverBrowseMore,
} from '../utils/DiscoverBrowsePagination'
import { AvatarTile } from './AvatarTile'
import { DiscoverBrowseAvatarHydrator } from './DiscoverBrowseAvatarHydrator'
import { PageHeader } from './PageHeader'
import { SecondaryPageHeaderShell } from './SecondaryPageHeaderShell'

@Component
export struct DiscoverBrowseDestination {
  @Prop view: FeedViewType = FeedViewType.Articles
  @Prop title: string = ''
  @Prop sourceKey: string = ''
  @Prop restoreOverlayLevel: number = 0
  @Prop theme: ThemePalette = ThemeService.darkPalette()
  onBack: () => void = () => {}
  onOpenPreview: (feed: RecommendedFeed) => void = (_feed: RecommendedFeed) => {}
  onOpenSubscribeConfig: (feed: RecommendedFeed) => void = (_feed: RecommendedFeed) => {}
  @StorageProp('discoverOverlayLevel') discoverOverlayLevel: number = 0
  @State private cachedFeeds: RecommendedFeed[] = []
  @State private insGroups: InsGroupFeed[] = []
  @State private visibleFeedCount: number = 0
  @State private avatarHydrationVersion: number = 0
  private readonly browseScroller: Scroller = new Scroller()
  private readonly avatarHydrator: DiscoverBrowseAvatarHydrator = new DiscoverBrowseAvatarHydrator(() => {
    this.avatarHydrationVersion += 1
  })

  aboutToAppear(): void {
    this.avatarHydrator.activate()
    this.cachedFeeds = filteredRecommendedFeeds(this.view, this.sourceKey)
    this.visibleFeedCount = initialDiscoverBrowseVisibleCount(this.cachedFeeds.length)
    if (this.sourceKey === 'ins') {
      this.insGroups = builtinDiscoverInsGroups()
    }
    setTimeout(() => {
      if (this.avatarHydrator.isActive) {
        void this.avatarHydrator.loadPersistedCache()
      }
    }, 120)
  }

  aboutToDisappear(): void {
    this.avatarHydrator.deactivate()
  }

  private browseFeeds(): RecommendedFeed[] {
    return filteredRecommendedFeeds(this.view, this.sourceKey)
  }

  private visibleBrowseFeeds(): RecommendedFeed[] {
    return this.cachedFeeds.slice(0, this.visibleFeedCount)
  }

  private hasMoreBrowseFeeds(): boolean {
    return this.visibleFeedCount < this.cachedFeeds.length
  }

  private loadMoreBrowseFeeds(): void {
    if (!this.hasMoreBrowseFeeds()) {
      return
    }
    this.visibleFeedCount = nextDiscoverBrowseVisibleCount(this.visibleFeedCount, this.cachedFeeds.length)
  }

  private handleBrowseScrollLoadMore(): void {
    if (!this.hasMoreBrowseFeeds()) {
      return
    }
    const currentOffset = Math.max(0, this.browseScroller.currentOffset().yOffset)
    if (shouldPreloadDiscoverBrowseMore(
      currentOffset,
      this.cachedFeeds.length,
      this.visibleFeedCount,
    )) {
      this.loadMoreBrowseFeeds()
    }
  }

  private browseTitle(): string {
    return this.title || discoverViewLabel(this.view)
  }

  @Builder
  private FeedRow(feed: RecommendedFeed, showDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: 10 }) {
        AvatarTile({
          imageUrl: this.avatarHydrator.resolveFeedAvatarUrl(feed),
          fallbackImageUrls: candidateAvatarFallbackUrls(
            this.avatarHydrator.resolveFeedAvatarUrl(feed),
            feed.url,
            feed.siteUrl,
            feed.title,
          ),
          refreshToken: this.discoverOverlayLevel + this.avatarHydrationVersion,
          fallbackLabel: feed.title,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 28,
          radius: 8,
          textSize: 11,
          useAccentFallback: true,
          onImageLoaded: (url: string) => {
            this.avatarHydrator.rememberLoaded(feed.url, feed.siteUrl, url)
          },
        })

        Column({ space: 6 }) {
          Text(feed.title)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          if (feed.description.trim()) {
            Text(feed.description.trim())
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          } else if (feed.followers) {
            Text(feed.followers)
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height(feed.description.trim() ? 56 : 46)
      .padding({ left: 14, right: 14, top: 6, bottom: 6 })
      .backgroundColor('transparent')
      .onClick(() => {
        this.onOpenPreview(feed)
      })
      .onAppear(() => {
        setTimeout(() => {
          if (this.avatarHydrator.isActive) {
            void this.avatarHydrator.hydrate(feed.title, feed.url, feed.siteUrl, feed.imageUrl || '')
          }
        }, 520)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 50, right: 14 })
      }
    }
    .width('100%')
  }

  @Builder
  private HeaderSection() {
    SecondaryPageHeaderShell() {
      PageHeader({
        title: this.browseTitle(),
        theme: this.theme,
        showBackButton: true,
        titleSize: 20,
        topPadding: 0,
        bottomPadding: 0,
        onBack: () => {
          this.avatarHydrator.deactivate()
          this.onBack()
        },
      })
        .width('100%')
    }
  }

  @Builder
  private InsFeedRow(member: DiscoverBuiltinFeedSeed, showDivider: boolean) {
    Column({ space: 0 }) {
      Row({ space: 10 }) {
        AvatarTile({
          imageUrl: this.avatarHydrator.resolveInsMemberAvatarUrl(member),
          fallbackImageUrls: candidateAvatarFallbackUrls(
            this.avatarHydrator.resolveInsMemberAvatarUrl(member),
            member.url,
            '',
            member.title,
          ),
          refreshToken: this.discoverOverlayLevel + this.avatarHydrationVersion,
          fallbackLabel: member.title,
          accent: this.theme.accent,
          theme: this.theme,
          avatarSize: 28,
          radius: 8,
          textSize: 11,
          useAccentFallback: true,
          onImageLoaded: (url: string) => {
            this.avatarHydrator.rememberLoaded(member.url, '', url)
          },
        })

        Column({ space: 6 }) {
          Text(member.title)
            .fontSize(13)
            .fontWeight(FontWeight.Bold)
            .fontColor(this.theme.textPrimary)
            .maxLines(1)
            .textOverflow({ overflow: TextOverflow.Ellipsis })

          if (member.descriptionZh || member.descriptionEn) {
            Text(resolveDescription(member))
              .fontSize(11)
              .fontColor(this.theme.textSecondary)
              .maxLines(1)
              .textOverflow({ overflow: TextOverflow.Ellipsis })
          }
        }
        .layoutWeight(1)
        .alignItems(HorizontalAlign.Start)
      }
      .width('100%')
      .height((member.descriptionZh || member.descriptionEn) ? 56 : 46)
      .padding({ left: 14, right: 14, top: 6, bottom: 6 })
      .backgroundColor('transparent')
      .onClick(() => {
        const feed: RecommendedFeed = {
          title: member.title,
          url: member.url,
          siteUrl: '',
          description: '',
          view: FeedViewType.Pictures,
          category: '内置-Ins',
        }
        this.onOpenPreview(feed)
      })
      .onAppear(() => {
        setTimeout(() => {
          if (this.avatarHydrator.isActive) {
            void this.avatarHydrator.hydrate(member.title, member.url, '', '')
          }
        }, 520)
      })

      if (showDivider) {
        Divider()
          .strokeWidth(1)
          .color(this.theme.divider)
          .margin({ left: 50, right: 14 })
      }
    }
    .width('100%')
  }

  build() {
    Column() {
      this.HeaderSection()

      Scroll(this.browseScroller) {
        Column({ space: 12 }) {
          if (this.sourceKey === 'ins' && this.insGroups.length > 0) {
            ForEach(this.insGroups, (group: InsGroupFeed) => {
              Column({ space: 0 }) {
                Text(group.groupName)
                  .fontSize(14)
                  .fontWeight(FontWeight.Bold)
                  .fontColor(this.theme.textPrimary)
                  .margin({ left: 14, top: 10, bottom: 6 })

                ForEach(group.members, (member: DiscoverBuiltinFeedSeed, index: number) => {
                  this.InsFeedRow(member, index < group.members.length - 1)
                }, (member: DiscoverBuiltinFeedSeed) => `${group.groupName}-${member.url}`)
              }
              .width('100%')
              .backgroundColor(this.theme.surface)
              .borderRadius(18)
              .border({ width: 0.8, color: this.theme.divider })
              .clip(true)
            }, (group: InsGroupFeed) => group.groupName)
          } else {
            Column({ space: 0 }) {
              ForEach(this.visibleBrowseFeeds(), (feed: RecommendedFeed, index: number) => {
                this.FeedRow(feed, index < this.visibleBrowseFeeds().length - 1)
              }, (feed: RecommendedFeed) => `${this.sourceKey || this.view}-${feed.url}`)
              if (this.hasMoreBrowseFeeds()) {
                Row() {
                  Text('继续下滑加载更多')
                    .fontSize(12)
                    .fontColor(this.theme.textMuted)
                }
                .width('100%')
                .height(44)
                .justifyContent(FlexAlign.Center)
              }
            }
            .width('100%')
            .backgroundColor(this.theme.surface)
            .borderRadius(18)
            .border({ width: 0.8, color: this.theme.divider })
            .clip(true)
          }
        }
        .width('100%')
        .padding({ left: PAGE_HORIZONTAL_PADDING, right: PAGE_HORIZONTAL_PADDING, top: 4, bottom: 16 })
        .alignItems(HorizontalAlign.Start)
        .justifyContent(FlexAlign.Start)
        .constraintSize({ minHeight: '100%' })
      }
      .scrollBar(BarState.On)
      .edgeEffect(EdgeEffect.Spring)
      .width('100%')
      .layoutWeight(1)
      .onReachEnd(() => {
        this.loadMoreBrowseFeeds()
      })
      .onDidScroll((_scrollOffset: number, _scrollState: ScrollState) => {
        this.handleBrowseScrollLoadMore()
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
    .onDisAppear(() => {
      this.avatarHydrator.deactivate()
    })
  }
}
