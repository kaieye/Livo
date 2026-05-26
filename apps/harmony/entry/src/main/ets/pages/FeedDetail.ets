import { curves } from '@kit.ArkUI'
import { SettingsStore } from '../common/services/SettingsStore'
import { getStringParams, goBack, openArticleDetail, openDiscoverSubscribeConfig } from '../common/navigation/AppRouter'
import { Entry, Feed, FeedCardModel, FeedViewType, toArticleDetailModel } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { FeedDetailView } from '../common/components/FeedDetailView'
import { FeedRefreshPayload } from '../common/services/RssFeedService'

@Entry
@Component
struct FeedDetail {
  @State feedId: string = ''
  @State targetUrl: string = ''
  @State targetTitle: string = ''
  @State targetSiteUrl: string = ''
  @State targetImageUrl: string = ''
  @State targetDescription: string = ''
  @State targetCategory: string = ''
  @State targetView: FeedViewType = FeedViewType.Articles
  @State sourceKind: string = ''
  @State theme: ThemePalette = ThemeService.lightPalette()

  aboutToAppear(): void {
    const params = getStringParams()
    if (params) {
      this.feedId = params.feedId ?? ''
      this.targetUrl = params.targetUrl ?? ''
      this.targetTitle = params.targetTitle ?? ''
      this.targetSiteUrl = params.siteUrl ?? ''
      this.targetImageUrl = params.imageUrl ?? ''
      this.targetDescription = params.description ?? ''
      this.targetCategory = params.category ?? ''
      this.sourceKind = params.sourceKind ?? ''
      const parsedView = Number(params.view ?? FeedViewType.Articles)
      this.targetView = parsedView as FeedViewType
    }
    void this.loadSettings()
  }

  private async loadSettings(): Promise<void> {
    const settings = await SettingsStore.default.load()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  private openEditPage(feed: Feed): void {
    void openDiscoverSubscribeConfig({
      targetUrl: feed.url,
      targetTitle: feed.title,
      view: feed.view as FeedViewType,
      siteUrl: feed.siteUrl || '',
      imageUrl: feed.imageUrl || '',
      description: feed.description || '',
      sourceKind: '编辑',
      category: feed.category || '',
    })
  }

  private handleSubscribe(payload: FeedRefreshPayload): void {
    void openDiscoverSubscribeConfig({
      targetUrl: this.targetUrl,
      targetTitle: payload.feedTitle || this.targetTitle,
      view: this.targetView,
      siteUrl: payload.siteUrl || this.targetSiteUrl,
      imageUrl: payload.imageUrl || this.targetImageUrl,
      description: payload.description || this.targetDescription,
      sourceKind: this.sourceKind,
      category: this.targetCategory,
    })
  }

  build() {
    Column() {
      FeedDetailView({
        feedId: this.feedId,
        targetUrl: this.targetUrl,
        initialTargetTitle: this.targetTitle,
        initialTargetSiteUrl: this.targetSiteUrl,
        initialTargetImageUrl: this.targetImageUrl,
        initialTargetDescription: this.targetDescription,
        targetCategory: this.targetCategory,
        targetView: this.targetView,
        theme: this.theme,
        onBack: () => { void goBack() },
        onEdit: (feed: Feed) => { this.openEditPage(feed) },
        onSubscribe: (payload: FeedRefreshPayload) => { this.handleSubscribe(payload) },
        onOpenArticle: (entry: Entry, feed: Feed) => {
          const model = toArticleDetailModel(entry, feed)
          void openArticleDetail(entry.id || 'preview', JSON.stringify(model))
        }
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  pageTransition() {
    PageTransitionEnter({ type: RouteType.Push, duration: 260, curve: curves.springMotion(0.82, 0.94) })
      .opacity(0)
    PageTransitionExit({ type: RouteType.Push, duration: 220, curve: Curve.EaseInOut })
      .opacity(1)
    PageTransitionEnter({ type: RouteType.Pop, duration: 220, curve: Curve.EaseOut })
      .opacity(1)
    PageTransitionExit({ type: RouteType.Pop, duration: 220, curve: Curve.EaseInOut })
      .opacity(0)
  }
}
