import { FeedViewType } from '../../../shared/types'
import type { DiscoverSubscribeTarget } from './discover-subscribe-config'

export interface PreparedDiscoverSubscription {
  target: DiscoverSubscribeTarget
  view: FeedViewType
}

export async function prepareDiscoverSubscriptionTarget(
  target: DiscoverSubscribeTarget,
): Promise<PreparedDiscoverSubscription> {
  if (target.metadata?.source !== 'wechat-rss') {
    return {
      target,
      view: target.view ?? FeedViewType.Articles,
    }
  }

  const fakeId = target.metadata.fakeId?.trim()
  const mpName = (target.title || '').trim()
  const avatar = (target.imageUrl || '').trim()
  if (!fakeId || !mpName) {
    throw new Error('WeChat MP subscription metadata is incomplete')
  }

  const result = await window.api.discover.ensureWechatMpFeed({
    mpName,
    fakeId,
    avatar,
    intro: target.description || '',
  })

  if (!result.success || !result.rssUrl) {
    throw new Error(result.error || 'Failed to prepare WeChat MP feed')
  }

  return {
    target: {
      ...target,
      url: result.rssUrl,
      siteUrl: result.siteUrl || target.siteUrl,
      imageUrl: result.image || target.imageUrl,
      description: result.description || target.description,
      title: result.title || target.title,
      view: FeedViewType.Articles,
    },
    view: FeedViewType.Articles,
  }
}
