import { FeedViewType } from '../models/LivoModels'
import { ROOT_PAGE_MODE_TOP_OFFSET } from './FloatingRootPageLayout'
import { ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT } from './FloatingRootPageLayout'

export type SubscriptionMode = 'articles' | 'social' | 'pictures' | 'videos'

export const SUBSCRIPTION_MODES: SubscriptionMode[] = ['articles', 'social', 'pictures', 'videos']
export const MODE_SWIPE_TRIGGER_OFFSET: number = 56
export const HEADER_BLUR_SCROLL_RANGE: number = 72
export const SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT: number = 56
export const SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT: number = ROOT_PAGE_TITLE_BAR_BOTTOM_HEIGHT
export const SUBSCRIPTIONS_TITLE_BAR_OVERLAY_SPACER: number =
  SUBSCRIPTIONS_TITLE_BAR_MINI_HEIGHT + SUBSCRIPTIONS_TITLE_BAR_BOTTOM_TITLE_HEIGHT + ROOT_PAGE_MODE_TOP_OFFSET
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
