import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
  Entry,
} from '../../../shared/types'
import {
  getAllFeeds,
  getEntries,
  getEntryById,
  getUnreadCount,
  getDatabaseStats,
  markAllRead as dbMarkAllRead,
} from '../../database'
import { clampLimit, emptyParams, limitParams, objectParams } from './schema'
import { defineMutateTool, defineReadTool } from './factories'

function entrySummary(entry: Entry, index: number): string {
  const published = new Date(entry.publishedAt).toLocaleString()
  const summary = (entry.summary || '').slice(0, 200)
  return `[${index + 1}] ${entry.title}\n   作者: ${entry.author || '未知'}\n   发布时间: ${published}\n   摘要: ${summary}\n   链接: ${entry.url}`
}

function startOfTodayMs(): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return today.getTime()
}

export function buildGetTodayUpdatesTool(): AgentTool {
  return defineReadTool({
    name: 'get_today_updates',
    title: '查询今日更新',
    description:
      '查询今天有哪些订阅源更新了内容，返回按发布时间倒序排列的文章，包含标题、来源、摘要和链接',
    inputSchema: limitParams('返回文章数量，默认20，最大50'),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const limit = clampLimit(args['limit'], 20, 50)
      const todayStart = startOfTodayMs()
      const feeds = getAllFeeds()
      const feedMap = new Map(feeds.map((f) => [f.id, f]))

      const { entries } = getEntries({ limit: 200 })
      const todayEntries = entries.filter((e) => e.publishedAt >= todayStart)
      const sliced = todayEntries.slice(0, limit)
      if (sliced.length === 0) {
        return { status: 'success', message: '今天还没有订阅源更新内容。' }
      }

      const perFeed = new Map<string, number>()
      for (const e of sliced) {
        perFeed.set(e.feedId, (perFeed.get(e.feedId) ?? 0) + 1)
      }

      let message = `今天共有 ${perFeed.size} 个订阅源更新了内容（共 ${todayEntries.length} 篇文章），显示前 ${sliced.length} 篇：\n\n各源今日更新数量：\n`
      perFeed.forEach((count, feedId) => {
        message += `  • ${feedMap.get(feedId)?.title ?? feedId}: ${count} 篇\n`
      })
      message += '\n最新文章：\n\n'
      sliced.forEach((entry, i) => {
        const feedName = feedMap.get(entry.feedId)?.title ?? entry.feedId
        message += `${entrySummary(entry, i)}\n   来源: ${feedName}\n\n`
      })

      return {
        status: 'success',
        message,
        data: { count: sliced.length, entries: sliced as unknown as object },
      }
    },
  })
}

export function buildGetEntryDetailTool(): AgentTool {
  return defineReadTool({
    name: 'get_entry_detail',
    title: '查看文章详情',
    description: '获取指定文章的完整内容和详细信息',
    inputSchema: objectParams(
      { entryId: { type: 'string', description: '文章ID' } },
      ['entryId'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const entryId = String(args['entryId'])
      const entry = getEntryById(entryId)
      if (!entry) {
        return { status: 'failed', message: `未找到 ID 为 "${entryId}" 的文章` }
      }
      const published = new Date(entry.publishedAt).toLocaleString()
      const content = (entry.content || '').slice(0, 3000)
      const truncated =
        (entry.content || '').length > 3000 ? '\n...(内容已截断)' : ''
      const message = `标题: ${entry.title}\n作者: ${entry.author || '未知'}\n发布时间: ${published}\n链接: ${entry.url}\n\n摘要:\n${entry.summary || '无'}\n\n正文:\n${content}${truncated}`
      return {
        status: 'success',
        message,
        data: { entry: entry as unknown as object },
      }
    },
  })
}

export function buildGetUnreadCountTool(): AgentTool {
  return defineReadTool({
    name: 'get_unread_count',
    title: '统计未读',
    description: '查询未读文章总数和各订阅源的未读数量统计',
    inputSchema: emptyParams(),
    execute: async (): Promise<AgentToolResult> => {
      const stats = getDatabaseStats()
      const totalUnread = Math.max(0, stats.totalEntries - stats.readEntries)
      if (totalUnread === 0) {
        return {
          status: 'success',
          message: '所有文章已读完，无未读内容。',
          data: { totalUnread: 0 },
        }
      }
      const feeds = getAllFeeds()
      let message = `共有 ${totalUnread} 篇未读文章：\n`
      const perFeed: Array<{ name: string; count: number }> = []
      for (const feed of feeds) {
        const count = getUnreadCount(feed.id)
        if (count > 0) {
          perFeed.push({ name: feed.title, count })
          message += `  • ${feed.title}: ${count} 篇未读\n`
        }
      }
      return {
        status: 'success',
        message,
        data: { totalUnread, perFeed: perFeed as unknown as object },
      }
    },
  })
}

export function buildViewStarredEntriesTool(): AgentTool {
  return defineReadTool({
    name: 'view_starred_entries',
    title: '查看收藏',
    description: '查看用户收藏的文章列表',
    inputSchema: limitParams('返回收藏数量，默认20，最大50'),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const limit = clampLimit(args['limit'], 20, 50)
      const { entries } = getEntries({ starred: true, limit })
      if (entries.length === 0) {
        return { status: 'success', message: '暂无收藏内容' }
      }
      let lines = ''
      entries.forEach((entry, i) => {
        const published = new Date(entry.publishedAt).toLocaleDateString()
        lines += `${i + 1}. ${entry.title} (${published})\n`
      })
      return {
        status: 'success',
        message: `共显示 ${entries.length} 篇收藏文章：\n${lines}`,
        data: { count: entries.length, entries: entries as unknown as object },
      }
    },
  })
}

export function buildMarkAllReadTool(): AgentTool {
  return defineMutateTool({
    name: 'mark_all_read',
    title: '全部标记为已读',
    description: '将所有未读文章标记为已读',
    inputSchema: emptyParams(),
    execute: async (): Promise<AgentToolResult> => {
      const stats = getDatabaseStats()
      const before = Math.max(0, stats.totalEntries - stats.readEntries)
      dbMarkAllRead()
      return {
        status: 'success',
        message: `已将 ${before} 篇文章标记为已读`,
        data: { markedCount: before },
      }
    },
  })
}
