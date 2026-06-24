import type {
  AgentExecutionContext,
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
  Entry,
} from '../../../shared/types'
import { isAgentCapabilityAllowed } from '../../../shared/types'
import { getDb } from '../../database'
import {
  batchUpdateEntryStateWithWriteBack,
  markAllRead,
  updateEntryWithWriteBack,
} from '../../operations/entry-operations'
import { dispatchAgentNavigation } from '../navigation-bridge'
import {
  SHORT_TEXT_MAX_LENGTH,
  clampLimit,
  emptyParams,
  limitParams,
  objectParams,
} from './schema'
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

function optionalString(args: AgentToolArgs, key: string): string | undefined {
  const value = args[key]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed || undefined
}

function optionalBoolean(
  args: AgentToolArgs,
  key: string,
): boolean | undefined {
  const value = args[key]
  return typeof value === 'boolean' ? value : undefined
}

function parseOptionalTimestamp(
  args: AgentToolArgs,
  key: string,
): number | undefined {
  const value = optionalString(args, key)
  if (!value) return undefined
  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : undefined
}

function searchEntryOptions(args: AgentToolArgs): {
  limit: number
  feedId?: string
  starredOnly?: boolean
  unreadOnly?: boolean
  publishedAfter?: number
  publishedBefore?: number
} {
  return {
    limit: clampLimit(args['limit'], 10, 30),
    feedId: optionalString(args, 'feedId'),
    starredOnly: optionalBoolean(args, 'starredOnly'),
    unreadOnly: optionalBoolean(args, 'unreadOnly'),
    publishedAfter: parseOptionalTimestamp(args, 'publishedAfter'),
    publishedBefore: parseOptionalTimestamp(args, 'publishedBefore'),
  }
}

function entryStateLine(entry: Entry): string {
  return `状态: ${entry.isRead ? '已读' : '未读'} / ${entry.isStarred ? '已收藏' : '未收藏'}`
}

function entryStatePreview(
  entryId: string,
  updates: { isRead?: boolean; isStarred?: boolean },
): string {
  const entry = getDb().entries.getEntryById(entryId)
  if (!entry) return `将尝试更新 1 篇文章；未找到 ID 为 "${entryId}" 的文章。`
  const nextUpdates: string[] = []
  if (updates.isRead !== undefined && updates.isRead !== entry.isRead) {
    nextUpdates.push(updates.isRead ? '标记为已读' : '标记为未读')
  }
  if (
    updates.isStarred !== undefined &&
    updates.isStarred !== entry.isStarred
  ) {
    nextUpdates.push(updates.isStarred ? '收藏' : '取消收藏')
  }
  if (nextUpdates.length === 0) {
    return `将检查文章「${entry.title}」；当前状态已经符合要求，不会写入。`
  }
  return `将更新文章「${entry.title}」：${nextUpdates.join('、')}。`
}

export function executeBatchEntryReadStateUpdate(
  updates: Array<{ entryId: string; isRead: boolean }>,
): AgentToolResult {
  const result = batchUpdateEntryStateWithWriteBack(
    updates.map((update) => ({
      entryId: update.entryId,
      isRead: update.isRead,
    })),
  )
  const action = summarizeBooleanTargets(
    updates,
    'isRead',
    '标记已读',
    '标记未读',
  )
  return {
    status: result.missingCount > 0 ? 'failed' : 'success',
    message: `${action}：共 ${updates.length} 篇，找到 ${result.matchedCount} 篇，实际变更 ${result.changedCount} 篇${result.missingCount > 0 ? `，未找到 ${result.missingCount} 篇` : ''}。`,
    data: {
      count: updates.length,
      changedCount: result.changedCount,
      missingCount: result.missingCount,
      results: result.results as unknown as object,
    },
  }
}

