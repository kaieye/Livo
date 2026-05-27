import http from '@ohos.net.http'
import { FeedViewType } from '../../models/LivoModels'
import { decodeBasicEntities } from '../../utils/HtmlParser'
import {
  BASIC_BROWSER_USER_AGENT,
  DEFAULT_ACCEPT_LANGUAGE,
  ACCEPT_HTML,
  MEDIUM_REQUEST_TIMEOUT_MS,
} from '../../config/NetworkConfig'
import { ResolvedDiscoverCandidate } from '../discover/DiscoverTypes'

interface ParsedYouTubeChannel {
  channelId: string
  title: string
  imageUrl: string
}

function parseYouTubeChannels(html: string): ParsedYouTubeChannel[] {
  const results: ParsedYouTubeChannel[] = []
  const seen = new Set<string>()
  const regex = /"channelId":"([^"]+)"[\s\S]{0,1800}?"title":\{"simpleText":"([^"]+)"|"title":\{"runs":\[\{"text":"([^"]+)"[\s\S]{0,1600}?"thumbnail":\{"thumbnails":\[(.*?)\]\}/g
  let matched: RegExpExecArray | null = regex.exec(html)
  while (matched) {
    const channelId = matched[1] ?? ''
    const title = decodeBasicEntities(matched[2] || matched[3] || '').trim()
    const thumbBlock = matched[4] || ''
    const thumbMatch = thumbBlock.match(/"url":"([^"]+)"/)
    const imageUrl = thumbMatch?.[1] ? decodeBasicEntities(thumbMatch[1]) : ''
    if (channelId && title && !seen.has(channelId)) {
      seen.add(channelId)
      results.push({ channelId, title, imageUrl })
    }
    matched = regex.exec(html)
  }
  return results
}

export async function searchYouTubeChannels(query: string): Promise<ResolvedDiscoverCandidate[]> {
  const request = http.createHttp()
  try {
    const response = await request.request(
      `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&sp=EgIQAg%253D%253D`,
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
    if (response.responseCode !== 200) return []
    return parseYouTubeChannels(String(response.result)).slice(0, 8).map((channel): ResolvedDiscoverCandidate => {
      const item: ResolvedDiscoverCandidate = {
        targetUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${encodeURIComponent(channel.channelId)}`,
        targetTitle: channel.title,
        targetView: FeedViewType.Videos,
        description: 'YouTube 频道',
        siteUrl: `https://www.youtube.com/channel/${channel.channelId}`,
        sourceKind: 'YouTube',
        imageUrl: channel.imageUrl,
      }
      return item
    })
  } catch (_) {
    return []
  } finally {
    request.destroy()
  }
}
