import { session } from 'electron'
import * as https from 'node:https'
import {
  decodeBasicHtmlEntities,
  decodeHtmlEntities,
  extractTwitterDisplayNameFromText,
  formatFollowerCount,
  normalizeXFollowersLabel,
} from './discover-helpers'
import { assertPublicDiscoveryUrl } from './discover-url-policy'

export type XUserProbeCandidate = {
  username: string
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

/** Fallback Nitter instances for X/Twitter probes. */
export const FALLBACK_NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.poast.org',
  'https://nitter.privacydev.net',
  'https://nitter.d420.de',
]

const X_AVATAR_CACHE_TTL = 10 * 60 * 1000
const X_FOLLOWER_CACHE_TTL = 10 * 60 * 1000
const xAvatarCache = new Map<string, { expiresAt: number; image: string }>()
const xFollowerCache = new Map<
  string,
  { expiresAt: number; followers?: string }
>()

export function extractLikelyXHandle(query: string): string | null {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return null
  // X/Twitter username constraint: up to 15 chars, letters/digits/underscore.
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(clean)) return null
  return clean
}

export function extractLikelyXHandleFromKeywords(query: string): string | null {
  const compact = query
    .trim()
    .replace(/^@+/, '')
    .replace(/[\s.-]+/g, '')
  if (!compact) return null
  if (!/^[a-zA-Z0-9_]{1,15}$/.test(compact)) return null
  return compact
}

export async function fetchXAvatarByUsername(
  username: string,
): Promise<string> {
  const clean = extractLikelyXHandle(username)
  if (!clean) return ''
  const now = Date.now()
  const cached = xAvatarCache.get(clean.toLowerCase())
  if (cached && cached.expiresAt > now) return cached.image
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(clean)}`
    const safeProfileUrl = await assertPublicDiscoveryUrl(profileUrl)
    // Use session fetch to respect proxy settings
    const res = await session.defaultSession.fetch(safeProfileUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!res.ok) return ''
    const html = await res.text()
    const raw =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
      )?.[1] ||
      ''
    const decoded = decodeBasicHtmlEntities(raw)
    if (!/^https?:\/\//i.test(decoded)) return ''
    const image = decoded.replace(/_normal(\.[a-z0-9]+)(\?.*)?$/i, '$1')
    xAvatarCache.set(clean.toLowerCase(), {
      expiresAt: now + X_AVATAR_CACHE_TTL,
      image,
    })
    return image
  } catch {
    return ''
  }
}

export async function fetchXDisplayNameByUsername(
  username: string,
): Promise<string> {
  const clean = username.trim().replace(/^@/, '')
  if (!clean) return ''
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(clean)}`
    const safeProfileUrl = await assertPublicDiscoveryUrl(profileUrl)
    const res = await fetch(safeProfileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
    })
    if (!res.ok) return ''
    const html = await res.text()
    const ogTitle =
      html.match(
        /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
      )?.[1] ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
      )?.[1] ||
      html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] ||
      ''
    const decoded = decodeBasicHtmlEntities(ogTitle)
    return extractTwitterDisplayNameFromText(decoded, clean)
  } catch {
    return ''
  }
}

async function fetchTextViaNodeHttps(
  url: string,
  timeoutMs = 8000,
): Promise<string | undefined> {
  const safeUrl = await assertPublicDiscoveryUrl(url)
  return new Promise((resolve) => {
    const req = https.get(
      safeUrl,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      },
      (res) => {
        if (!res.statusCode || res.statusCode < 200 || res.statusCode >= 300) {
          resolve(undefined)
          res.resume()
          return
        }
        let data = ''
        res.setEncoding('utf8')
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => resolve(data))
      },
    )
    req.setTimeout(timeoutMs, () => {
      req.destroy()
      resolve(undefined)
    })
    req.on('error', () => resolve(undefined))
  })
}

