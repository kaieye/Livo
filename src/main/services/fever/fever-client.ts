import { createHash } from 'node:crypto'
import { normalizeFeverBaseUrl } from './fever-endpoint'

export interface FeverRemoteFeed {
  id: number
  favicon: string
  title: string
  url: string
  siteUrl: string
  isSpark: number
  lastUpdatedOnTime: number
}

export interface FeverRemoteGroup {
  id: number
  title: string
}

export interface FeverRemoteItem {
  id: number
  feedId: number
  title: string
  author: string
  html: string
  url: string
  isSaved: number
  isRead: number
  createdOnTime: number
}

export interface FeverFeedWithGroup extends FeverRemoteFeed {
  groupName: string
}

export interface FeverApiClient {
  verify(): Promise<boolean>
  listFeeds(): Promise<FeverFeedWithGroup[]>
  listItems(options?: {
    sinceId?: number
    maxId?: number
  }): Promise<FeverRemoteItem[]>
  markItem(
    itemId: number,
    as: 'read' | 'unread' | 'saved' | 'unsaved',
  ): Promise<boolean>
}

function feverHash(username: string, apiKey: string): string {
  return createHash('md5').update(`${username}:${apiKey}`).digest('hex')
}

function parseItemsResponse(json: any): FeverRemoteItem[] {
  const raw = json.items
  if (!Array.isArray(raw)) return []
  return raw.map((item: any) => ({
    id: Number(item.id),
    feedId: Number(item.feed_id),
    title: String(item.title || ''),
    author: String(item.author || ''),
    html: String(item.html || ''),
    url: String(item.url || ''),
    isSaved: Number(item.is_saved) || 0,
    isRead: Number(item.is_read) || 0,
    createdOnTime: Number(item.created_on_time) || 0,
  }))
}

export function createFeverClient(
  baseUrl: string,
  username: string,
  apiKey: string,
): FeverApiClient {
  const hash = feverHash(username, apiKey)
  const base = normalizeFeverBaseUrl(baseUrl)

  async function post(
    query: string,
    body?: Record<string, string>,
  ): Promise<any> {
    const url = `${base}?api&${query}`
    const formBody = new URLSearchParams({ api_key: hash, ...body })
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formBody.toString(),
    })
    if (!res.ok) {
      throw new Error(`Fever API HTTP ${res.status}`)
    }
    const json = await res.json()
    if (json.auth !== 1) {
      throw new Error('Fever authentication failed')
    }
    return json
  }

  return {
    async verify(): Promise<boolean> {
      try {
        const json = await post('groups=1')
        return json.status === undefined || String(json.status) === '1'
      } catch {
        return false
      }
    },

    async listFeeds(): Promise<FeverFeedWithGroup[]> {
      const [feedsJson, groupsJson] = await Promise.all([
        post('feeds=1'),
        post('groups=1'),
      ])

      const groups: FeverRemoteGroup[] = Array.isArray(groupsJson.groups)
        ? groupsJson.groups.map((g: any) => ({
            id: Number(g.id),
            title: String(g.title || ''),
          }))
        : []

      const groupNameByFeedId = new Map<number, string>()
      if (Array.isArray(groupsJson.feeds_groups)) {
        for (const fg of groupsJson.feeds_groups) {
          const groupId = Number(fg.group_id)
          const group = groups.find((g) => g.id === groupId)
          const feedIds = String(fg.feed_ids || '')
            .split(',')
            .map((s: string) => Number(s.trim()))
            .filter((n: number) => !isNaN(n) && n > 0)
          for (const fid of feedIds) {
            groupNameByFeedId.set(fid, group?.title || '')
          }
        }
      }

      const rawFeeds = Array.isArray(feedsJson.feeds) ? feedsJson.feeds : []
      return rawFeeds.map((f: any) => {
        const id = Number(f.id)
        return {
          id,
          favicon: String(f.favicon || ''),
          title: String(f.title || ''),
          url: String(f.url || ''),
          siteUrl: String(f.site_url || ''),
          isSpark: Number(f.is_spark) || 0,
          lastUpdatedOnTime: Number(f.last_updated_on_time) || 0,
          groupName: groupNameByFeedId.get(id) || '',
        }
      })
    },

    async listItems(options?: {
      sinceId?: number
      maxId?: number
    }): Promise<FeverRemoteItem[]> {
      const params: string[] = ['items=1']
      if (options?.sinceId) params.push(`since_id=${options.sinceId}`)
      if (options?.maxId) params.push(`max_id=${options.maxId}`)
      const json = await post(params.join('&'))
      return parseItemsResponse(json)
    },

    async markItem(
      itemId: number,
      as: 'read' | 'unread' | 'saved' | 'unsaved',
    ): Promise<boolean> {
      const json = await post(`mark=item&id=${itemId}&as=${as}`, {})
      return String(json.status) === '1'
    },
  }
}
