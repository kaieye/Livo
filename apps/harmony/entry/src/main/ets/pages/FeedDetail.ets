import { AppRepository } from '../common/data/AppRepository'
import { getStringParams, goBack, openArticleDetail, openDiscoverSubscribeConfig } from '../common/navigation/AppRouter'
import { Entry, Feed, FeedCardModel, FeedViewType } from '../common/models/LivoModels'
import { ThemePalette, ThemeService } from '../common/services/ThemeService'
import { FeedDetailView } from '../common/components/FeedDetailView'
import { FeedRefreshPayload } from '../common/services/RssFeedService'

@Entry
@Component
struct FeedDetail {
  @State feedId: string = ''
  @State theme: ThemePalette = ThemeService.darkPalette()

  aboutToAppear(): void {
    const params = getStringParams()
    if (params && params.feedId) {
      this.feedId = params.feedId
      void this.loadSettings()
    }
  }

  private async loadSettings(): Promise<void> {
    const settings = await AppRepository.settings()
    this.theme = await ThemeService.resolvePalette(settings)
  }

  private openEditPage(feed: Feed): void {
    void openDiscoverSubscribeConfig({
      targetUrl: feed.url,
      targetTitle: feed.title,
      targetView: feed.view as FeedViewType,
      siteUrl: feed.siteUrl || '',
      description: feed.description || '',
      sourceKind: '编辑',
      category: feed.category || '',
    })
  }

  private handleSubscribe(payload: FeedRefreshPayload): void {
    // 已经订阅的不会显示订阅按钮，理论上这个入口不会触发，但如果是通过预览进来未订阅的可以复用配置页
    void openDiscoverSubscribeConfig({
      targetUrl: payload.entries[0]?.feedId || '', // 这是一个 fallback，预览通常有 targetUrl
      targetTitle: payload.feedTitle,
      targetView: FeedViewType.Articles,
      siteUrl: payload.siteUrl,
      description: payload.description,
      sourceKind: '',
      category: '',
    })
  }

  build() {
    Column() {
      FeedDetailView({
        feedId: this.feedId,
        theme: this.theme,
        onBack: () => { void goBack() },
        onEdit: (feed: Feed) => { this.openEditPage(feed) },
        onSubscribe: (payload: FeedRefreshPayload) => { this.handleSubscribe(payload) },
        onOpenArticle: (entry: Entry) => { void openArticleDetail(entry.id) }
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }
}