async function fetchXFollowersViaJinaNode(
  usernameRaw: string,
): Promise<string | undefined> {
  const username = usernameRaw.trim().replace(/^@+/, '')
  if (!username) return undefined
  for (const mirrorUrl of [
    `https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`,
    `https://r.jina.ai/http://mobile.x.com/${encodeURIComponent(username)}`,
  ]) {
    const text = await fetchTextViaNodeHttps(mirrorUrl, 10000)
    if (!text) continue
    const decodedText = decodeHtmlEntities(text)
    const patterns = [
      /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
      /followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i,
    ]
    for (const pattern of patterns) {
      const m = decodedText.match(pattern)
      const raw = m?.[0] || m?.[1] || ''
      const followers = normalizeXFollowersLabel(raw)
      if (followers) return followers
    }
  }
  return undefined
}

export async function _fetchXFollowersByUsername(
  usernameRaw: string,
): Promise<string | undefined> {
  const username = usernameRaw.trim().replace(/^@+/, '')
  if (!username) return undefined
  const cacheKey = username.toLowerCase()
  const now = Date.now()
  const cached = xFollowerCache.get(cacheKey)
  if (cached && cached.expiresAt > now) return cached.followers

  // Preferred source: official mobile profile page (usually contains server-rendered follower stats).
  for (const profileUrl of [
    `https://mobile.x.com/${encodeURIComponent(username)}`,
    `https://x.com/${encodeURIComponent(username)}?lang=en`,
  ]) {
    try {
      const safeProfileUrl = await assertPublicDiscoveryUrl(profileUrl)
      const res = await session.defaultSession.fetch(safeProfileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(2500),
      })
      if (!res.ok) continue
      const html = await res.text()
      const decoded = decodeHtmlEntities(html)

      const patterns = [
        // e.g. "219.3M Followers" / "219.3M followers"
        /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
        // e.g. "Followers: 219.3M"
        /followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i,
        // e.g. href="/elonmusk/followers"...>219.3M</span>
        /\/followers["'][^>]*>[\s\S]{0,240}?>([\d][\d.,]*\s*[KMB]?)</i,
      ]

      for (const pattern of patterns) {
        const m = decoded.match(pattern)
        const raw = m?.[0] || m?.[1] || ''
        const followers = normalizeXFollowersLabel(raw)
        if (followers) {
          xFollowerCache.set(cacheKey, {
            expiresAt: now + X_FOLLOWER_CACHE_TTL,
            followers,
          })
          return followers
        }
      }
    } catch {
      // Continue to next official source.
    }
  }

  // Preferred source: public syndication endpoint (no login required).
  try {
    const endpoint = `https://cdn.syndication.twimg.com/widgets/followbutton/info.json?screen_names=${encodeURIComponent(username)}`
    const safeEndpoint = await assertPublicDiscoveryUrl(endpoint)
    const res = await session.defaultSession.fetch(safeEndpoint, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        Referer: 'https://x.com/',
      },
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const data = (await res.json()) as Array<{ followers_count?: number }>
      const followersCount = Number(data?.[0]?.followers_count)
      if (Number.isFinite(followersCount) && followersCount > 0) {
        const followers = `${formatFollowerCount(followersCount)} followers`
        xFollowerCache.set(cacheKey, {
          expiresAt: now + X_FOLLOWER_CACHE_TTL,
          followers,
        })
        return followers
      }
    }
  } catch {
    // Ignore and continue with Nitter fallback.
  }

  // Fallback source: parse profile page metadata/state from x.com directly.
  try {
    const profileUrl = `https://x.com/${encodeURIComponent(username)}`
    const safeProfileUrl = await assertPublicDiscoveryUrl(profileUrl)
    const res = await session.defaultSession.fetch(safeProfileUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
      signal: AbortSignal.timeout(2500),
    })
    if (res.ok) {
      const html = await res.text()
      const decoded = decodeHtmlEntities(html)

      // 1) og:description often includes follower count text.
      const ogDescMatch =
        decoded.match(
          /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
        ) ||
        decoded.match(
          /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
        )
      const ogDesc = (ogDescMatch?.[1] || '').trim()
      const ogFollowers =
        normalizeXFollowersLabel(ogDesc) ||
        (() => {
          const m = ogDesc.match(/([\d][\d.,]*\s*[KMB]?)\s*followers?/i)
          return m?.[0]?.trim()
        })()
      if (ogFollowers) {
        xFollowerCache.set(cacheKey, {
          expiresAt: now + X_FOLLOWER_CACHE_TTL,
          followers: ogFollowers,
        })
        return ogFollowers
      }

      // 2) JSON state may include followers_count as raw number.
      const numericPatterns = [
        /"followers_count"\s*:\s*(\d{1,12})/i,
        /\\\"followers_count\\\"\s*:\s*(\d{1,12})/i,
      ]
      for (const pattern of numericPatterns) {
        const m = decoded.match(pattern)
        const count = Number(m?.[1])
        if (Number.isFinite(count) && count > 0) {
          const followers = `${formatFollowerCount(count)} followers`
          xFollowerCache.set(cacheKey, {
            expiresAt: now + X_FOLLOWER_CACHE_TTL,
            followers,
          })
          return followers
        }
      }
    }
  } catch {
    // Ignore and continue with Nitter fallback.
  }

  // Fallback source (network-bypass): server-side fetched mirror of x.com page.
  // Useful when local environment can open X in browser but Electron main-process requests are blocked.
  for (const mirrorUrl of [
    `https://r.jina.ai/http://x.com/${encodeURIComponent(username)}`,
    `https://r.jina.ai/http://mobile.x.com/${encodeURIComponent(username)}`,
  ]) {
    try {
      const safeMirrorUrl = await assertPublicDiscoveryUrl(mirrorUrl)
      const res = await session.defaultSession.fetch(safeMirrorUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept: 'text/plain,text/html;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(3500),
      })
      if (!res.ok) continue
      const text = decodeHtmlEntities(await res.text())
      const patterns = [
        /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
        /followers?\s*[:：]?\s*([\d][\d.,]*\s*[KMB]?)/i,
      ]
      for (const pattern of patterns) {
        const m = text.match(pattern)
        const raw = m?.[0] || m?.[1] || ''
        const followers = normalizeXFollowersLabel(raw)
        if (followers) {
          xFollowerCache.set(cacheKey, {
            expiresAt: now + X_FOLLOWER_CACHE_TTL,
            followers,
          })
          return followers
        }
      }
    } catch {
      // Continue to next fallback source.
    }
  }

  // Final fallback: use Node https client for environments where Electron fetch path differs from browser/proxy behavior.
  const jinaFollowers = await fetchXFollowersViaJinaNode(username)
  if (jinaFollowers) {
    xFollowerCache.set(cacheKey, {
      expiresAt: now + X_FOLLOWER_CACHE_TTL,
      followers: jinaFollowers,
    })
    return jinaFollowers
  }

  for (const nitterInstance of FALLBACK_NITTER_INSTANCES) {
    try {
      const profileUrl = `${nitterInstance}/${encodeURIComponent(username)}`
      const safeProfileUrl = await assertPublicDiscoveryUrl(profileUrl)
      const res = await session.defaultSession.fetch(safeProfileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(6000),
      })
      if (!res.ok) continue

      const html = await res.text()
      const decoded = decodeHtmlEntities(html)
      const patterns = [
        /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
        /title=["']followers["'][^>]*>\s*<span[^>]*>\s*([\d][\d.,]*\s*[KMB]?)\s*</i,
      ]
      let followers: string | undefined
      for (const pattern of patterns) {
        const m = decoded.match(pattern)
        const raw = m?.[0] || m?.[1] || ''
        followers = normalizeXFollowersLabel(raw)
        if (followers) break
      }
      if (followers) {
        xFollowerCache.set(cacheKey, {
          expiresAt: now + X_FOLLOWER_CACHE_TTL,
          followers,
        })
        return followers
      }
    } catch {
      // Ignore single-instance failures and continue to next instance.
    }
  }

  xFollowerCache.set(cacheKey, { expiresAt: now + 30 * 1000 })
  return undefined
}

