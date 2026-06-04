import { session } from 'electron'
import { computeMatchTier } from './discover-dedupe'
import { formatFollowerCount } from './discover-helpers'
import { assertPublicDiscoveryUrl } from './discover-url-policy'

export type BilibiliUserProbeCandidate = {
  uid: string
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

export async function fetchBilibiliNameByUid(
  uid: string,
): Promise<string | null> {
  const referer = `https://space.bilibili.com/${encodeURIComponent(uid)}`
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
    `https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(uid)}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const safeEndpoint = await assertPublicDiscoveryUrl(endpoint)
      const res = await fetch(safeEndpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json, text/plain, */*',
          Referer: referer,
          Origin: 'https://www.bilibili.com',
        },
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok) continue
      const json = (await res.json()) as {
        code?: number
        data?: { card?: { name?: string }; name?: string }
      }
      if (json.code !== 0) continue
      const name = (json.data?.card?.name || json.data?.name || '').trim()
      if (name) return name
    } catch {
      // Ignore single endpoint failure.
    }
  }
  return null
}

export async function fetchBilibiliAvatarByUid(
  uid: string,
): Promise<string | null> {
  const referer = `https://space.bilibili.com/${encodeURIComponent(uid)}`
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
    `https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(uid)}`,
  ]

  for (const endpoint of endpoints) {
    try {
      const safeEndpoint = await assertPublicDiscoveryUrl(endpoint)
      const res = await fetch(safeEndpoint, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json, text/plain, */*',
          Referer: referer,
          Origin: 'https://www.bilibili.com',
        },
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok) continue
      const json = (await res.json()) as {
        code?: number
        data?: { card?: { face?: string }; face?: string }
      }
      if (json.code !== 0) continue
      const face = (json.data?.card?.face || json.data?.face || '').trim()
      if (face) return face
    } catch {
      // Ignore single endpoint failure.
    }
  }
  return null
}

export async function probeBilibiliUsersByKeyword(
  query: string,
  rsshubInstance: string,
): Promise<BilibiliUserProbeCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return []
  const candidates: Array<BilibiliUserProbeCandidate & { score: number }> = []
  const seen = new Set<string>()
  try {
    const endpoint = `https://api.bilibili.com/x/web-interface/search/type?search_type=bili_user&keyword=${encodeURIComponent(clean)}`
    const safeEndpoint = await assertPublicDiscoveryUrl(endpoint)
    // Use Electron session fetch for consistent network behavior
    const res = await session.defaultSession.fetch(safeEndpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'zh-CN,zh;q=0.9',
        Referer: 'https://www.bilibili.com/',
        Origin: 'https://www.bilibili.com',
      },
    })
    if (res.ok) {
      const json = (await res.json()) as {
        code?: number
        data?: {
          result?: Array<{
            mid?: number
            uname?: string
            usign?: string
            upic?: string
            fans?: number | string
          }>
        }
      }
      if (json.code === 0) {
        for (const user of (json.data?.result || []).slice(0, 80)) {
          const mid = user.mid ? String(user.mid) : ''
          if (!mid || seen.has(mid)) continue
          seen.add(mid)
          const uname = (user.uname || `UID ${mid}`)
            .replace(/<[^>]+>/g, '')
            .trim()
          const usign = (user.usign || 'Bilibili user')
            .replace(/<[^>]+>/g, '')
            .trim()
          const nameTier = computeMatchTier(clean, uname)
          const signTier = computeMatchTier(clean, usign)
          const midTier = computeMatchTier(clean, mid)
          const score = nameTier * 1000 + signTier * 200 + midTier * 120
          if (score <= 0) continue
          const rawFans =
            typeof user.fans === 'string' ? Number(user.fans) : user.fans
          const followers =
            typeof rawFans === 'number' &&
            Number.isFinite(rawFans) &&
            rawFans >= 0
              ? `${formatFollowerCount(rawFans)} 粉丝`
              : undefined
          candidates.push({
            uid: mid,
            title: `${uname} - Bilibili`,
            description: usign,
            image: user.upic || '',
            // Social tab should use dynamic route.
            feedUrl: `${rsshubInstance}/bilibili/user/dynamic/${mid}`,
            followers,
            score,
          })
        }
      }
    }
  } catch {
    // Ignore Bilibili search failures.
  }
  return candidates
    .sort((a, b) => b.score - a.score)
    .slice(0, 100)
    .map(({ score: _score, ...candidate }) => candidate)
}
