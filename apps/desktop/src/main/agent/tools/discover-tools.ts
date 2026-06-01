import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
} from '../../../shared/types'
import {
  CURATED_FEEDS,
  searchCuratedFeeds,
  type DiscoverFeed,
} from '../../../shared/discover-data'
import { getFeedByUrl } from '../../database'
import { subscribeByUrl } from './feed-tools'
import { objectParams } from './schema'
import { defineMutateTool, defineReadTool } from './factories'

const CATEGORY_VALUES = [
  'all',
  'ai',
  'articles',
  'news',
  'social',
  'videos',
  'pictures',
  'podcast',
  'ins',
]

function feedsForCategory(category: string): DiscoverFeed[] {
  if (!category || category === 'all') return CURATED_FEEDS
  return CURATED_FEEDS.filter((f) => f.category === category)
}

function findCuratedFeed(title: string): DiscoverFeed | undefined {
  const keyword = title.trim().toLowerCase()
  if (!keyword) return undefined
  const exact = CURATED_FEEDS.find((f) => f.title.toLowerCase() === keyword)
  if (exact) return exact
  const partial = CURATED_FEEDS.find((f) => {
    const t = f.title.toLowerCase()
    return t.includes(keyword) || keyword.includes(t)
  })
  if (partial) return partial
  const fromSearch = searchCuratedFeeds(title)
  return fromSearch[0]
}

export function buildListBuiltinFeedsTool(): AgentTool {
  return defineReadTool({
    name: 'list_builtin_feeds',
    title: '查看推荐订阅源',
    description: '查看应用内置的推荐订阅源，可按分类查看',
    inputSchema: objectParams({
      category: {
        type: 'string',
        description: '分类名称',
        enum: CATEGORY_VALUES,
      },
    }),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const category = String(args['category'] || 'all').trim() || 'all'
      const feeds = feedsForCategory(category)
      if (feeds.length === 0) {
        return {
          status: 'success',
          message: `暂无 ${category} 分类的推荐订阅源`,
        }
      }
      const display = feeds.slice(0, 30)
      let lines = ''
      display.forEach((feed, i) => {
        const desc = (feed.description || '').slice(0, 50)
        lines += `${i + 1}. ${feed.title} - ${desc}\n`
      })
      const more =
        feeds.length > 30 ? `（显示前 30 个，共 ${feeds.length} 个）` : ''
      return {
        status: 'success',
        message: `推荐订阅源 - ${category} 分类 ${more}：\n\n${lines}`,
        data: { count: feeds.length, feeds: display as unknown as object },
      }
    },
  })
}

export function buildAddBuiltinSubscriptionTool(): AgentTool {
  return defineMutateTool({
    name: 'add_builtin_subscription',
    title: '添加推荐订阅源',
    description: '从应用内置的推荐订阅源列表中添加到用户订阅',
    inputSchema: objectParams(
      { feedTitle: { type: 'string', description: '要添加的推荐订阅源名称' } },
      ['feedTitle'],
    ),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const feedTitle = String(args['feedTitle']).trim()
      const matched = findCuratedFeed(feedTitle)
      if (!matched) {
        const suggestions = searchCuratedFeeds(feedTitle)
          .slice(0, 5)
          .map((f, i) => `${i + 1}. ${f.title}`)
          .join('\n')
        const hint = suggestions ? `\n\n可能想要添加：\n${suggestions}` : ''
        return {
          status: 'failed',
          message: `未找到名为 "${feedTitle}" 的推荐订阅源。${hint}`,
        }
      }
      if (getFeedByUrl(matched.url)) {
        return { status: 'success', message: `您已订阅 "${matched.title}"` }
      }
      const outcome = await subscribeByUrl(
        matched.url,
        matched.title,
        matched.category,
      )
      return {
        status: 'success',
        message: `成功添加推荐订阅源：${matched.title}\n分类：${matched.category}`,
        data: { feedId: outcome.feedId },
      }
    },
  })
}
