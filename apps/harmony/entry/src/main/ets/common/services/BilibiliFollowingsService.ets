import http from '@ohos.net.http'
import {
  BilibiliImportProgress,
  FeedViewType,
  PendingBilibiliCreator,
} from '../models/LivoModels'
import { FeedDraft, FeedRepository } from '../repositories/FeedRepository'
import { AccountSessionService } from './AccountSessionService'
import { DEFAULT_RSSHUB_INSTANCE } from './DiscoverService'

const BILIBILI_PAGE_SIZE = 50
const BILIBILI_MAX_COUNT = 300
const DESKTOP_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'

interface BilibiliNavResponse {
  code?: number
  message?: string
  data?: BilibiliNavData
}

interface BilibiliNavData {
  mid?: number
  uname?: string
  isLogin?: boolean
}

interface BilibiliFollowingsResponse {
  code?: number
  message?: string
  data?: BilibiliFollowingsData
}

interface BilibiliFollowingsData {
  list?: BilibiliFollowingItem[]
}

interface BilibiliFollowingItem {
  mid?: number
  uname?: string
}

function extractBilibiliUidFromFeedUrl(rawUrl: string): number | null {
  try {
    const matched = rawUrl.match(/\/bilibili\/user\/(?:video|dynamic|article)\/(\d+)/i)
    if (!matched?.[1]) {
      return null
    }
    const uid = Number(matched[1])
    return Number.isFinite(uid) && uid > 0 ? uid : null
  } catch (_error) {
    return null
  }
}

export class BilibiliFollowingsService {
  static async preview(): Promise<PendingBilibiliCreator[]> {
    const sessdata = await AccountSessionService.bilibiliSessData()
    if (!sessdata) {
      throw new Error('请先填写有效的 Bilibili SESSDATA')
    }

    const nav = await BilibiliFollowingsService.fetchJson<BilibiliNavResponse>(
      'https://api.bilibili.com/x/web-interface/nav',
      sessdata,
    )

    if (nav.code !== 0 || !nav.data?.isLogin || !nav.data?.mid) {
      throw new Error(nav.message || '当前 SESSDATA 无法读取 Bilibili 账号信息')
    }

    const existingFeeds = await FeedRepository.list()
    const existingUids = new Set<number>()
    existingFeeds.forEach((feed) => {
      const uid = extractBilibiliUidFromFeedUrl(feed.url)
      if (uid) {
        existingUids.add(uid)
      }
    })

    const creators: PendingBilibiliCreator[] = []
    const seen = new Set<number>()
    for (let page = 1; page <= 20; page += 1) {
      if (creators.length >= BILIBILI_MAX_COUNT) {
        break
      }

      const pageData = await BilibiliFollowingsService.fetchJson<BilibiliFollowingsResponse>(
        `https://api.bilibili.com/x/relation/followings?vmid=${nav.data.mid}&pn=${page}&ps=${BILIBILI_PAGE_SIZE}&order=desc`,
        sessdata,
      )

      if (pageData.code !== 0) {
        throw new Error(pageData.message || `读取关注列表第 ${page} 页失败`)
      }

      const list = pageData.data?.list || []
      if (list.length === 0) {
        break
      }

      list.forEach((item) => {
        const mid = Number(item.mid || 0)
        const uname = String(item.uname || '').trim()
        if (!Number.isFinite(mid) || mid <= 0 || !uname || seen.has(mid) || creators.length >= BILIBILI_MAX_COUNT) {
          return
        }
        seen.add(mid)
        creators.push({
          mid,
          uname,
          exists: existingUids.has(mid),
        })
      })

      if (list.length < BILIBILI_PAGE_SIZE) {
        break
      }
    }

    return creators
  }

  static async importCreators(
    creators: PendingBilibiliCreator[],
    views: FeedViewType[],
    onProgress: (progress: BilibiliImportProgress) => void,
  ): Promise<void> {
    const existingFeeds = await FeedRepository.list()
    const existingUrls = new Set<string>()
    existingFeeds.forEach((feed) => existingUrls.add(feed.url))

    const normalizedViews = views.length > 0 ? views : [FeedViewType.Videos]
    const total = creators.length * normalizedViews.length
    let completed = 0
    let imported = 0
    let skipped = 0
    let failed = 0

    onProgress({ total, completed, imported, skipped, failed })

    for (const creator of creators) {
      for (const view of normalizedViews) {
        const draft = BilibiliFollowingsService.createDraft(creator, view)
        try {
          if (existingUrls.has(draft.url)) {
            skipped += 1
          } else {
            await FeedRepository.create(draft)
            existingUrls.add(draft.url)
            imported += 1
          }
        } catch (_error) {
          failed += 1
        } finally {
          completed += 1
          onProgress({ total, completed, imported, skipped, failed })
        }
      }
    }
  }

  private static createDraft(creator: PendingBilibiliCreator, view: FeedViewType): FeedDraft {
    const base = DEFAULT_RSSHUB_INSTANCE.replace(/\/+$/, '')
    let route = 'video'
    if (view === FeedViewType.SocialMedia) {
      route = 'dynamic'
    } else if (view === FeedViewType.Articles) {
      route = 'article'
    }

    return {
      title: creator.uname,
      url: `${base}/bilibili/user/${route}/${creator.mid}`,
      siteUrl: `https://space.bilibili.com/${creator.mid}`,
      imageUrl: '',
      description: `Bilibili ${creator.uname}`,
      category: 'Bilibili',
      view,
      showInAll: true,
    }
  }

  private static async fetchJson<T>(url: string, sessdata: string): Promise<T> {
    const request = http.createHttp()
    try {
      const response = await request.request(url, {
        method: http.RequestMethod.GET,
        connectTimeout: 8000,
        readTimeout: 8000,
        header: {
          'User-Agent': DESKTOP_USER_AGENT,
          'Accept': 'application/json, text/plain, */*',
          'Referer': 'https://www.bilibili.com/',
          'Cookie': `SESSDATA=${sessdata}`,
        },
      })

      if (response.responseCode !== 200) {
        throw new Error(`HTTP ${response.responseCode}`)
      }

      return JSON.parse(String(response.result)) as T
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Bilibili 接口请求失败')
    } finally {
      try {
        request.destroy()
      } catch (_error) {
      }
    }
  }
}
