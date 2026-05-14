import { FeedViewType } from '../models/LivoModels'

export const HEADER_BLUR_SCROLL_RANGE: number = 72
export const SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER: number = 72
export const SUBSCRIPTIONS_AVATAR_HYDRATION_LIMIT: number = 12
export const SUBSCRIPTIONS_REFRESH_DIAG_PREFIX: string = '[SubscriptionsDiag]'

export class SubscriptionFeedDetailParams {
  feedId: string = ''
}

export class SubscriptionFeedConfigParams {
  targetUrl: string = ''
  targetTitle: string = ''
  targetSiteUrl: string = ''
  targetImageUrl: string = ''
  targetDescription: string = ''
  targetCategory: string = ''
  sourceKind: string = ''
  initialSelectedView: FeedViewType = FeedViewType.Articles
}
