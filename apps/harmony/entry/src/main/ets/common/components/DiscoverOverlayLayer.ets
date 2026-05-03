import { openArticleDetail } from '../navigation/AppRouter'
import { DiscoverBrowseDestination } from './DiscoverBrowseDestination'
import { DiscoverPreviewDestination, DiscoverSubscribeConfigDestination } from './DiscoverDestinations'
import {
  DiscoverBrowseRouteParams,
  DiscoverFlowRouteParams,
  DiscoverOverlayRoute,
  createDiscoverResultFromFeed,
} from './DiscoverTypes'
import { Entry, Feed, FeedViewType, toArticleDetailModel } from '../models/LivoModels'
import { RecommendedFeed } from '../services/discover/DiscoverTypes'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { ThemePalette } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'

@Component
export struct DiscoverOverlayLayer {
  @Prop activeBrowseParams: DiscoverBrowseRouteParams | undefined = undefined
  @Prop activePreviewParams: DiscoverFlowRouteParams | undefined = undefined
  @Prop activeSubscribeConfigParams: DiscoverFlowRouteParams | undefined = undefined
  @Prop activeOverlayRoute: DiscoverOverlayRoute = 'none'
  @Prop theme: ThemePalette
  onBrowseBack: () => void = () => {}
  onBrowseOpenPreview: (feed: RecommendedFeed) => void = () => {}
  onBrowseOpenSubscribeConfig: (feed: RecommendedFeed) => void = () => {}
  onPreviewBack: () => void = () => {}
  onPreviewEdit: (feed: Feed) => void = () => {}
  onPreviewSubscribe: (payload: FeedRefreshPayload) => void = () => {}
  onSubscribeConfigBack: () => void = () => {}
  onSubscribeConfigSubscribed: () => void = () => {}
  onSubscribeConfigSaved: () => void = () => {}
  onSubscribeConfigUnsubscribed: () => void = () => {}

  build() {
    if (this.activeBrowseParams || this.activePreviewParams || this.activeSubscribeConfigParams) {
      Stack() {
        if (this.activeBrowseParams) {
          Stack() {
          DiscoverBrowseDestination({
            view: this.activeBrowseParams.view,
            title: this.activeBrowseParams.title,
            sourceKey: this.activeBrowseParams.sourceKey,
            restoreOverlayLevel: this.activeBrowseParams.restoreOverlayLevel,
            theme: this.theme,
            onBack: () => { this.onBrowseBack() },
            onOpenPreview: (feed: RecommendedFeed) => { this.onBrowseOpenPreview(feed) },
            onOpenSubscribeConfig: (feed: RecommendedFeed) => { this.onBrowseOpenSubscribeConfig(feed) },
          })
        }
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme.background)
        .transition(livoMotion.enterSoft())
        .zIndex(this.activeOverlayRoute === 'browse' ? 2 : 1)
      }

      if (this.activePreviewParams) {
        Stack() {
          DiscoverPreviewDestination({
            targetUrl: this.activePreviewParams.targetUrl,
            initialTargetTitle: this.activePreviewParams.targetTitle,
            initialTargetSiteUrl: this.activePreviewParams.siteUrl,
            initialTargetImageUrl: this.activePreviewParams.imageUrl,
            initialTargetDescription: this.activePreviewParams.description,
            targetCategory: this.activePreviewParams.category,
            targetView: this.activePreviewParams.targetView,
            restoreOverlayLevel: this.activePreviewParams.restoreOverlayLevel,
            theme: this.theme,
            onBack: () => { this.onPreviewBack() },
            onEdit: (feed: Feed) => { this.onPreviewEdit(feed) },
            onSubscribe: (payload: FeedRefreshPayload) => { this.onPreviewSubscribe(payload) },
            onOpenArticle: (entry: Entry, _feed: Feed) => {
              const tempFeed: Feed = {
                id: entry.feedId || 'preview',
                title: '',
                url: entry.url,
                siteUrl: entry.url,
                view: FeedViewType.Articles,
                showInAll: true,
                errorCount: 0,
                createdAt: 0,
                updatedAt: 0,
              }
              void openArticleDetail(entry.id || 'preview', JSON.stringify(toArticleDetailModel(entry, tempFeed)))
            },
          })
        }
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme.background)
        .transition(livoMotion.enterSoft())
        .zIndex(this.activeOverlayRoute === 'preview' ? 3 : 2)
      }

      if (this.activeSubscribeConfigParams) {
        Stack() {
          DiscoverSubscribeConfigDestination({
            targetUrl: this.activeSubscribeConfigParams.targetUrl,
            targetTitle: this.activeSubscribeConfigParams.targetTitle,
            targetSiteUrl: this.activeSubscribeConfigParams.siteUrl,
            targetImageUrl: this.activeSubscribeConfigParams.imageUrl,
            targetDescription: this.activeSubscribeConfigParams.description,
            targetCategory: this.activeSubscribeConfigParams.category,
            sourceKind: this.activeSubscribeConfigParams.sourceKind,
            initialSelectedView: this.activeSubscribeConfigParams.targetView,
            restoreOverlayLevel: this.activeSubscribeConfigParams.restoreOverlayLevel,
            theme: this.theme,
            onBack: () => { this.onSubscribeConfigBack() },
            onSubscribed: () => { this.onSubscribeConfigSubscribed() },
            onSaved: () => { this.onSubscribeConfigSaved() },
            onUnsubscribed: () => { this.onSubscribeConfigUnsubscribed() },
          })
        }
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme.background)
        .transition(livoMotion.enterSoft())
        .zIndex(4)
      }
      }
    } else {
      Row()
        .width(0)
        .height(0)
        .hitTestBehavior(HitTestMode.None)
    }
  }
}
