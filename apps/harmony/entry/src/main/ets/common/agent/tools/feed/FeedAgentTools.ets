import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import { FeedViewType } from '../../../models/LivoModels'
import type { Feed, RemoteFeedResult } from '../../../models/LivoModels'
import { FeedRefreshCoordinator } from '../../../data/FeedRefreshCoordinator'
import { FeedRepository } from '../../../repositories/FeedRepository'
import { EntryRepository } from '../../../repositories/EntryRepository'
import { FeedSubscribeAction } from '../../../coordinators/feed-subscribe/FeedSubscribeAction'
import type { FeedSubscribeRequest } from '../../../coordinators/feed-subscribe/FeedSubscribeAction'

const VIEW_NAMES: string[] = ['文章', '社交', '视频', '图片']

function emptyParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function feedEntriesParams(): AgentToolInputSchema {
  const feedIdParam: AgentToolParamSchema = { type: 'string', description: '订阅源ID' }
  const limitParam: AgentToolParamSchema = { type: 'number', description: '返回文章数量，默认10，最大30' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['feedId'] = feedIdParam
  properties['limit'] = limitParam
  const required: string[] = ['feedId']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function feedIdParams(description: string): AgentToolInputSchema {
  const feedIdParam: AgentToolParamSchema = { type: 'string', description }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['feedId'] = feedIdParam
  const required: string[] = ['feedId']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function addFeedParams(): AgentToolInputSchema {
  const urlParam: AgentToolParamSchema = { type: 'string', description: '订阅源的 RSS URL 或网站 URL' }
  const titleParam: AgentToolParamSchema = { type: 'string', description: '订阅源的名称，可选' }
  const categoryParam: AgentToolParamSchema = { type: 'string', description: '订阅源的分类，可选' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['url'] = urlParam
  properties['title'] = titleParam
  properties['category'] = categoryParam
  const required: string[] = ['url']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function refreshResultMessage(label: string, result: RemoteFeedResult): string {
  const failed = result.failedFeedCount && result.failedFeedCount > 0
    ? `，失败 ${result.failedFeedCount} 个`
    : ''
  const skipped = result.skippedFeedCount && result.skippedFeedCount > 0
    ? `，跳过 ${result.skippedFeedCount} 个`
    : ''
  return `${label}：${result.sourceLabel}${failed}${skipped}`
}

function feedSummary(feed: Feed): string {
  const viewIdx = feed.view
  const viewName = viewIdx >= 0 && viewIdx < VIEW_NAMES.length ? VIEW_NAMES[viewIdx] : '未知'
  const lastFetched = feed.lastFetched && feed.lastFetched > 0
    ? new Date(feed.lastFetched).toISOString()
    : '未获取'
  return `• ${feed.title} [${feed.category || viewName}] - ID: ${feed.id} - 最后更新: ${lastFetched}`
}

export function buildListSubscribedFeedsTool(): AgentTool {
  return {
    name: 'list_subscribed_feeds',
    title: '查询订阅源',
    description: '查询用户所有已订阅的RSS源列表，返回每个源的名称、分类、订阅URL、最后更新时间等信息',
    inputSchema: emptyParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (): Promise<AgentToolResult> => {
      const feeds = await FeedRepository.default.list()
      if (feeds.length === 0) {
        return { status: 'success', message: '当前没有订阅任何源。' }
      }

      let lines = ''
      for (const f of feeds) {
        lines += feedSummary(f) + '\n'
      }
      return {
        status: 'success',
        message: `共订阅 ${feeds.length} 个源：\n\n${lines}`,
        data: { count: feeds.length, feeds },
      }
    },
  }
}

export function buildGetFeedEntriesTool(): AgentTool {
  return {
    name: 'get_feed_entries',
    title: '获取订阅源文章',
    description: '获取指定订阅源的文章列表',
    inputSchema: feedEntriesParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const feedId = args['feedId'] as string
      const limitRaw = args['limit'] as number
      const limitNum = typeof limitRaw === 'number' ? limitRaw : 10
      const limit = Math.min(Math.max(1, limitNum), 30)
      const feed = await FeedRepository.default.getById(feedId)
      if (!feed) {
        return { status: 'failed', message: `未找到 ID 为 "${feedId}" 的订阅源` }
      }

      const entries = await EntryRepository.default.listByFeed(feedId)
      const sliced = entries.slice(0, limit)
      if (sliced.length === 0) {
        return { status: 'success', message: `订阅源「${feed.title}」暂无文章` }
      }

      let lines = ''
      for (let i = 0; i < sliced.length; i += 1) {
        const entry = sliced[i]
        const published = new Date(entry.publishedAt).toLocaleString()
        const slicedSummary = entry.summary.length > 200
          ? entry.summary.slice(0, 200) + '...'
          : entry.summary
        lines += `[${i + 1}] ${entry.title}\n`
        lines += `   作者: ${entry.author || '未知'}\n`
        lines += `   发布时间: ${published}\n`
        lines += `   摘要: ${slicedSummary}\n`
        lines += `   链接: ${entry.url}\n\n`
      }

      return {
        status: 'success',
        message: `订阅源「${feed.title}」共有 ${entries.length} 篇文章，显示前 ${sliced.length} 篇：\n\n${lines}`,
        data: { count: entries.length, entries: sliced },
      }
    },
  }
}

export function buildAddFeedTool(): AgentTool {
  return {
    name: 'add_feed',
    title: '添加订阅源',
    description: '添加新的 RSS 订阅源。当用户要求添加、订阅某个源、网站或 URL 时使用此工具。需要提供订阅源的 URL，可以可选提供名称和分类',
    inputSchema: addFeedParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const url = (args['url'] as string).trim()
      const title = ((args['title'] as string) || '').trim()
      const category = ((args['category'] as string) || '').trim()

      const existingFeed = await FeedRepository.default.getByUrl(url)
      if (existingFeed) {
        return {
          status: 'success',
          message: `该订阅源已存在：「${existingFeed.title}」（ID: ${existingFeed.id}），无需重复添加`,
          data: { feed: existingFeed },
        }
      }

      const request: FeedSubscribeRequest = {
        targetUrl: url,
        targetTitle: title,
        targetSiteUrl: url,
        targetDescription: '',
        customTitle: title,
        customCategory: category,
        selectedView: FeedViewType.Articles,
        hideInTimeline: false,
        mappedTargetUrl: url,
        resolvedImageUrl: '',
      }

      const outcome = await FeedSubscribeAction.subscribe(request)
      return {
        status: 'success',
        message: `订阅成功！已添加「${outcome.message}」（ID: ${outcome.feedId}）`,
        data: { feedId: outcome.feedId, wasUpdate: outcome.wasUpdate },
      }
    },
  }
}

export function buildRemoveSubscriptionTool(): AgentTool {
  return {
    name: 'remove_subscription',
    title: '删除订阅源',
    description: '删除指定订阅源及其本地文章。必须先确认；通常先查询订阅源列表获得 feedId',
    inputSchema: feedIdParams('要删除的订阅源 ID'),
    capability: 'destructive',
    risk: 'high',
    requiresConfirmation: true,
    confirmationTitle: '确认删除订阅源',
    confirmationMessage: '将删除该订阅源以及它的本地文章记录，操作完成后不可从应用内撤销。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const feedId = (args['feedId'] as string).trim()
      const feed = await FeedRepository.default.getById(feedId)
      if (!feed) {
        return { status: 'failed', message: `未找到 ID 为 "${feedId}" 的订阅源` }
      }

      const entries = await EntryRepository.default.listByFeed(feedId)
      console.info('[FeedAgent] remove_subscription', feedId, 'entries:', entries.length)
      await FeedSubscribeAction.unsubscribe(feedId)
      return {
        status: 'success',
        message: `已删除订阅源「${feed.title}」，同时移除 ${entries.length} 篇本地文章`,
        data: { feedId, title: feed.title, removedEntries: entries.length },
      }
    },
  }
}

export function buildRefreshSubscriptionTool(): AgentTool {
  return {
    name: 'refresh_subscription',
    title: '刷新订阅源',
    description: '刷新指定订阅源，拉取最新文章并更新本地数据。通常先查询订阅源列表获得 feedId',
    inputSchema: feedIdParams('要刷新的订阅源 ID'),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认刷新订阅源',
    confirmationMessage: '将访问订阅源网络地址并写入最新文章、抓取状态和刷新日志。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const feedId = (args['feedId'] as string).trim()
      const feed = await FeedRepository.default.getById(feedId)
      if (!feed) {
        return { status: 'failed', message: `未找到 ID 为 "${feedId}" 的订阅源` }
      }

      console.info('[FeedAgent] refresh_subscription', feedId)
      const result = await FeedRefreshCoordinator.default.refreshFeed(feedId)
      return {
        status: result.fallbackUsed ? 'failed' : 'success',
        message: refreshResultMessage(`已刷新「${feed.title}」`, result),
        data: { feedId, result },
      }
    },
  }
}

export function buildRefreshAllSubscriptionsTool(): AgentTool {
  return {
    name: 'refresh_all_subscriptions',
    title: '刷新全部订阅源',
    description: '刷新所有订阅源，拉取最新文章并写入本地数据。订阅数量较多时可能耗时较长',
    inputSchema: emptyParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认刷新全部订阅源',
    confirmationMessage: '将访问所有订阅源网络地址并写入最新文章、抓取状态和刷新日志。',
    execute: async (): Promise<AgentToolResult> => {
      const feeds = await FeedRepository.default.list()
      if (feeds.length === 0) {
        return { status: 'success', message: '当前没有可刷新的订阅源。' }
      }

      console.info('[FeedAgent] refresh_all_subscriptions total:', feeds.length)
      const result = await FeedRefreshCoordinator.default.refreshAllFeeds()
      return {
        status: result.fallbackUsed ? 'failed' : 'success',
        message: refreshResultMessage(`已刷新 ${feeds.length} 个订阅源`, result),
        data: { count: feeds.length, result },
      }
    },
  }
}
