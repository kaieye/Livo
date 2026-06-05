import { FeedViewType } from '../../../shared/types'
import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
  Feed,
} from '../../../shared/types'
import { getDb } from '../../database'
import {
  addFeed,
  refreshAllFeeds,
  refreshFeed,
  removeFeed,
} from '../../operations/feed-operations'
import { clampLimit, emptyParams, objectParams } from './schema'
import { defineMutateTool, defineReadTool } from './factories'

const VIEW_NAMES = ['文章', '社交', '视频', '图片']

function viewName(view: FeedViewType): string {
  return VIEW_NAMES[view] ?? '未知'
}

function feedSummary(feed: Feed): string {
  const lastFetched =
    feed.lastFetched && feed.lastFetched > 0
      ? new Date(feed.lastFetched).toLocaleString()
      : '未获取'
  return `• ${feed.title} [${feed.category || viewName(feed.view)}] - ID: ${feed.id} - 最后更新: ${lastFetched}`
}

export function buildListSubscribedFeedsTool(): AgentTool {
  return defineReadTool({
    name: 'list_subscribed_feeds',
    title: '查询订阅源',
    description:
      '查询用户所有已订阅的RSS源列表，返回每个源的名称、分类、最后更新时间和 ID',
    inputSchema: emptyParams(),
    execute: async (): Promise<AgentToolResult> => {
      const feeds = getDb().feeds.getAllFeeds()
      if (feeds.length === 0) {
        return { status: 'success', message: '当前没有订阅任何源。' }
      }
      const lines = feeds.map(feedSummary).join('\n')
      return {
        status: 'success',
        message: `共订阅 ${feeds.length} 个源：\n\n${lines}`,
        data: { count: feeds.length, feeds: feeds as unknown as object },
      }
    },
  })
}

