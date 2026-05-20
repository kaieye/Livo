import http from '@ohos.net.http'
import {
  extractInstagramUsername,
  extractXUsername,
} from '../../utils/social/SocialFeedTitles'
import { decodeBasicEntities, extractMetaContent } from '../../utils/HtmlParser'
import { IAvatarResolver } from './IAvatarResolver'
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
} from '../../AppConfig'

function trimValue(value: string | undefined): string {
  return (value || '').trim()
}

function isPlaceholderAvatar(url?: string): boolean {
  const raw = trimValue(url).toLowerCase()
  if (!raw) {
    return true
  }

  return (
    raw.includes('unavatar.io/instagram/') ||
    raw.includes('unavatar.io/youtube/') ||
    raw.includes('unavatar.io/bilibili/') ||
    raw.includes('unavatar.io/x/') ||
    raw.includes('instagram.com/static/images/ico') ||
    raw.includes('instagram_static/images/ico') ||
    raw.includes('instagram_logo') ||
    raw.includes('instagram-logo') ||
    raw.includes('youtube.com/favicon') ||
    raw.includes('bilibili.com/favicon') ||
    raw.includes('/apple-touch-icon') ||
    raw.includes('favicon') ||
    ((raw.includes('picnob') ||
      raw.includes('pixnoy') ||
      raw.includes('piokok')) &&
      raw.includes('logo'))
  )
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
    // /user/ and /c/ only match when the host is clearly YouTube
    trimmed.match(/youtube\.com\/(?:user|c)\/([^/?#]+)/i)?.[1]?.trim() ||
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

function normalizeUsableAvatarUrl(value: string): string {
  const normalized = normalizeImageUrl(value)
  if (!normalized || isPlaceholderAvatar(normalized)) {
    return ''
  }
  return normalized
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

export class HttpAvatarResolver implements IAvatarResolver {
  async resolveFeedAvatar(
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
      const existing = trimValue(existingImageUrl)
      if (existing && !isPlaceholderAvatar(existing)) {
        return existing
      }
      return `https://unavatar.io/x/${encodeURIComponent(xUsername)}`
    }

    const youTubeIdentity =
      extractYouTubeIdentity(feedUrl) || extractYouTubeIdentity(siteUrl)
    if (youTubeIdentity) {
      const fetched = await this.fetchYouTubeAvatar(youTubeIdentity)
      if (fetched) {
        return fetched
      }
      return `https://unavatar.io/youtube/${encodeURIComponent(youTubeIdentity)}?fallback=false`
    }

    const bilibiliUid =
      extractBilibiliUid(feedUrl) || extractBilibiliUid(siteUrl)
    if (bilibiliUid) {
      const fetched = await this.fetchBilibiliAvatar(bilibiliUid)
      if (fetched) {
        return fetched
      }
      return `https://unavatar.io/bilibili/${encodeURIComponent(bilibiliUid)}?fallback=false`
    }

    const username =
      extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
    if (username) {
      const fetched = await this.fetchInstagramAvatar(username)
      if (fetched) {
        return fetched
      }
      return `https://unavatar.io/instagram/${encodeURIComponent(username)}?fallback=false`
    }

    return preferredIncoming || trimValue(existingImageUrl)
  }

  async fetchInstagramAvatar(username: string): Promise<string> {
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
            Accept: ACCEPT_HTML,
            'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const html = String(response.result)
      const ogImage = normalizeUsableAvatarUrl(
        extractMetaContent(html, 'og:image'),
      )
      if (ogImage) {
        return ogImage
      }

      const profilePicRaw =
        html.match(/"profile_pic_url_hd":"(https?:\\\/\\\/[^"]+)"/i)?.[1] ?? ''
      const profilePic = normalizeUsableAvatarUrl(
        decodeBasicEntities(profilePicRaw).replace(/\\\//g, '/'),
      )
      if (profilePic) {
        return profilePic
      }

      return ''
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }

  async fetchYouTubeAvatar(identity: string): Promise<string> {
    const clean = trimValue(identity).replace(/^@+/, '')
    if (!clean) {
      return ''
    }

    const candidates: string[] = []
    if (/^uc[a-z0-9_-]{20,}$/i.test(clean)) {
      candidates.push(
        `https://www.youtube.com/channel/${encodeURIComponent(clean)}`,
      )
    } else {
      candidates.push(`https://www.youtube.com/@${encodeURIComponent(clean)}`)
      candidates.push(`https://www.youtube.com/c/${encodeURIComponent(clean)}`)
      candidates.push(
        `https://www.youtube.com/user/${encodeURIComponent(clean)}`,
      )
    }

    for (const url of candidates) {
      const request = http.createHttp()
      try {
        const response = await request.request(url, {
          method: http.RequestMethod.GET,
          connectTimeout: SHORT_REQUEST_TIMEOUT_MS,
          readTimeout: MEDIUM_REQUEST_TIMEOUT_MS,
          header: {
            'User-Agent': DESKTOP_BROWSER_USER_AGENT,
            Accept: ACCEPT_HTML,
            'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
          },
        })

        if (response.responseCode !== 200) {
          continue
        }

        const html = String(response.result)
        const ogImage = normalizeUsableAvatarUrl(
          extractMetaContent(html, 'og:image'),
        )
        if (ogImage) {
          return ogImage
        }

        const avatarMatch =
          html.match(/"avatar"\s*:\s*\{[\s\S]*?"url"\s*:\s*"([^"]+)"/i)?.[1] ??
          ''
        const avatarUrl = normalizeUsableAvatarUrl(avatarMatch)
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

  async fetchBilibiliAvatar(uid: string): Promise<string> {
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
            Accept: ACCEPT_JSON,
            'Accept-Language': DEFAULT_ACCEPT_LANGUAGE,
            Referer: bilibiliSpaceReferer(clean),
            Origin: BILIBILI_ORIGIN,
          },
        },
      )

      if (response.responseCode !== 200) {
        return ''
      }

      const payload = JSON.parse(
        String(response.result),
      ) as BilibiliAvatarPayload
      if (payload.code !== 0) {
        return ''
      }
      const face =
        typeof payload.data?.card?.face === 'string'
          ? payload.data.card.face
          : ''
      return normalizeUsableAvatarUrl(face)
    } catch (_) {
      return ''
    } finally {
      request.destroy()
    }
  }
}
