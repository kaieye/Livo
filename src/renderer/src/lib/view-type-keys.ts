/**
 * Mapping from FeedViewType enum to i18n key for view type names.
 */
import { FeedViewType } from '../../../shared/types'

export const VIEW_TYPE_I18N_KEYS: Record<number, string> = {
  [FeedViewType.Articles]: 'viewTypes.articles',
  [FeedViewType.SocialMedia]: 'viewTypes.socialMedia',
  [FeedViewType.Videos]: 'viewTypes.videos',
  [FeedViewType.Pictures]: 'viewTypes.pictures',
}
