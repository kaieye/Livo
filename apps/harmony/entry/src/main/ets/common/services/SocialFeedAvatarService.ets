import http from '@ohos.net.http'
import { extractInstagramUsername } from '../utils/SocialFeedTitles'
import { decodeBasicEntities, extractMetaContent } from '../utils/HtmlParser'
import {
  BASIC_BROWSER_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  ACCEPT_HTML,
  MEDIUM_REQUEST_TIMEOUT_MS,
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
    || raw.includes('instagram.com/static/images/ico')
    || raw.includes('instagram_static/images/ico')
    || raw.includes('instagram_logo')
    || raw.includes('instagram-logo')
    || raw.includes('/apple-touch-icon')
    || raw.includes('favicon')
    || ((raw.includes('picnob') || raw.includes('pixnoy') || raw.includes('piokok')) && raw.includes('logo'))
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

    const username = extractInstagramUsername(feedUrl) || extractInstagramUsername(siteUrl)
    if (username) {
      const fetched = await SocialFeedAvatarService.fetchInstagramAvatar(username)
      if (fetched) {
        return fetched
      }
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
}