export function executeBatchEntryStarredStateUpdate(
  updates: Array<{ entryId: string; isStarred: boolean }>,
): AgentToolResult {
  const result = batchUpdateEntryStateWithWriteBack(
    updates.map((update) => ({
      entryId: update.entryId,
      isStarred: update.isStarred,
    })),
  )
  const action = summarizeBooleanTargets(
    updates,
    'isStarred',
    '收藏',
    '取消收藏',
  )
  return {
    status: result.missingCount > 0 ? 'failed' : 'success',
    message: `${action}：共 ${updates.length} 篇，找到 ${result.matchedCount} 篇，实际变更 ${result.changedCount} 篇${result.missingCount > 0 ? `，未找到 ${result.missingCount} 篇` : ''}。`,
    data: {
      count: updates.length,
      changedCount: result.changedCount,
      missingCount: result.missingCount,
      results: result.results as unknown as object,
    },
  }
}

function summarizeBooleanTargets<T extends string>(
  updates: Array<Record<T, boolean>>,
  key: T,
  trueText: string,
  falseText: string,
): string {
  const trueCount = updates.filter((update) => update[key]).length
  const falseCount = updates.length - trueCount
  if (trueCount > 0 && falseCount > 0) {
    return `${trueText} ${trueCount} 篇，${falseText} ${falseCount} 篇`
  }
  return trueCount > 0 ? trueText : falseText
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
      const feeds = getDb().feeds.getAllFeeds()
      const feedMap = new Map(feeds.map((f) => [f.id, f]))

      const { entries } = getDb().entries.getEntries({ limit: 200 })
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
      {
        entryId: {
          type: 'string',
          description: '文章ID',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
      },
      ['entryId'],
    ),
    preview: async (_context, args) => {
      const entryId = String(args['entryId']).trim()
      return {
        message: entryStatePreview(entryId, {
          isRead: args['isRead'] === true,
        }),
      }
    },
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const entryId = String(args['entryId'])
      const entry = getDb().entries.getEntryById(entryId)
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

export function buildSearchEntriesTool(): AgentTool {
  return defineReadTool({
    name: 'search_entries',
    title: '搜索本地文章',
    description:
      '按关键词搜索本地文章标题、摘要和正文。用户想查找历史文章、按主题回顾内容或定位某篇文章时使用',
    inputSchema: objectParams(
      {
        query: {
          type: 'string',
          description: '搜索关键词',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        limit: {
          type: 'number',
          description: '返回文章数量，默认10，最大30',
          minimum: 1,
          maximum: 30,
        },
        feedId: {
          type: 'string',
          description: '可选，限定订阅源 ID',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        starredOnly: {
          type: 'boolean',
          description: '可选，仅搜索收藏文章',
        },
        unreadOnly: {
          type: 'boolean',
          description: '可选，仅搜索未读文章',
        },
        publishedAfter: {
          type: 'string',
          description: '可选，发布时间下限，ISO 日期或可解析日期字符串',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        publishedBefore: {
          type: 'string',
          description: '可选，发布时间上限，ISO 日期或可解析日期字符串',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
      },
      ['query'],
    ),
    preview: async (_context, args) => {
      const entryId = String(args['entryId']).trim()
      return {
        message: entryStatePreview(entryId, {
          isStarred: args['isStarred'] === true,
        }),
      }
    },
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const query = String(args['query']).trim()
      const options = searchEntryOptions(args)
      const entries = getDb().entries.searchEntries(query, options)
      if (entries.length === 0) {
        return {
          status: 'success',
          message: `没有找到包含「${query}」的本地文章。`,
          data: { count: 0, entries: [] },
        }
      }

      const feeds = getDb().feeds.getAllFeeds()
      const feedMap = new Map(feeds.map((feed) => [feed.id, feed.title]))
      let message = `找到 ${entries.length} 篇包含「${query}」的文章：\n\n`
      entries.forEach((entry, index) => {
        const feedName = feedMap.get(entry.feedId) ?? entry.feedId
        message += `${entrySummary(entry, index)}\n   来源: ${feedName}\n   ID: ${entry.id}\n   ${entryStateLine(entry)}\n\n`
      })

      return {
        status: 'success',
        message,
        data: { count: entries.length, entries: entries as unknown as object },
      }
    },
  })
}

export function buildSearchAndOpenEntryTool(): AgentTool {
  return {
    name: 'search_and_open_entry',
    title: '搜索并打开文章',
    description:
      '按关键词搜索本地文章，并直接打开最匹配的一篇文章。用户明确想定位并阅读某篇文章时使用',
    inputSchema: buildSearchEntriesTool().inputSchema,
    capability: 'navigate',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (
      context: AgentExecutionContext,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      if (!isAgentCapabilityAllowed('read', context.agentPermissions)) {
        return {
          status: 'failed',
          message: '当前 Agent 权限不允许读取本地文章。',
        }
      }
      const query = String(args['query']).trim()
      const options = searchEntryOptions({ ...args, limit: 1 })
      const [entry] = getDb().entries.searchEntries(query, options)
      if (!entry) {
        return {
          status: 'success',
          message: `没有找到包含「${query}」的本地文章，未打开文章。`,
          data: { count: 0 },
        }
      }

      dispatchAgentNavigation({
        type: 'open-entry-detail',
        entryId: entry.id,
      })
      return {
        status: 'success',
        message: `已打开最匹配的文章：${entry.title}\nID: ${entry.id}`,
        data: { entry: entry as unknown as object },
      }
    },
  }
}

export function buildSetEntryReadStateTool(): AgentTool {
  return defineMutateTool({
    name: 'set_entry_read_state',
    title: '标记文章已读状态',
    description: '将单篇文章标记为已读或未读',
    inputSchema: objectParams(
      {
        entryId: {
          type: 'string',
          description: '文章 ID',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        isRead: {
          type: 'boolean',
          description: 'true 表示标记已读，false 表示标记未读',
        },
      },
      ['entryId', 'isRead'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const entryId = String(args['entryId']).trim()
      const isRead = args['isRead'] === true
      const result = updateEntryWithWriteBack(entryId, { isRead })
      if (!result.entry) {
        return { status: 'failed', message: `未找到 ID 为 "${entryId}" 的文章` }
      }
      const action = isRead ? '已读' : '未读'
      const suffix = result.changed ? '' : '（状态原本如此）'
      return {
        status: 'success',
        message: `已将文章「${result.entry.title}」标记为${action}${suffix}`,
        data: {
          entryId,
          isRead,
          changed: result.changed,
        },
      }
    },
  })
}

export function buildSetEntryStarredStateTool(): AgentTool {
  return defineMutateTool({
    name: 'set_entry_starred_state',
    title: '标记文章收藏状态',
    description: '收藏或取消收藏单篇文章',
    inputSchema: objectParams(
      {
        entryId: {
          type: 'string',
          description: '文章 ID',
          minLength: 1,
          maxLength: SHORT_TEXT_MAX_LENGTH,
        },
        isStarred: {
          type: 'boolean',
          description: 'true 表示收藏，false 表示取消收藏',
        },
      },
      ['entryId', 'isStarred'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const entryId = String(args['entryId']).trim()
      const isStarred = args['isStarred'] === true
      const result = updateEntryWithWriteBack(entryId, { isStarred })
      if (!result.entry) {
        return { status: 'failed', message: `未找到 ID 为 "${entryId}" 的文章` }
      }
      const action = isStarred ? '收藏' : '取消收藏'
      const suffix = result.changed ? '' : '（状态原本如此）'
      return {
        status: 'success',
        message: `已${action}文章「${result.entry.title}」${suffix}`,
        data: {
          entryId,
          isStarred,
          changed: result.changed,
        },
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
      const stats = getDb().maintenance.getDatabaseStats()
      const totalUnread = Math.max(0, stats.totalEntries - stats.readEntries)
      if (totalUnread === 0) {
        return {
          status: 'success',
          message: '所有文章已读完，无未读内容。',
          data: { totalUnread: 0 },
        }
      }
      const feeds = getDb().feeds.getAllFeeds()
      let message = `共有 ${totalUnread} 篇未读文章：\n`
      const perFeed: Array<{ name: string; count: number }> = []
      for (const feed of feeds) {
        const count = getDb().entries.getUnreadCount(feed.id)
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
      const { entries } = getDb().entries.getEntries({ starred: true, limit })
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
      const { markedCount } = markAllRead()
      return {
        status: 'success',
        message: `已将 ${markedCount} 篇文章标记为已读`,
        data: { markedCount },
      }
    },
  })
}
