import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import type { Entry, Feed } from '../../../models/LivoModels'
import { FeedRepository } from '../../../repositories/FeedRepository'
import { EntryRepository } from '../../../repositories/EntryRepository'

interface FeedUnreadStat {
  name: string
  count: number
}

function emptyParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function todayParams(): AgentToolInputSchema {
  const limitParam: AgentToolParamSchema = { type: 'number', description: '返回文章数量，默认20，最大50' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['limit'] = limitParam
  const required: string[] = []
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function limitParams(defaultDescription: string): AgentToolInputSchema {
  const limitParam: AgentToolParamSchema = { type: 'number', description: defaultDescription }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['limit'] = limitParam
  const required: string[] = []
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function entryParams(): AgentToolInputSchema {
  const entryIdParam: AgentToolParamSchema = { type: 'string', description: '文章ID' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['entryId'] = entryIdParam
  const required: string[] = ['entryId']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function entrySummary(entry: Entry, index: number): string {
  const published = new Date(entry.publishedAt).toLocaleString()
  const slicedSummary = entry.summary.length > 200
    ? entry.summary.slice(0, 200) + '...'
    : entry.summary
  return `[${index + 1}] ${entry.title}\n   作者: ${entry.author || '未知'}\n   发布时间: ${published}\n   摘要: ${slicedSummary}\n   链接: ${entry.url}`
}

export function buildGetTodayUpdatesTool(): AgentTool {
  return {
    name: 'get_today_updates',
    title: '查询今日更新',
    description: '查询今天有哪些订阅源更新了内容，以及各自更新了哪些文章。返回按发布时间倒序排列的文章，包含标题、来源、摘要和链接',
    inputSchema: todayParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const limitRaw = args['limit'] as number
      const limitNum = typeof limitRaw === 'number' ? limitRaw : 20
      const limit = Math.min(Math.max(1, limitNum), 50)

      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const todayStartMs = today.getTime()

      const feeds = await FeedRepository.default.list()
      const feedMap = new Map<string, Feed>()
      for (const f of feeds) {
        feedMap.set(f.id, f)
      }

      const allEntries = await EntryRepository.default.listRecent(200)
      const todayEntries: Entry[] = []
      for (const e of allEntries) {
        if (e.publishedAt >= todayStartMs) {
          todayEntries.push(e)
        }
      }
      const sliced = todayEntries.slice(0, limit)

      if (sliced.length === 0) {
        return { status: 'success', message: '今天还没有订阅源更新内容。' }
      }

      const feedUpdateCount = new Map<string, number>()
      for (const e of sliced) {
        const count = feedUpdateCount.get(e.feedId) ?? 0
        feedUpdateCount.set(e.feedId, count + 1)
      }

      let message = `今天共有 ${feedUpdateCount.size} 个订阅源更新了内容（共 ${todayEntries.length} 篇文章），显示前 ${sliced.length} 篇：\n\n`
      message += '各源今日更新数量：\n'
      feedUpdateCount.forEach((count: number, feedId: string) => {
        const feed = feedMap.get(feedId)
        const name = feed ? feed.title : feedId
        message += `  • ${name}: ${count} 篇\n`
      })
      message += '\n最新文章：\n\n'
      for (let i = 0; i < sliced.length; i += 1) {
        const entry = sliced[i]
        const feed = feedMap.get(entry.feedId)
        const feedName = feed ? feed.title : entry.feedId
        message += `${entrySummary(entry, i)}\n   来源: ${feedName}\n\n`
      }

      return {
        status: 'success',
        message,
        data: { count: sliced.length, entries: sliced },
      }
    },
  }
}

export function buildGetEntryDetailTool(): AgentTool {
  return {
    name: 'get_entry_detail',
    title: '查看文章详情',
    description: '获取指定文章的完整内容和详细信息',
    inputSchema: entryParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const entryId = args['entryId'] as string
      const entry = await EntryRepository.default.getById(entryId)
      if (!entry) {
        return { status: 'failed', message: `未找到 ID 为 "${entryId}" 的文章` }
      }

      const published = new Date(entry.publishedAt).toLocaleString()
      const tagStr = (entry.tags || []).join(', ') || '无'
      const contentSliced = entry.content.length > 3000
        ? entry.content.slice(0, 3000) + '\n...(内容已截断)'
        : entry.content
      const message = `标题: ${entry.title}\n作者: ${entry.author || '未知'}\n发布时间: ${published}\n阅读时长: ${entry.readingTimeMinutes} 分钟\n标签: ${tagStr}\n链接: ${entry.url}\n\n摘要:\n${entry.summary}\n\n正文:\n${contentSliced}`

      return {
        status: 'success',
        message,
        data: { entry },
      }
    },
  }
}

export function buildGetUnreadCountTool(): AgentTool {
  return {
    name: 'get_unread_count',
    title: '统计未读',
    description: '查询未读文章总数和各订阅源的未读数量统计',
    inputSchema: emptyParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (): Promise<AgentToolResult> => {
      const feeds = await FeedRepository.default.list()
      const totalUnread = await EntryRepository.default.countUnread()
      if (totalUnread === 0) {
        return {
          status: 'success',
          message: '所有文章已读完，无未读内容。',
          data: { totalUnread },
        }
      }

      let message = `共有 ${totalUnread} 篇未读文章：\n`
      const feedUnreadList: FeedUnreadStat[] = []
      for (const feed of feeds) {
        const count = await EntryRepository.default.countUnreadByFeed(feed.id)
        if (count > 0) {
          const row: FeedUnreadStat = { name: feed.title, count }
          feedUnreadList.push(row)
          message += `  • ${feed.title}: ${count} 篇未读\n`
        }
      }

      return {
        status: 'success',
        message,
        data: { totalUnread, feedUnreadList },
      }
    },
  }
}

export function buildViewStarredEntriesTool(): AgentTool {
  return {
    name: 'view_starred_entries',
    title: '查看收藏',
    description: '查看用户收藏的文章列表',
    inputSchema: limitParams('返回收藏数量，默认20，最大50'),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const limitRaw = args['limit'] as number
      const limit = typeof limitRaw === 'number' ? Math.min(Math.max(1, limitRaw), 50) : 20
      const entries = await EntryRepository.default.listStarred(limit)
      if (entries.length === 0) {
        return { status: 'success', message: '暂无收藏内容' }
      }

      let lines = ''
      for (let i = 0; i < entries.length; i += 1) {
        const entry = entries[i]
        const published = new Date(entry.publishedAt).toLocaleDateString()
        lines += `${i + 1}. ${entry.title} (${published})\n`
      }

      return {
        status: 'success',
        message: `共收藏 ${entries.length} 篇文章，显示前 ${entries.length} 篇：\n${lines}`,
        data: { count: entries.length, entries },
      }
    },
  }
}

export function buildMarkAllReadTool(): AgentTool {
  return {
    name: 'mark_all_read',
    title: '全部标记为已读',
    description: '将所有未读文章标记为已读',
    inputSchema: emptyParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (): Promise<AgentToolResult> => {
      const feeds = await FeedRepository.default.list()
      let markedCount = 0

      for (const feed of feeds) {
        const entries = await EntryRepository.default.listByFeed(feed.id)
        for (const entry of entries) {
          if (!entry.isRead) {
            await EntryRepository.default.markRead(entry.id, true)
            markedCount += 1
          }
        }
      }

      return {
        status: 'success',
        message: `已将 ${markedCount} 篇文章标记为已读`,
        data: { markedCount },
      }
    },
  }
}
