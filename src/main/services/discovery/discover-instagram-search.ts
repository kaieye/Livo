import { session } from 'electron'
import { decodeHtmlEntities, formatFollowerCount } from './discover-helpers'
import { assertPublicDiscoveryUrl } from './discover-url-policy'

export const INSTAGRAM_DISCOVER_PROFILE_TIMEOUT_MS = 1600

export interface InstagramDiscoverCandidateShape {
  username: string
  title: string
  description: string
  image: string
  feedUrl: string
}

export function buildInstagramDiscoverAvatar(usernameRaw: string): string {
  const username = usernameRaw.trim().replace(/^@+/, '')
  if (!username) return ''
  return `https://unavatar.io/instagram/${encodeURIComponent(username)}?fallback=false`
}

export function createInstagramDiscoverCandidate(params: {
  username: string
  rsshubInstance: string
  displayName?: string
  description?: string
}): InstagramDiscoverCandidateShape {
  const username = params.username.trim().replace(/^@+/, '')
  const displayName = (params.displayName || '').trim()
  return {
    username,
    title: displayName
      ? `${displayName} (@${username}) - Instagram`
      : `${username} - Instagram`,
    description: params.description || 'Instagram user',
    image: buildInstagramDiscoverAvatar(username),
    feedUrl: `${params.rsshubInstance}/instagram/user/${encodeURIComponent(username)}`,
  }
}

// ── Instagram probe / avatar helpers ──

export type InstagramUserProbeCandidate = {
  username: string
  title: string
  description: string
  image: string
  feedUrl: string
  followers?: string
}

function cleanInstagramDisplayName(
  rawTitle: string | undefined,
  username: string,
): string {
  const decoded = decodeHtmlEntities((rawTitle || '').trim())
  if (!decoded) return ''
  const escapedUser = username.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return decoded
    .replace(new RegExp(`\\s*\\(@?${escapedUser}\\)\\s*`, 'i'), ' ')
    .replace(/\s*[•·]\s*Instagram photos and videos\s*$/i, '')
    .replace(/\s*-\s*Instagram\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeImageUrl(input: string): string {
  return decodeHtmlEntities((input || '').trim()).replace(/\\\//g, '/')
}

function _isInstagramLetterFallbackAvatar(url?: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw.startsWith('data:image/svg+xml')) return false
  return (
    raw.includes('833ab4') || raw.includes('e1306c') || raw.includes('f77737')
  )
}

async function _withSoftTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T | undefined> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(undefined), timeoutMs)
    promise
      .then((value) => {
        clearTimeout(timer)
        resolve(value)
      })
      .catch(() => {
        clearTimeout(timer)
        resolve(undefined)
      })
  })
}

async function tryConvertImageUrlToDataUri(
  imageUrl: string,
): Promise<string | undefined> {
  const normalizedUrl = normalizeImageUrl(imageUrl)
  if (!/^https?:\/\//i.test(normalizedUrl)) return undefined
  try {
    const safeUrl = await assertPublicDiscoveryUrl(normalizedUrl)
    const res = await session.defaultSession.fetch(safeUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: 'https://www.instagram.com/',
        Origin: 'https://www.instagram.com',
        'x-ig-app-id': '936619743392459',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.startsWith('image/')) return undefined
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length < 64) return undefined
    const ext = normalizedUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
    const mime = contentType.startsWith('image/')
      ? contentType.split(';')[0]
      : ext === 'jpg' || ext === 'jpeg'
        ? 'image/jpeg'
        : ext === 'png'
          ? 'image/png'
          : ext === 'webp'
            ? 'image/webp'
            : ext === 'gif'
              ? 'image/gif'
              : 'image/jpeg'
    return `data:${mime};base64,${buffer.toString('base64')}`
  } catch {
    return undefined
  }
}