export async function probeXUsersByKeyword(
  query: string,
  rsshubInstance: string,
): Promise<XUserProbeCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return []
  console.log(`[X Search] Starting search for "${clean}"`)

  const out: XUserProbeCandidate[] = []
  const candidateIndexByKey = new Map<string, number>()
  const pushCandidate = (
    usernameRaw: string,
    displayName = '',
    description = 'X user',
    sourceScore = 1,
    followers?: string,
  ) => {
    const username = usernameRaw.trim().replace(/^@+/, '')
    if (!username) return 0
    const key = username.toLowerCase()
    const existingIndex = candidateIndexByKey.get(key)
    if (existingIndex !== undefined) {
      const existing = out[existingIndex] as
        | (XUserProbeCandidate & { sourceScore?: number })
        | undefined
      if (!existing) return 0
      const existingScore = existing.sourceScore || 1
      const nextTitle = displayName
        ? `${displayName} (@${username}) - X`
        : `${username} - X`
      if (followers && !existing.followers) existing.followers = followers
      if (
        description &&
        (existing.description === 'X user' || !existing.description)
      )
        existing.description = description
      if (displayName && !/\(@/.test(existing.title)) existing.title = nextTitle
      if (sourceScore > existingScore) existing.sourceScore = sourceScore
      return 0
    }
    const image = `https://unavatar.io/x/${encodeURIComponent(username)}`
    const title = displayName
      ? `${displayName} (@${username}) - X`
      : `${username} - X`
    out.push({
      username,
      title,
      description,
      image,
      feedUrl: `${rsshubInstance}/x/user/${encodeURIComponent(username)}`,
      followers,
      sourceScore,
    } as XUserProbeCandidate & { sourceScore?: number })
    candidateIndexByKey.set(key, out.length - 1)
    return 1
  }

  // If input already looks like a username, always keep it as a high-priority candidate.
  const directHandle = extractLikelyXHandle(clean)
  if (directHandle) {
    console.log(`[X Search] Input looks like a handle: @${directHandle}`)
    pushCandidate(directHandle, '', 'X user', 3)
  } else {
    // Also support keyword input like "elon musk" -> "elonmusk".
    const compactHandle = extractLikelyXHandleFromKeywords(clean)
    if (compactHandle) {
      console.log(
        `[X Search] Input compacted to handle candidate: @${compactHandle}`,
      )
      pushCandidate(compactHandle, '', 'X user', 2)
    }
  }

  // Try Nitter instances for display name search (works without login)
  for (const nitterInstance of FALLBACK_NITTER_INSTANCES) {
    try {
      const searchUrl = `${nitterInstance}/search?f=users&q=${encodeURIComponent(clean)}`
      console.log(`[X Search] Trying Nitter: ${searchUrl}`)
      const safeSearchUrl = await assertPublicDiscoveryUrl(searchUrl)
      const res = await session.defaultSession.fetch(safeSearchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      })
      console.log(`[X Search] Nitter status: ${res.status}`)
      if (res.ok) {
        const html = await res.text()
        console.log(`[X Search] Nitter HTML length: ${html.length}`)

        // Nitter search results contain user profiles in specific patterns
        // Look for profile links: <a class="profile-link" href="/username">
        const profileLinkRegex =
          /<a[^>]*class="[^"]*profile-card[^"]*"[^>]*href="\/([a-zA-Z0-9_]{1,15})"/gi
        let match
        while ((match = profileLinkRegex.exec(html)) !== null) {
          const username = match[1]
          if (username) {
            // Try to extract display name from the card
            const cardStart = html.lastIndexOf('<', match.index)
            const cardEnd = html.indexOf('</a>', match.index)
            const cardHtml = html.slice(
              Math.max(0, cardStart),
              cardEnd > 0 ? cardEnd + 4 : html.length,
            )
            const nameMatch = cardHtml.match(
              /<div[^>]*class="[^"]*fullname[^"]*"[^>]*>([^<]+)</i,
            )
            const displayName = nameMatch ? nameMatch[1].trim() : ''
            const followersMatch = cardHtml.match(
              /([\d][\d.,]*\s*[KMB]?)\s*followers?/i,
            )
            const followers = followersMatch
              ? normalizeXFollowersLabel(followersMatch[0])
              : undefined
            console.log(
              `[X Search] Found via Nitter: @${username} (${displayName})`,
            )
            pushCandidate(username, displayName, '', 2, followers)
            if (out.length >= 10) break
          }
        }

        // Alternative pattern: generic user links
        if (out.length === 0) {
          const userLinkRegex =
            /href="\/([a-zA-Z0-9_]{1,15})"(?![^<]*class="[^"]*(?:search|explore|home)[^"]*")/gi
          const excludePaths = [
            'search',
            'home',
            'explore',
            'i',
            'settings',
            'about',
            'privacy',
            'terms',
          ]
          while ((match = userLinkRegex.exec(html)) !== null) {
            const username = match[1]
            if (excludePaths.includes(username.toLowerCase())) continue
            if (username) {
              console.log(`[X Search] Found via Nitter (alt): @${username}`)
              pushCandidate(username, '', '', 1)
              if (out.length >= 10) break
            }
          }
        }

        if (out.length > 0) break // Found results, no need to try other instances
      }
    } catch (e) {
      console.log(`[X Search] Nitter error:`, e)
    }
  }

  // Try X.com search (requires login for most results, but may work for some queries)
  try {
    const searchUrl = `https://x.com/search?q=${encodeURIComponent(clean)}&f=user`
    console.log(`[X Search] Trying X.com: ${searchUrl}`)
    const safeSearchUrl = await assertPublicDiscoveryUrl(searchUrl)
    const res = await session.defaultSession.fetch(safeSearchUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    console.log(`[X Search] X.com status: ${res.status}`)
    if (res.ok) {
      const html = await res.text()
      console.log(`[X Search] X.com HTML length: ${html.length}`)

      // Try to extract user data from __INITIAL_STATE__
      const stateMatch = html.match(
        /<script[^>]*>window\.__INITIAL_STATE__\s*=\s*(\{[\s\S]*?\});?\s*<\/script>/i,
      )
      if (stateMatch?.[1]) {
        try {
          const data = JSON.parse(stateMatch[1])
          const users = data?.entities?.users?.users || {}
          console.log(
            `[X Search] Found ${Object.keys(users).length} users in __INITIAL_STATE__`,
          )
          for (const [, user] of Object.entries(users) as [string, any][]) {
            const screenName = user?.screen_name
            if (!screenName) continue
            const name = user?.name || ''
            const desc = user?.description || ''
            const followersCount = Number(user?.followers_count)
            const followers =
              Number.isFinite(followersCount) && followersCount > 0
                ? `${formatFollowerCount(followersCount)} followers`
                : undefined
            pushCandidate(screenName, name, desc, 2, followers)
            if (out.length >= 20) break
          }
        } catch (_e) {
          console.log(`[X Search] Failed to parse __INITIAL_STATE__`)
        }
      }

      // Fallback: extract from HTML meta tags and links
      if (out.length === 0) {
        // Look for user profile links in the HTML
        const userLinkRegex =
          /href="\/([a-zA-Z0-9_]{1,15})"(?![^<]*class="[^"]*(?:search|explore|home|status|hashtag)[^"]*")/gi
        let match
        const excludePaths = [
          'search',
          'home',
          'explore',
          'i',
          'status',
          'hashtag',
          'settings',
          'notifications',
          'messages',
          'bookmarks',
          'lists',
          'compose',
          'intent',
          'share',
        ]
        while ((match = userLinkRegex.exec(html)) !== null) {
          const username = match[1]
          if (excludePaths.includes(username.toLowerCase())) continue
          if (username) {
            console.log(`[X Search] Found via HTML: @${username}`)
            pushCandidate(username, '', '', 1)
            if (out.length >= 10) break
          }
        }
      }
    }
  } catch (e) {
    console.log(`[X Search] X.com error:`, e)
  }

  console.log(`[X Search] Total candidates: ${out.length}`)

  // Use sourceScore for sorting
  const scored = out
    .map((candidate: any) => {
      return { candidate, score: candidate.sourceScore || 1 }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((item) => {
      const { sourceScore: _sourceScore, ...rest } = item.candidate as any
      return rest as XUserProbeCandidate
    })

  console.log(`[X Search] Final results: ${scored.length}`)
  return scored
}
