/**
 * Single source of truth for the feed-subscribe view-type rail.
 *
 * The four `FeedViewType` values share label + symbol with `utils/HomeModeMeta`'s
 * `HomeMode` (which is a string-literal mirror of the same domain concept).
 * Future refactor: converge the two by routing both through one labelled enum.
 */

import { FeedViewType } from '../../models/LivoModels'

export interface FeedSubscribeViewOption {
  view: FeedViewType
  label: string
}

const FEED_SUBSCRIBE_VIEW_OPTIONS: FeedSubscribeViewOption[] = [
  { view: FeedViewType.Articles, label: '文章' },
  { view: FeedViewType.SocialMedia, label: '社交' },
  { view: FeedViewType.Pictures, label: '图片' },
  { view: FeedViewType.Videos, label: '视频' },
]

export function feedSubscribeViewOptions(): FeedSubscribeViewOption[] {
  return FEED_SUBSCRIBE_VIEW_OPTIONS
}

export function feedSubscribeViewLabel(view: FeedViewType): string {
  const match = FEED_SUBSCRIBE_VIEW_OPTIONS.find(
    (option: FeedSubscribeViewOption) => option.view === view,
  )
  return match ? match.label : '文章'
}

export function feedSubscribeViewSymbol(view: FeedViewType): Resource {
  switch (view) {
    case FeedViewType.Articles:
      return $r('sys.symbol.doc_text')
    case FeedViewType.SocialMedia:
      return $r('sys.symbol.ellipsis_bubble')
    case FeedViewType.Pictures:
      return $r('sys.symbol.picture_2')
    case FeedViewType.Videos:
      return $r('sys.symbol.media_center')
    default:
      return $r('sys.symbol.doc_text')
  }
}

export function feedSubscribeViewIndex(view: FeedViewType): number {
  const index = FEED_SUBSCRIBE_VIEW_OPTIONS.findIndex(
    (option: FeedSubscribeViewOption) => option.view === view,
  )
  return index >= 0 ? index : 0
}
