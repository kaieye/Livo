import { FeedViewType } from '../models/LivoModels'
import { normalizeDiscoverInput } from '../services/DiscoverService'
import { DirectUrlResult, DiscoverCategoryCard } from './DiscoverTypes'
import { hostOf } from '../utils/DiscoverCandidatePresentation'

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
      id: 'ins-3',
      view: FeedViewType.Pictures,
      label: 'Ins',
      accent: '#C13584',
      sourceKey: 'ins',
      icon: $r('app.media.account_instagram'),
    },
    {
      id: 'ins-4',
      view: FeedViewType.Pictures,
      label: 'Ins',
      accent: '#C13584',
      sourceKey: 'ins',
      icon: $r('app.media.account_instagram'),
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

export function resolveDirectUrlResult(query: string): DirectUrlResult | undefined {
  const normalized = normalizeDiscoverInput(query)
  if (!/^https?:\/\/\S+$/i.test(normalized)) {
    return undefined
  }

  const host = hostOf(normalized)
  return {
    targetUrl: normalized,
    siteUrl: host ? `https://${host}` : normalized,
    title: host || normalized,
    description: '直接使用这个地址进入订阅预览，并在下一页校验内容。',
  }
}