export function buildGetFeedEntriesTool(): AgentTool {
  return defineReadTool({
    name: 'get_feed_entries',
    title: '获取订阅源文章',
    description: '获取指定订阅源的文章列表',
    inputSchema: objectParams(
      {
        feedId: { type: 'string', description: '订阅源ID' },
        limit: { type: 'number', description: '返回文章数量，默认10，最大30' },
      },
      ['feedId'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const feedId = String(args['feedId'])
      const limit = clampLimit(args['limit'], 10, 30)
      const feed = getDb().feeds.getFeedById(feedId)
      if (!feed) {
        return {
          status: 'failed',
          message: `未找到 ID 为 "${feedId}" 的订阅源`,
        }
      }
      const { entries } = getDb().entries.getEntries({ feedId, limit })
      if (entries.length === 0) {
        return { status: 'success', message: `订阅源「${feed.title}」暂无文章` }
      }
      let lines = ''
      entries.forEach((entry, i) => {
        const published = new Date(entry.publishedAt).toLocaleString()
        const summary = (entry.summary || '').slice(0, 200)
        lines += `[${i + 1}] ${entry.title}\n   作者: ${entry.author || '未知'}\n   发布时间: ${published}\n   摘要: ${summary}\n   链接: ${entry.url}\n\n`
      })
      return {
        status: 'success',
        message: `订阅源「${feed.title}」最新 ${entries.length} 篇文章：\n\n${lines}`,
        data: { count: entries.length, entries: entries as unknown as object },
      }
    },
  })
}

export function buildAddFeedTool(): AgentTool {
  return defineMutateTool({
    name: 'add_feed',
    title: '添加订阅源',
    description:
      '添加新的 RSS 订阅源。当用户要求添加、订阅某个源、网站或 URL 时使用。需要 URL，可选名称和分类',
    inputSchema: objectParams(
      {
        url: { type: 'string', description: '订阅源的 RSS URL 或网站 URL' },
        title: { type: 'string', description: '订阅源的名称，可选' },
        category: { type: 'string', description: '订阅源的分类，可选' },
      },
      ['url'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const url = String(args['url']).trim()
      const title = String(args['title'] || '').trim()
      const category = String(args['category'] || '').trim()
      const { feed, existed } = await addFeed({ url, title, category })
      if (existed) {
        return {
          status: 'success',
          message: `该订阅源已存在：「${feed.title}」（ID: ${feed.id}），无需重复添加`,
          data: { feedId: feed.id },
        }
      }
      return {
        status: 'success',
        message: `订阅成功！已添加「${feed.title}」（ID: ${feed.id}）`,
        data: { feedId: feed.id },
      }
    },
  })
}

export function buildRemoveSubscriptionTool(): AgentTool {
  return {
    name: 'remove_subscription',
    title: '删除订阅源',
    description:
      '删除指定订阅源及其本地文章。必须先确认；通常先查询订阅源列表获得 feedId',
    inputSchema: objectParams(
      { feedId: { type: 'string', description: '要删除的订阅源 ID' } },
      ['feedId'],
    ),
    capability: 'destructive',
    risk: 'high',
    requiresConfirmation: true,
    confirmationTitle: '确认删除订阅源',
    confirmationMessage:
      '将删除该订阅源以及它的本地文章记录，操作完成后不可从应用内撤销。',
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const feedId = String(args['feedId']).trim()
      const result = removeFeed(feedId)
      if (!result) {
        return {
          status: 'failed',
          message: `未找到 ID 为 "${feedId}" 的订阅源`,
        }
      }
      return {
        status: 'success',
        message: `已删除订阅源「${result.feed.title}」及其本地文章`,
        data: {
          feedId,
          title: result.feed.title,
          hadEntries: result.entryCount > 0,
        },
      }
    },
  }
}

export function buildRefreshSubscriptionTool(): AgentTool {
  return defineMutateTool({
    name: 'refresh_subscription',
    title: '刷新订阅源',
    description:
      '刷新指定订阅源，拉取最新文章并更新本地数据。通常先查询订阅源列表获得 feedId',
    inputSchema: objectParams(
      { feedId: { type: 'string', description: '要刷新的订阅源 ID' } },
      ['feedId'],
    ),
    confirmationTitle: '确认刷新订阅源',
    confirmationMessage:
      '将访问订阅源网络地址并写入最新文章、抓取状态和刷新日志。',
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const feedId = String(args['feedId']).trim()
      const result = await refreshFeed(feedId)
      if (!result) {
        return {
          status: 'failed',
          message: `未找到 ID 为 "${feedId}" 的订阅源`,
        }
      }
      return {
        status: 'success',
        message: `已刷新「${result.feed.title}」，新增 ${result.newEntries} 篇文章`,
        data: { feedId, newEntries: result.newEntries },
      }
    },
  })
}

export function buildRefreshAllSubscriptionsTool(): AgentTool {
  return defineMutateTool({
    name: 'refresh_all_subscriptions',
    title: '刷新全部订阅源',
    description:
      '刷新所有订阅源，拉取最新文章并写入本地数据。订阅数量较多时可能耗时较长',
    inputSchema: emptyParams(),
    confirmationTitle: '确认刷新全部订阅源',
    confirmationMessage:
      '将访问所有订阅源网络地址并写入最新文章、抓取状态和刷新日志。',
    execute: async (): Promise<AgentToolResult> => {
      const result = await refreshAllFeeds({ force: true })
      if (result.totalFeeds === 0) {
        return { status: 'success', message: '当前没有可刷新的订阅源。' }
      }
      const failedSuffix =
        result.failedCount > 0 ? `，失败 ${result.failedCount} 个` : ''
      return {
        status:
          result.failedCount > 0 && result.refreshedCount === 0
            ? 'failed'
            : 'success',
        message: `已刷新 ${result.totalFeeds} 个订阅源：成功 ${result.refreshedCount} 个${failedSuffix}，共新增 ${result.totalNewEntries} 篇文章`,
        data: {
          total: result.totalFeeds,
          success: result.refreshedCount,
          failed: result.failedCount,
          newEntries: result.totalNewEntries,
          runId: result.runId,
        },
      }
    },
  })
}
