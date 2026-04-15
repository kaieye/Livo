import http from '@ohos.net.http'
import { extractInstagramUsername, extractXUsername } from '../utils/SocialFeedTitles'
import { decodeBasicEntities, extractMetaContent } from '../utils/HtmlParser'
import {
  BASIC_BROWSER_USER_AGENT,
  DESKTOP_BROWSER_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  ACCEPT_HTML,
  ACCEPT_JSON,
  BILIBILI_ORIGIN,
  bilibiliSpaceReferer,
  MEDIUM_REQUEST_TIMEOUT_MS,
  SHORT_REQUEST_TIMEOUT_MS,
} from '../AppConfig'

function trimValue(value: string | undefined): string {
  return (value || '').trim()
}

function isPlaceholderAvatar(url?: string): boolean {
  const raw = trimValue(url).toLowerCase()
  if (!raw) {
    return true
  }

  return raw.includes('unavatar.io/instagram/')
    || raw.includes('unavatar.io/youtube/')
    || raw.includes('unavatar.io/bilibili/')
    || raw.includes('instagram.com/static/images/ico')
    || raw.includes('instagram_static/images/ico')
    || raw.includes('instagram_logo')
    || raw.includes('instagram-logo')
    || raw.includes('youtube.com/favicon')
    || raw.includes('bilibili.com/favicon')
    || raw.includes('/apple-touch-icon')
    || raw.includes('favicon')
    || ((raw.includes('picnob') || raw.includes('pixnoy') || raw.includes('piokok')) && raw.includes('logo'))
}

function extractBilibiliUid(value: string): string {
  const matched = trimValue(value).match(
    /\/(?:bilibili\/user\/(?:video|dynamic|article)|space\.bilibili\.com)\/(\d+)/i,
  )
  return matched?.[1]?.trim() || ''
}