export async function fetchInstagramAvatarByUsername(
  username: string,
): Promise<string | undefined> {
  const clean = username.trim().replace(/^@/, '')
  if (!clean) return undefined

  // Method 1: Use Instagram's public JSON endpoint (no auth required)
  try {
    const jsonUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/?__a=1&__d=dis`
    const safeJsonUrl = await assertPublicDiscoveryUrl(jsonUrl)
    const jsonRes = await session.defaultSession.fetch(safeJsonUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'application/json, text/plain, */*',
        'Accept-Language': 'en-US,en;q=0.5',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
      },
    })
    if (jsonRes.ok) {
      const text = await jsonRes.text()
      let jsonText = text
      // Handle JSONP wrapper: for (;;);{...}
      if (jsonText.startsWith('for (;;);')) {
        jsonText = jsonText.substring('for (;;);'.length)
      }
      try {
        const json = JSON.parse(jsonText) as {
          graphql?: {
            user?: { profile_pic_url?: string; profile_pic_url_hd?: string }
          }
          logging_page_id?: string
        }
        const avatarUrl =
          json?.graphql?.user?.profile_pic_url_hd ||
          json?.graphql?.user?.profile_pic_url
        if (avatarUrl && /^https?:\/\//i.test(avatarUrl)) {
          const normalizedAvatarUrl = normalizeImageUrl(avatarUrl)
          console.log(
            `[Instagram Avatar] Found via __a=1 for ${clean}: ${normalizedAvatarUrl.substring(0, 80)}...`,
          )
          const inlined = await tryConvertImageUrlToDataUri(normalizedAvatarUrl)
          if (inlined) return inlined
          return normalizedAvatarUrl
        }
      } catch {
        console.log(`[Instagram Avatar] __a=1 JSON parse failed for ${clean}`)
      }
    }
  } catch (e) {
    console.log(`[Instagram Avatar] __a=1 failed for ${clean}:`, e)
  }

  // Method 2: Parse profile page HTML for og:image
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/`
  try {
    const safeProfileUrl = await assertPublicDiscoveryUrl(profileUrl)
    const res = await session.defaultSession.fetch(safeProfileUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    })
    if (!res.ok) return undefined
    const html = await res.text()

    // Try og:image meta tag
    let avatarUrl: string | undefined
    const ogPatterns = [
      /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      /<meta[^>]+name=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']og:image["']/i,
    ]
    for (const pattern of ogPatterns) {
      const og = html.match(pattern)
      if (og?.[1] && /^https?:\/\//i.test(og[1])) {
        avatarUrl = normalizeImageUrl(og[1])
        break
      }
    }

    // Try JSON-LD structured data
    if (!avatarUrl) {
      const jsonLdMatch = html.match(
        /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
      )
      if (jsonLdMatch?.[1]) {
        try {
          const jsonLd = JSON.parse(jsonLdMatch[1])
          const imageUrl =
            jsonLd?.image?.url || jsonLd?.image?.[0]?.url || jsonLd?.image?.[0]
          if (typeof imageUrl === 'string' && /^https?:\/\//i.test(imageUrl))
            avatarUrl = normalizeImageUrl(imageUrl)
        } catch {
          // JSON parse failed, continue
        }
      }
    }

    // Try profile_pic_url_hd in scripts
    if (!avatarUrl) {
      const hd = html.match(/"profile_pic_url_hd"\s*:\s*"(https?:[^"]+)"/i)
      if (hd?.[1]) {
        const decoded = normalizeImageUrl(hd[1])
        if (/^https?:\/\//i.test(decoded)) avatarUrl = decoded
      }
    }

    if (avatarUrl) {
      console.log(
        `[Instagram Avatar] Found via HTML parse for ${clean}: ${avatarUrl.substring(0, 80)}...`,
      )
      // Try to fetch avatar image and convert to base64 data URI
      // Instagram CDN requires specific headers to avoid 403
      try {
        const safeAvatarUrl = await assertPublicDiscoveryUrl(avatarUrl)
        const avatarRes = await session.defaultSession.fetch(safeAvatarUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
            Referer: 'https://www.instagram.com/',
            Origin: 'https://www.instagram.com',
            'x-ig-app-id': '936619743392459',
          },
        })
        if (avatarRes.ok) {
          const contentType = (
            avatarRes.headers.get('content-type') || ''
          ).toLowerCase()
          if (contentType && !contentType.startsWith('image/')) {
            console.log(
              `[Instagram Avatar] Avatar response is not image for ${clean}: ${contentType}`,
            )
            return undefined
          }
          const arrayBuffer = await avatarRes.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)
          if (buffer.length < 64) return undefined
          const extension = avatarUrl
            .split('.')
            .pop()
            ?.split('?')[0]
            ?.toLowerCase()
          const mimeType = contentType.startsWith('image/')
            ? contentType.split(';')[0]
            : extension === 'jpg' || extension === 'jpeg'
              ? 'image/jpeg'
              : extension === 'png'
                ? 'image/png'
                : extension === 'webp'
                  ? 'image/webp'
                  : extension === 'gif'
                    ? 'image/gif'
                    : 'image/jpeg'
          const base64 = buffer.toString('base64')
          console.log(
            `[Instagram Avatar] Converted to base64 for ${clean} (${buffer.length} bytes)`,
          )
          return `data:${mimeType};base64,${base64}`
        } else {
          console.log(
            `[Instagram Avatar] Avatar fetch failed for ${clean}: ${avatarRes.status}`,
          )
        }
      } catch (e) {
        console.log(`[Instagram Avatar] Avatar fetch error for ${clean}:`, e)
      }
      return avatarUrl
    }

    // Try picuki.com (Instagram第三方查看器) as alternative source
    try {
      const picukiUrl = `https://www.picuki.com/profile/${encodeURIComponent(clean)}`
      const safePicukiUrl = await assertPublicDiscoveryUrl(picukiUrl)
      const picukiRes = await session.defaultSession.fetch(safePicukiUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
      })
      if (picukiRes.ok) {
        const picukiHtml = await picukiRes.text()
        // Try to extract profile image from picuki
        const picukiAvatarMatch =
          picukiHtml.match(
            /<img[^>]+class="[^"]*profile[^"]*"[^>]+src=["']([^"']+)["']/i,
          ) ||
          picukiHtml.match(
            /<img[^>]+src=["']([^"']*picuki[^"']*profile[^"']*)["'][^>]*class=["'][^"']*profile[^"']*["']/i,
          ) ||
          picukiHtml.match(
            /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
          )
        if (
          picukiAvatarMatch?.[1] &&
          /^https?:\/\//i.test(picukiAvatarMatch[1])
        ) {
          const avatarFromPicuki = picukiAvatarMatch[1]
          console.log(
            `[Instagram Avatar] Found via picuki for ${clean}: ${avatarFromPicuki.substring(0, 80)}...`,
          )
          // Try to fetch as base64
          try {
            const safeAvatarFromPicuki =
              await assertPublicDiscoveryUrl(avatarFromPicuki)
            const res = await session.defaultSession.fetch(
              safeAvatarFromPicuki,
              {
                headers: {
                  'User-Agent': 'Mozilla/5.0',
                  Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
                },
              },
            )
            if (res.ok) {
              const arrayBuffer = await res.arrayBuffer()
              const buffer = Buffer.from(arrayBuffer)
              const ext = avatarFromPicuki
                .split('.')
                .pop()
                ?.split('?')[0]
                ?.toLowerCase()
              const mime =
                ext === 'jpg' || ext === 'jpeg'
                  ? 'image/jpeg'
                  : ext === 'png'
                    ? 'image/png'
                    : ext === 'webp'
                      ? 'image/webp'
                      : ext === 'gif'
                        ? 'image/gif'
                        : 'image/jpeg'
              return `data:${mime};base64,${buffer.toString('base64')}`
            }
          } catch {
            // Ignore and continue to fallback avatar
          }
        }
      }
    } catch (e) {
      console.log(`[Instagram Avatar] picuki failed for ${clean}:`, e)
    }

    console.log(`[Instagram Avatar] No avatar found for ${clean}`)
    return undefined
  } catch (e) {
    console.log(`[Instagram Avatar] HTML parse failed for ${clean}:`, e)
  }

  return undefined
}

