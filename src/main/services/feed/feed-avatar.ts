function extractBilibiliUid(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const m = u.pathname.match(/\/bilibili\/user\/(?:video|dynamic)\/(\d+)/i)
    return m?.[1] || null
  } catch {
    return null
  }
}

function extractInstagramUsername(feedUrl: string): string | null {
  try {
    const u = new URL(feedUrl)
    const path = u.pathname || ''
    const ig = path.match(/\/instagram\/user\/([^/?#]+)/i)
    if (ig?.[1]) return decodeURIComponent(ig[1]).replace(/^@/, '')
    const picnob = path.match(/\/picnob(?:\.info)?\/user\/([^/?#]+)/i)
    if (picnob?.[1]) return decodeURIComponent(picnob[1]).replace(/^@/, '')
    const pixnoy = path.match(/\/pixnoy\/user\/([^/?#]+)/i)
    if (pixnoy?.[1]) return decodeURIComponent(pixnoy[1]).replace(/^@/, '')
    const piokok = path.match(/\/piokok\/user\/([^/?#]+)/i)
    if (piokok?.[1]) return decodeURIComponent(piokok[1]).replace(/^@/, '')
    const pixwox = path.match(/\/pixwox\/user\/([^/?#]+)/i)
    if (pixwox?.[1]) return decodeURIComponent(pixwox[1]).replace(/^@/, '')
    // rsshub://picnob/user/{name} or rsshub://instagram/user/{name}
    if (
      /^(picnob|picnob\.info|pixnoy|piokok|pixwox|instagram)$/i.test(u.hostname)
    ) {
      const hostRoute = path.match(/\/user\/([^/?#]+)/i)
      if (hostRoute?.[1])
        return decodeURIComponent(hostRoute[1]).replace(/^@/, '')
    }
    if (/^(www\.)?instagram\.com$/i.test(u.hostname)) {
      const user = path.split('/').filter(Boolean)[0]
      if (user) return decodeURIComponent(user).replace(/^@/, '')
    }
  } catch {
    // Ignore malformed feed URL.
  }
  // Fallback for non-standard URL parse cases.
  const raw = feedUrl.trim()
  const protoHostRoute = raw.match(
    /^rsshub:\/\/(?:picnob(?:\.info)?|pixnoy|piokok|pixwox|instagram)\/user\/([^/?#]+)/i,
  )
  if (protoHostRoute?.[1])
    return decodeURIComponent(protoHostRoute[1]).replace(/^@/, '')
  const protoPathRoute = raw.match(
    /^rsshub:\/\/(?:[^/]+\/)?(?:picnob(?:\.info)?|pixnoy|piokok|pixwox|instagram)\/user\/([^/?#]+)/i,
  )
  if (protoPathRoute?.[1])
    return decodeURIComponent(protoPathRoute[1]).replace(/^@/, '')
  return null
}

function isPlaceholderAvatar(url?: string): boolean {
  const raw = (url || '').trim().toLowerCase()
  if (!raw) return true
  return (
    raw.includes('unavatar.io/instagram/') ||
    raw.includes('instagram.com/static/images/ico') ||
    raw.includes('instagram_static/images/ico') ||
    raw.includes('instagram_logo') ||
    raw.includes('instagram-logo') ||
    raw.includes('/apple-touch-icon') ||
    raw.includes('favicon') ||
    ((raw.includes('picnob') || raw.includes('pixnoy')) && raw.includes('logo'))
  )
}

function decodeHtmlAttribute(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function readHtmlAttribute(tag: string, name: string): string {
  const pattern = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    'i',
  )
  const match = tag.match(pattern)
  return decodeHtmlAttribute(match?.[1] || match?.[2] || match?.[3] || '')
}

function resolveHttpUrl(rawUrl: string, baseUrl: string): string | undefined {
  const trimmed = rawUrl.trim()
  if (!trimmed) return undefined
  try {
    const resolved = new URL(trimmed, baseUrl).toString()
    return /^https?:\/\//i.test(resolved) ? resolved : undefined
  } catch {
    return undefined
  }
}

function extractSiteAvatarFromHtml(
  html: string,
  siteUrl: string,
): string | undefined {
  // 优先使用标准页面头像元数据，避免正文首图污染订阅源头像。
  const metaTags = html.match(/<meta\b[^>]*>/gi) || []
  for (const tag of metaTags) {
    const key = `${readHtmlAttribute(tag, 'property')} ${readHtmlAttribute(tag, 'name')}`
    if (!/\b(?:og:image|twitter:image|image)\b/i.test(key)) continue
    const resolved = resolveHttpUrl(readHtmlAttribute(tag, 'content'), siteUrl)
    if (resolved) return resolved
  }

  // 普通站点的 favicon / touch icon 是没有头像元数据时的合理兜底。
  const linkTags = html.match(/<link\b[^>]*>/gi) || []
  for (const tag of linkTags) {
    const rel = readHtmlAttribute(tag, 'rel')
    if (!/(?:^|\s)(?:apple-touch-icon|icon|shortcut icon)(?:\s|$)/i.test(rel))
      continue
    const resolved = resolveHttpUrl(readHtmlAttribute(tag, 'href'), siteUrl)
    if (resolved) return resolved
  }

  // 最后只接受带头像语义的图片，不扫描正文里的普通插图。
  const imageTags = html.match(/<img\b[^>]*>/gi) || []
  for (const tag of imageTags) {
    const semanticText = [
      readHtmlAttribute(tag, 'alt'),
      readHtmlAttribute(tag, 'title'),
      readHtmlAttribute(tag, 'class'),
      readHtmlAttribute(tag, 'id'),
    ].join(' ')
    if (
      !/(?:头像|个人照片|作者|关于|avatar|profile|portrait|author|person|photo)/i.test(
        semanticText,
      )
    )
      continue
    const resolved = resolveHttpUrl(readHtmlAttribute(tag, 'src'), siteUrl)
    if (resolved) return resolved
  }

  return undefined
}

async function fetchSiteAvatar(siteUrl?: string): Promise<string | undefined> {
  if (!siteUrl || !/^https?:\/\//i.test(siteUrl)) return undefined
  try {
    const res = await fetch(siteUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.includes('text/html')) return undefined
    const html = await res.text()
    const avatarUrl = extractSiteAvatarFromHtml(html, siteUrl)
    if (!avatarUrl) return undefined
    return (
      (await tryConvertImageUrlToDataUri(avatarUrl, {
        referer: siteUrl,
      })) || avatarUrl
    )
  } catch {
    return undefined
  }
}

async function tryConvertImageUrlToDataUri(
  imageUrl: string,
  options: { referer?: string; origin?: string } = {},
): Promise<string | undefined> {
  if (!/^https?:\/\//i.test(imageUrl)) return undefined
  try {
    const res = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'image/webp,image/apng,image/*,*/*;q=0.8',
        Referer: options.referer || 'https://www.instagram.com/',
        Origin: options.origin || 'https://www.instagram.com',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const contentType = (res.headers.get('content-type') || '').toLowerCase()
    if (contentType && !contentType.startsWith('image/')) return undefined
    const arrayBuffer = await res.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)
    if (buffer.length < 64) return undefined
    const ext = imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
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

async function fetchInstagramAvatar(
  username: string,
): Promise<string | undefined> {
  const clean = username.trim().replace(/^@/, '')
  if (!clean) return undefined
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(clean)}/`
  try {
    const res = await fetch(profileUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return undefined
    const html = await res.text()
    const og =
      html.match(
        /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
      )
    if (og?.[1] && /^https?:\/\//i.test(og[1])) {
      const inlined = await tryConvertImageUrlToDataUri(og[1])
      if (inlined) return inlined
    }
    const hd = html.match(/"profile_pic_url_hd":"(https?:\\\/\\\/[^"]+)"/i)
    if (hd?.[1]) {
      const decoded = hd[1].replace(/\\\//g, '/')
      if (/^https?:\/\//i.test(decoded)) {
        const inlined = await tryConvertImageUrlToDataUri(decoded)
        if (inlined) return inlined
      }
    }
  } catch {
    // Ignore single-source avatar resolution failures.
  }
  return undefined
}

async function fetchBilibiliAvatar(uid: string): Promise<string | undefined> {
  const referer = `https://space.bilibili.com/${encodeURIComponent(uid)}`
  const endpoints = [
    `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(uid)}`,
    `https://api.bilibili.com/x/space/acc/info?mid=${encodeURIComponent(uid)}`,
  ]

  for (const url of endpoints) {
    try {
      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0',
          Accept: 'application/json, text/plain, */*',
          Referer: referer,
          Origin: 'https://www.bilibili.com',
        },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) continue

      const json = (await res.json()) as {
        code?: number
        data?: {
          card?: { face?: string }
          face?: string
        }
      }
      if (json.code !== 0) continue

      const face = json.data?.card?.face || json.data?.face
      if (face && /^https?:\/\//i.test(face)) return face
    } catch {
      // Ignore single-endpoint failure.
    }
  }

  return undefined
}

/**
 * Resolve a best-effort feed avatar.
 * Prefer the latest non-placeholder image exposed by the feed itself, and
 * otherwise probe platform-specific sources that may change over time.
 */
export async function resolveFeedAvatar(
  feedUrl: string,
  incomingImageUrl?: string,
  existingImageUrl?: string,
  siteUrl?: string,
): Promise<string | undefined> {
  if (incomingImageUrl && !isPlaceholderAvatar(incomingImageUrl))
    return incomingImageUrl

  const bilibiliUid = extractBilibiliUid(feedUrl)
  if (bilibiliUid) {
    const resolved = await fetchBilibiliAvatar(bilibiliUid)
    return resolved || incomingImageUrl || existingImageUrl
  }

  const instagramUsername = extractInstagramUsername(feedUrl)
  if (instagramUsername) {
    const resolved = await fetchInstagramAvatar(instagramUsername)
    if (resolved) return resolved
    // Fallback to SVG data URI for Instagram (no external network request needed)
    const svgAvatar = `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect fill="#E1306C" width="128" height="128" rx="24"/><text x="64" y="80" text-anchor="middle" fill="white" font-family="system-ui" font-size="48" font-weight="600">${instagramUsername.charAt(0).toUpperCase()}</text></svg>`)}`
    return svgAvatar
  }

  const siteAvatar = await fetchSiteAvatar(siteUrl)
  if (siteAvatar) return siteAvatar

  return incomingImageUrl || existingImageUrl
}

export function getImmediateFeedAvatar(url: string): string | undefined {
  const raw = (url || '').trim()
  if (!raw) return undefined
  const ig = raw.match(
    /\/(?:instagram|picnob(?:\.info)?|pixnoy|piokok|pixwox)\/user\/([^/?#]+)/i,
  )
  const username = ig?.[1] ? decodeURIComponent(ig[1]).replace(/^@+/, '') : ''
  if (!username) return undefined
  const initial = username.charAt(0).toUpperCase()
  return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><defs><linearGradient id="ig" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#833AB4"/><stop offset="50%" stop-color="#E1306C"/><stop offset="100%" stop-color="#F77737"/></linearGradient></defs><rect width="128" height="128" rx="32" fill="url(#ig)"/><text x="64" y="82" text-anchor="middle" fill="white" font-family="system-ui,-apple-system,BlinkMacSystemFont,sans-serif" font-size="56" font-weight="700">${initial}</text></svg>`)}`
}
