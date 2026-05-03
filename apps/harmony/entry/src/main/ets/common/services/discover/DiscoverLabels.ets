import { FeedViewType } from '../../models/LivoModels'
import { DiscoverSearchPlatform } from './DiscoverTypes'

export function discoverViewLabel(view: FeedViewType): string {
  switch (view) {
    case FeedViewType.SocialMedia:
      return '社交'
    case FeedViewType.Pictures:
      return '图片'
    case FeedViewType.Videos:
      return '视频'
    default:
      return '文章'
  }
}

export function discoverPlatformLabel(platform: DiscoverSearchPlatform): string {
  switch (platform) {
    case 'youtube':
      return 'YouTube'
    case 'bilibili':
      return 'Bilibili'
    case 'x':
      return 'X'
    case 'instagram':
      return 'Instagram'
    default:
      return '全部'
  }
}

export function preferredViewForPlatform(platform: DiscoverSearchPlatform): FeedViewType {
  switch (platform) {
    case 'x':
      return FeedViewType.SocialMedia
    case 'instagram':
      return FeedViewType.Pictures
    case 'youtube':
    case 'bilibili':
      return FeedViewType.Videos
    default:
      return FeedViewType.Articles
  }
}
