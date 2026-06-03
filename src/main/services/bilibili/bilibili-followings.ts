import { session } from 'electron'

export interface BilibiliFollowing {
  mid: number
  uname: string
}

interface NavResponse {
  code: number
  message?: string
  data?: { mid?: number }
}

interface FollowingsResponse {
  code: number
  message?: string
  data?: {
    total?: number
    list?: Array<{ mid?: number; uname?: string }>
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const response = await session.defaultSession.fetch(url, {
    method: 'GET',
    headers: {
      Referer: 'https://www.bilibili.com/',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    },
  })
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return (await response.json()) as T
}

export async function getBilibiliFollowings(
  maxCount = 300,
): Promise<BilibiliFollowing[]> {
  const nav = await fetchJson<NavResponse>(
    'https://api.bilibili.com/x/web-interface/nav',
  )
  if (nav.code !== 0 || !nav.data?.mid) {
    throw new Error(nav.message || 'Failed to get bilibili account info')
  }
  const vmid = nav.data.mid

  const pageSize = 50
  const followings: BilibiliFollowing[] = []
  const seen = new Set<number>()

  for (let pn = 1; pn <= 20; pn++) {
    if (followings.length >= maxCount) break
    const url = `https://api.bilibili.com/x/relation/followings?vmid=${vmid}&pn=${pn}&ps=${pageSize}&order=desc`
    const page = await fetchJson<FollowingsResponse>(url)
    if (page.code !== 0) {
      throw new Error(page.message || `Failed to fetch followings page ${pn}`)
    }
    const list = page.data?.list || []
    if (list.length === 0) break

    for (const item of list) {
      const mid = item.mid || 0
      const uname = (item.uname || '').trim()
      if (!mid || !uname || seen.has(mid)) continue
      seen.add(mid)
      followings.push({ mid, uname })
      if (followings.length >= maxCount) break
    }

    if (list.length < pageSize) break
  }

  return followings
}