function extractYouTubeIdentity(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  return (
    trimmed.match(/[?&]channel_id=([^&]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/youtube\/channel\/([^/?#]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/channel\/([^/?#]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/youtube\/user\/(@?[^/?#]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/@([^/?#]+)/i)?.[1]?.trim() ||
    trimmed.match(/\/(?:user|c)\/([^/?#]+)/i)?.[1]?.trim() ||
    ''
  )
}

function normalizeImageUrl(value: string): string {
  const trimmed = trimValue(value)
  if (!trimmed) {
    return ''
  }

  const normalized = decodeBasicEntities(trimmed)
    .replace(/\\u0026/g, '&')
    .replace(/\\\//g, '/')
    .trim()

  return /^https?:\/\//i.test(normalized) ? normalized : ''
}

interface BilibiliAvatarCard {
  face?: string
}

interface BilibiliAvatarData {
  card?: BilibiliAvatarCard
}

interface BilibiliAvatarPayload {
  code?: number
  data?: BilibiliAvatarData
}

export class SocialFeedAvatarService {
  static async resolveFeedAvatar(
    feedUrl: string,
    siteUrl: string,
    incomingImageUrl: string,
    existingImageUrl: string = '',
  ): Promise<string> {
    const preferredIncoming = trimValue(incomingImageUrl)
    if (preferredIncoming && !isPlaceholderAvatar(preferredIncoming)) {
      return preferredIncoming
    }

    const xUsername = extractXUsername(feedUrl) || extractXUsername(siteUrl)
    if (xUsername) {
      return `https://unavatar.io/x/${encodeURIComponent(xUsername)}`
    }

    const youTubeIdentity = extractYouTubeIdentity(feedUrl) || extractYouTubeIdentity(siteUrl)
    if (youTubeIdentity) {
      const fetched = await SocialFeedAvatarService.fetchYouTubeAvatar(youTubeIdentity)
      if (fetched) {
        return fetched
      }
    }

    const bilibiliUid = extractBilibiliUid(feedUrl) || extractBilibiliUid(siteUrl)
    if (bilibiliUid) {
      const fetched = await SocialFeedAvatarService.fetchBilibiliAvatar(bilibiliUid)
      if (fetched) {
        return fetched
      }
    }

    const username = extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
    if (username) {
      const fetched = await SocialFeedAvatarService.fetchInstagramAvatar(username)
      if (fetched) {
        return fetched
      }
      return `https://unavatar.io/instagram/${encodeURIComponent(username)}?fallback=false`
    }

    return preferredIncoming || trimValue(existingImageUrl)
  }

  static async fetchInstagramAvatar(username: string): Promise<string> {
    const clean = trimValue(username).replace(/^@+/, '')
    if (!clean) {
      return ''
    }

    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://www.instagram.com/${encodeURIComponent(clean)}/`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
          readTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
          header: {
            'User-Agent': BASIC_BROWSER_USER_AGENT,
            'Accept': ACCEPT_HTML,
            'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const html = String(response.result)
      const ogImage = extractMetaContent(html, 'og:image')
      if (/^https?:\/\//i.test(ogImage)) {
        return ogImage
      }

      const profilePic = html.match(/"profile_pic_url_hd":"(https?:\\\/\\\/[^"]+)"/i)?.[1] ?? ''
      if (profilePic) {
        return decodeBasicEntities(profilePic).replace(/\\\//g, '/')
      }

      return ''
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }

  static async fetchYouTubeAvatar(identity: string): Promise<string> {
    const clean = trimValue(identity).replace(/^@+/, '')
    if (!clean) {
      return ''
    }

    const candidates: string[] = []
    if (/^uc[a-z0-9_-]{20,}$/i.test(clean)) {
      candidates.push(`https://www.youtube.com/channel/${encodeURIComponent(clean)}`)
    } else {
      candidates.push(`https://www.youtube.com/@${encodeURIComponent(clean)}`)
      candidates.push(`https://www.youtube.com/c/${encodeURIComponent(clean)}`)
      candidates.push(`https://www.youtube.com/user/${encodeURIComponent(clean)}`)
    }

    for (const url of candidates) {
      const request = http.createHttp()
      try {
        const response = await request.request(
          url,
          {
            method: http.RequestMethod.GET,
            connectTimeout: SHORT_REQUEST_TIMEOUT_MS,
            readTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
            header: {
              'User-Agent': DESKTOP_BROWSER_USER_AGENT,
              'Accept': ACCEPT_HTML,
              'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
            },
          },
        )

        if (response.responseCode !== 200) {
          continue
        }

        const html = String(response.result)
        const ogImage = normalizeImageUrl(extractMetaContent(html, 'og:image'))
        if (ogImage) {
          return ogImage
        }

        const avatarMatch = html.match(/"avatar"\s*:\s*\{[\s\S]*?"url"\s*:\s*"([^"]+)"/i)?.[1] ?? ''
        const avatarUrl = normalizeImageUrl(avatarMatch)
        if (avatarUrl) {
          return avatarUrl
        }
      } catch (_) {
        continue
      } finally {
        request.destroy()
      }
    }

    return ''
  }

  static async fetchBilibiliAvatar(uid: string): Promise<string> {
    const clean = trimValue(uid)
    if (!clean) {
      return ''
    }

    const request = http.createHttp()
    try {
      const response = await request.request(
        `https://api.bilibili.com/x/web-interface/card?mid=${encodeURIComponent(clean)}`,
        {
          method: http.RequestMethod.GET,
          connectTimeout: SHORT_REQUEST_TIMEOUT_MS,
          readTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
          header: {
            'User-Agent': BASIC_BROWSER_USER_AGENT,
            'Accept': ACCEPT_JSON,
            'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
            'Referer': bilibiliSpaceReferer(clean),
            'Origin': BILIBILI_ORIGIN,
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const payload = JSON.parse(String(response.result)) as BilibiliAvatarPayload
      const face = typeof payload.data?.card?.face === 'string' ? payload.data.card.face : ''
      return normalizeImageUrl(face)
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }
}