export function extractLikelyInstagramHandle(query: string): string | null {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return null
  // Instagram username: 1-30 chars, letters/digits/underscores/periods
  if (!/^[a-zA-Z0-9_.]{1,30}$/.test(clean)) return null
  return clean
}

export async function probeInstagramUsersByKeyword(
  query: string,
  rsshubInstance: string,
): Promise<InstagramUserProbeCandidate[]> {
  const clean = query.trim().replace(/^@+/, '')
  if (!clean) return []
  console.log(`[Instagram Search] Starting search for "${clean}"`)

  const out: InstagramUserProbeCandidate[] = []
  const seen = new Set<string>()
  const pushCandidate = (
    usernameRaw: string,
    displayName = '',
    description = 'Instagram user',
    _sourceScore = 1,
  ) => {
    const username = usernameRaw.trim().replace(/^@+/, '')
    if (!username) return 0
    const key = username.toLowerCase()
    if (seen.has(key)) return 0
    seen.add(key)
    out.push({
      ...createInstagramDiscoverCandidate({
        username,
        rsshubInstance,
        displayName,
        description,
      }),
    } as InstagramUserProbeCandidate & { sourceScore?: number })
    return 1
  }

  // If input already looks like a username, always keep it as a high-priority candidate
  const directHandle = extractLikelyInstagramHandle(clean)
  if (directHandle) {
    console.log(
      `[Instagram Search] Input looks like a handle: @${directHandle}`,
    )
    pushCandidate(directHandle, '', '', 3)
  }

  // Try to fetch profile info if it looks like a valid username
  if (directHandle) {
    try {
      const profileUrl = `https://www.instagram.com/${encodeURIComponent(directHandle)}/`
      console.log(`[Instagram Search] Trying to fetch profile: ${profileUrl}`)
      const safeProfileUrl = await assertPublicDiscoveryUrl(profileUrl)
      const res = await session.defaultSession.fetch(safeProfileUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
        },
        signal: AbortSignal.timeout(INSTAGRAM_DISCOVER_PROFILE_TIMEOUT_MS),
      })
      if (res.ok) {
        const html = await res.text()
        // Try to extract display name from meta tags
        const ogTitle =
          html.match(
            /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
          )?.[1] ||
          html.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i,
          )?.[1]
        const ogDesc =
          html.match(
            /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
          )?.[1] ||
          html.match(
            /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i,
          )?.[1]

        // Try to extract followers from JSON-LD structured data
        let followersFromJsonLd: string | undefined
        const jsonLdScripts = html.match(
          /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi,
        )
        if (jsonLdScripts) {
          for (const script of jsonLdScripts) {
            const jsonMatch = script.match(
              /<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i,
            )
            if (jsonMatch?.[1]) {
              try {
                const jsonLd = JSON.parse(jsonMatch[1])
                // Instagram uses @type: "Profile" with followedBy count
                const followedBy =
                  jsonLd?.aggregateRating?.ratingCount ||
                  jsonLd?.interactionStatistic?.find(
                    (s: {
                      interactionType: string
                      userInteractionCount: number
                    }) => s?.interactionType?.includes('Follow'),
                  )?.userInteractionCount ||
                  jsonLd?.aggregateRating?.reviewCount
                if (followedBy && typeof followedBy === 'number') {
                  followersFromJsonLd = formatFollowerCount(followedBy)
                  break
                }
              } catch {
                // JSON parse failed, continue to next script
              }
            }
          }
        }

        // Also try to extract from window._sharedData if available
        if (!followersFromJsonLd) {
          const sharedDataMatch = html.match(
            /window\._sharedData\s*=\s*({.+?});\s*<\/script>/i,
          )
          if (sharedDataMatch?.[1]) {
            try {
              const sharedData = JSON.parse(sharedDataMatch[1])
              const entryData =
                sharedData?.entry_data?.ProfilePage?.[0]?.graphql?.user
              if (entryData) {
                const count =
                  entryData.edge_followed_by?.count || entryData.follower_count
                if (count) {
                  followersFromJsonLd = formatFollowerCount(count)
                }
              }
            } catch {
              // Ignore parse errors
            }
          }
        }

        if (ogTitle || ogDesc || followersFromJsonLd) {
          // Extract follower count from og:description (e.g., "1.2M followers")
          let followers: string | undefined
          if (ogDesc) {
            const followersMatch = ogDesc.match(/([\d.]+[KMB]?)\s*followers?/i)
            if (followersMatch) {
              followers = followersMatch[1] + ' followers'
            }
          }
          // Use JSON-LD followers if og:description didn't have it
          followers = followers || followersFromJsonLd
          const displayName = cleanInstagramDisplayName(ogTitle, directHandle)
          if (
            displayName &&
            displayName.toLowerCase() !== directHandle.toLowerCase()
          ) {
            console.log(`[Instagram Search] Found display name: ${displayName}`)
            // Update the first candidate with better info
            const first = out[0]
            if (first) {
              first.title = `${displayName} (@${directHandle}) - Instagram`
              first.description = followers
                ? `${followers}`
                : ogDesc || 'Instagram user'
              first.followers = followers
            }
          } else if (followers) {
            // Even without display name, update with follower count
            const first = out[0]
            if (first) {
              first.description = followers
              first.followers = followers
            }
          }
        }
      }
    } catch (e) {
      console.log(`[Instagram Search] Profile fetch error:`, e)
    }
  }

  console.log(`[Instagram Search] Total candidates: ${out.length}`)
  return out
}
