import { Entry, Feed, FeedViewType } from '../models/LivoModels'
import { FeedRefreshPayload } from '../services/RssFeedService'
import { ThemePalette, ThemeService } from '../services/ThemeService'
import { livoMotion } from '../ui/Motion'
import { FeedDetailView } from './FeedDetailView'
import { FeedSubscribeConfigView } from './FeedSubscribeConfigView'
import {
  SubscriptionFeedConfigParams,
  SubscriptionFeedDetailParams,
} from './SubscriptionsConstants'

@Component
export struct SubscriptionsOverlayLayer {
  @Prop activeFeedDetailParams: SubscriptionFeedDetailParams | undefined = undefined
  @Prop activeFeedConfigParams: SubscriptionFeedConfigParams | undefined = undefined
  @Prop theme: ThemePalette = ThemeService.darkPalette()

  onCloseDetail: () => void = () => {}
  onEditFeed: (feed: Feed) => void = () => {}
  onSubscribeFromDetail: (payload: FeedRefreshPayload) => void = () => {}
  onOpenArticle: (entry: Entry, feed: Feed) => void = () => {}
  onConfigBack: () => void = () => {}
  onConfigSubscribed: () => Promise<void> = async () => {}
  onConfigSaved: () => Promise<void> = async () => {}
  onConfigUnsubscribed: () => Promise<void> = async () => {}

  build() {
    if (this.activeFeedDetailParams || this.activeFeedConfigParams) {
      Stack() {
        if (this.activeFeedDetailParams) {
          Stack() {
            FeedDetailView({
              feedId: this.activeFeedDetailParams.feedId,
              theme: this.theme,
              onBack: () => { this.onCloseDetail() },
              onEdit: (feed: Feed) => { this.onEditFeed(feed) },
              onSubscribe: (payload: FeedRefreshPayload) => { this.onSubscribeFromDetail(payload) },
              onOpenArticle: (entry: Entry, feed: Feed) => { this.onOpenArticle(entry, feed) },
            })
          }
          .width('100%')
          .height('100%')
          .backgroundColor(this.theme.background)
          .transition(livoMotion.enterSoft())
          .zIndex(this.activeFeedConfigParams ? 1 : 2)
        }

        if (this.activeFeedConfigParams) {
          Stack() {
            FeedSubscribeConfigView({
              targetUrl: this.activeFeedConfigParams.targetUrl,
              targetTitle: this.activeFeedConfigParams.targetTitle,
              targetSiteUrl: this.activeFeedConfigParams.targetSiteUrl,
              targetImageUrl: this.activeFeedConfigParams.targetImageUrl,
              targetDescription: this.activeFeedConfigParams.targetDescription,
              targetCategory: this.activeFeedConfigParams.targetCategory,
              sourceKind: this.activeFeedConfigParams.sourceKind,
              initialSelectedView: this.activeFeedConfigParams.initialSelectedView ?? FeedViewType.Articles,
              theme: this.theme,
              onBack: () => { this.onConfigBack() },
              onSubscribed: async () => { await this.onConfigSubscribed() },
              onSaved: async () => { await this.onConfigSaved() },
              onUnsubscribed: async () => { await this.onConfigUnsubscribed() },
            })
          }
          .width('100%')
          .height('100%')
          .backgroundColor(this.theme.background)
          .transition(livoMotion.enterSoft())
          .zIndex(3)
        }
      }
      .width('100%')
      .height('100%')
    } else {
      Row()
        .width(0)
        .height(0)
        .hitTestBehavior(HitTestMode.None)
    }
  }
}
