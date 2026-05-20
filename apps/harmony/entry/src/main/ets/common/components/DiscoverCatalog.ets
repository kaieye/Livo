import { FeedViewType } from '../models/LivoModels'
import { normalizeDiscoverInput } from '../services/discover/DiscoverUrlParsing'
import { DirectUrlResult, DiscoverCategoryCard } from './DiscoverTypes'
import { hostOf } from '../utils/discover/DiscoverCandidatePresentation'

export function discoverCategoryCards(): DiscoverCategoryCard[] {
  return [
    {
      id: 'articles',
      view: FeedViewType.Articles,
      label: '文章',
      accent: '#2563EB',
    },
    {
      id: 'social',
      view: FeedViewType.SocialMedia,
      label: '社交',
      accent: '#0F766E',
    },
    {
      id: 'pictures',
      view: FeedViewType.Pictures,
      label: '图片',
      accent: '#DB2777',
    },
    {
      id: 'videos',
      view: FeedViewType.Videos,
      label: '视频',
      accent: '#F97316',
    },
    {
      id: 'ai',
      view: FeedViewType.Articles,
      label: 'AI',
      accent: '#6C63FF',
      sourceKey: 'ai',
      icon: $r('app.media.HugeiconsAiCloud01'),
    },
    {
      id: 'ins-2',
      view: FeedViewType.Pictures,
      label: 'Ins',
      accent: '#C13584',
      sourceKey: 'ins',
      icon: $r('app.media.account_instagram'),
    },
    {
      id: 'podcast',
      view: FeedViewType.Articles,
      label: '播客',
      accent: '#7C3AED',
      sourceKey: 'podcast',
    },
    {
      id: 'news',
      view: FeedViewType.Articles,
      label: '新闻',
      accent: '#C41230',
      sourceKey: 'news',
    },
  ]
}

export function categoryCardSymbol(view: FeedViewType): Resource {
  if (view === FeedViewType.SocialMedia) {
    return $r('sys.symbol.ellipsis_bubble')
  }
  if (view === FeedViewType.Pictures) {
    return $r('sys.symbol.picture_2')
  }
  if (view === FeedViewType.Videos) {
    return $r('sys.symbol.media_center')
  }
  return $r('sys.symbol.doc_text')
}

function looksLikeFeedSubscriptionUrl(url: string): boolean {
  const normalized = url.toLowerCase()
  return /\/(atom|rss|feed|feeds)(\.xml)?(?:[/?#]|$)/i.test(normalized)
    || /\.(atom|rss|xml)(?:[?#]|$)/i.test(normalized)
    || /[?&](feed|rss|format)=(rss|atom|xml|feed)\b/i.test(normalized)
}

export function resolveDirectUrlResult(query: string): DirectUrlResult | undefined {
  const normalized = normalizeDiscoverInput(query)
  if (!/^https?:\/\/\S+$/i.test(normalized)) {
    return undefined
  }

  const host = hostOf(normalized)
  const isFeedSubscriptionUrl = looksLikeFeedSubscriptionUrl(normalized)
  return {
    targetUrl: normalized,
    siteUrl: host ? `https://${host}` : normalized,
    title: host || normalized,
    description: isFeedSubscriptionUrl
      ? '识别为订阅链接，点击后会校验内容并提供添加订阅选项。'
      : '识别为网页地址，点击后会尝试发现订阅源并进入预览。',
  }
}
