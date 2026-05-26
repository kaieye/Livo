import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import {
  builtinDiscoverFeedsAll,
  builtinDiscoverFeedsByView,
} from '../../../data/DiscoverBuiltinFeeds'
import type { DiscoverBuiltinFeed } from '../../../data/DiscoverBuiltinFeeds'
import { FeedViewType } from '../../../models/LivoModels'
import { FeedRepository } from '../../../repositories/FeedRepository'
import { FeedSubscribeAction } from '../../../utils/feed-subscribe/FeedSubscribeAction'
import type { FeedSubscribeRequest } from '../../../utils/feed-subscribe/FeedSubscribeAction'

const DISCOVER_CATEGORY_VALUES: string[] = ['articles', 'social', 'pictures', 'videos', 'ai', 'podcast', 'news', 'all']

function listBuiltinFeedsParams(): AgentToolInputSchema {
  const categoryParam: AgentToolParamSchema = {
    type: 'string',
    description: '分类名称',
    enum: DISCOVER_CATEGORY_VALUES,
  }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['category'] = categoryParam
  const required: string[] = []
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function addBuiltinSubscriptionParams(): AgentToolInputSchema {
  const feedTitleParam: AgentToolParamSchema = { type: 'string', description: '要添加的内嵌订阅源名称' }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['feedTitle'] = feedTitleParam
  const required: string[] = ['feedTitle']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function builtinFeedsForCategory(category: string): DiscoverBuiltinFeed[] {
  if (category === 'articles') {
    return builtinDiscoverFeedsByView(FeedViewType.Articles)
  }
  if (category === 'social') {
    return builtinDiscoverFeedsByView(FeedViewType.SocialMedia)
  }
  if (category === 'pictures') {
    return builtinDiscoverFeedsByView(FeedViewType.Pictures)
  }
  if (category === 'videos') {
    return builtinDiscoverFeedsByView(FeedViewType.Videos)
  }
  if (category === 'ai' || category === 'podcast' || category === 'news') {
    return builtinDiscoverFeedsAll().filter((feed: DiscoverBuiltinFeed): boolean => {
      if (category === 'ai') {
        return feed.category.includes('AI')
      }
      if (category === 'podcast') {
        return feed.category.includes('播客')
      }
      return feed.category.includes('新闻')
    })
  }
  return builtinDiscoverFeedsAll()
}

function categoryLabel(category: string): string {
  if (category === 'articles') {
    return '文章'
  }
  if (category === 'social') {
    return '社交'
  }
  if (category === 'pictures') {
    return '图片'
  }
  if (category === 'videos') {
    return '视频'
  }
  if (category === 'ai') {
    return 'AI'
  }
  if (category === 'podcast') {
    return '播客'
  }
  if (category === 'news') {
    return '新闻'
  }
  return '全部'
}

function findBuiltinFeed(feedTitle: string): DiscoverBuiltinFeed | undefined {
  const keyword = feedTitle.trim().toLowerCase()
  if (!keyword) {
    return undefined
  }
  const allBuiltinFeeds = builtinDiscoverFeedsAll()
  return allBuiltinFeeds.find((feed: DiscoverBuiltinFeed): boolean => {
    const title = feed.title.toLowerCase()
    return title.includes(keyword) || keyword.includes(title)
  })
}

function similarBuiltinFeeds(feedTitle: string): DiscoverBuiltinFeed[] {
  const keyword = feedTitle.trim().toLowerCase()
  if (!keyword) {
    return []
  }
  const prefix = keyword.slice(0, 3)
  return builtinDiscoverFeedsAll().filter((feed: DiscoverBuiltinFeed): boolean => {
    const title = feed.title.toLowerCase()
    return title.includes(prefix) || keyword.includes(title.slice(0, 3))
  }).slice(0, 5)
}

export function buildListBuiltinFeedsTool(): AgentTool {
  return {
    name: 'list_builtin_feeds',
    title: '查看推荐订阅源',
    description: '查看应用内嵌的推荐订阅源，可按分类查看',
    inputSchema: listBuiltinFeedsParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const category = ((args['category'] as string) || 'all').trim() || 'all'
      const feeds = builtinFeedsForCategory(category)
      if (feeds.length === 0) {
        return { status: 'success', message: `暂无 ${category} 分类的推荐订阅源` }
      }

      const displayFeeds = feeds.slice(0, 30)
      let lines = ''
      for (let i = 0; i < displayFeeds.length; i += 1) {
        const feed = displayFeeds[i]
        const description = feed.description.length > 50
          ? feed.description.slice(0, 50) + '...'
          : feed.description
        lines += `${i + 1}. ${feed.title} - ${description}\n`
      }

      const totalText = feeds.length > 30 ? `（显示前30个，共${feeds.length}个）` : ''
      return {
        status: 'success',
        message: `推荐订阅源 - ${categoryLabel(category)}分类 ${totalText}：\n\n${lines}`,
        data: { count: feeds.length, feeds: displayFeeds },
      }
    },
  }
}

export function buildAddBuiltinSubscriptionTool(): AgentTool {
  return {
    name: 'add_builtin_subscription',
    title: '添加推荐订阅源',
    description: '从应用内嵌的推荐订阅源列表中添加到用户订阅',
    inputSchema: addBuiltinSubscriptionParams(),
    capability: 'mutate',
    risk: 'medium',
    requiresConfirmation: true,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const feedTitle = (args['feedTitle'] as string).trim()
      const matchedFeed = findBuiltinFeed(feedTitle)
      if (!matchedFeed) {
        const suggestions = similarBuiltinFeeds(feedTitle)
        let message = `未找到名为 "${feedTitle}" 的推荐订阅源。`
        if (suggestions.length > 0) {
          message += '\n\n可能想要添加：\n'
          for (let i = 0; i < suggestions.length; i += 1) {
            message += `${i + 1}. ${suggestions[i].title}\n`
          }
        }
        return { status: 'failed', message }
      }

      const existingFeeds = await FeedRepository.default.list()
      const alreadySubscribed = existingFeeds.some((feed): boolean => feed.url === matchedFeed.url)
      if (alreadySubscribed) {
        return { status: 'success', message: `您已订阅 "${matchedFeed.title}"` }
      }

      const request: FeedSubscribeRequest = {
        targetUrl: matchedFeed.url,
        targetTitle: matchedFeed.title,
        targetSiteUrl: matchedFeed.siteUrl,
        targetDescription: matchedFeed.description,
        customTitle: matchedFeed.title,
        customCategory: matchedFeed.category,
        selectedView: matchedFeed.view,
        hideInTimeline: false,
        mappedTargetUrl: matchedFeed.url,
        resolvedImageUrl: matchedFeed.imageUrl || '',
      }
      const outcome = await FeedSubscribeAction.subscribe(request)
      return {
        status: 'success',
        message: `成功添加推荐订阅源：${matchedFeed.title}\n分类：${matchedFeed.category}`,
        data: { feedId: outcome.feedId, wasUpdate: outcome.wasUpdate },
      }
    },
  }
}
