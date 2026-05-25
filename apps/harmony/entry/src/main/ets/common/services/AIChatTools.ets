import { Feed, Entry } from '../models/LivoModels'
import { FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { WebSearchService } from './WebSearchService'

export interface ToolFunctionParams {
  type: string
  properties: ToolParamProperties
  required: string[]
}

export interface ToolParamProperties {
  feedId?: ToolParamProp
  limit?: ToolParamProp
  entryId?: ToolParamProp
  query?: ToolParamProp
}

export interface ToolParamProp {
  type: string
  description: string
}

export interface ToolFunction {
  name: string
  description: string
  parameters: ToolFunctionParams
}

export interface ChatToolDefinition {
  type: string
  function: ToolFunction
}

export interface ChatToolCall {
  id: string
  type: string
  function: ToolCallFunction
}

export interface ToolCallFunction {
  name: string
  arguments: string
}

function emptyParams(): ToolFunctionParams {
  return { type: 'object', properties: {}, required: [] }
}

function feedParams(): ToolFunctionParams {
  return {
    type: 'object',
    properties: {
      feedId: { type: 'string', description: '订阅源ID' },
      limit: { type: 'number', description: '返回文章数量，默认10，最大30' }
    },
    required: ['feedId']
  }
}

function todayParams(): ToolFunctionParams {
  return {
    type: 'object',
    properties: {
      limit: { type: 'number', description: '返回文章数量，默认20，最大50' }
    },
    required: []
  }
}

function entryParams(): ToolFunctionParams {
  return {
    type: 'object',
    properties: {
      entryId: { type: 'string', description: '文章ID' }
    },
    required: ['entryId']
  }
}

function searchParams(): ToolFunctionParams {
  return {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索关键词或问题' }
    },
    required: ['query']
  }
}

export function buildDefaultTools(): ChatToolDefinition[] {
  const tools: ChatToolDefinition[] = []
  tools.push({
    type: 'function',
    function: {
      name: 'list_subscribed_feeds',
      description: '查询用户所有已订阅的RSS源列表，返回每个源的名称、分类、订阅URL、最后更新时间等信息',
      parameters: emptyParams()
    }
  })
  tools.push({
    type: 'function',
    function: {
      name: 'get_feed_entries',
      description: '获取指定订阅源的文章列表',
      parameters: feedParams()
    }
  })
  tools.push({
    type: 'function',
    function: {
      name: 'get_today_updates',
      description: '查询今天有哪些订阅源更新了内容，以及各自更新了哪些文章。返回按发布时间倒序排列的文章，包含标题、来源、摘要和链接',
      parameters: todayParams()
    }
  })
  tools.push({
    type: 'function',
    function: {
      name: 'get_entry_detail',
      description: '获取指定文章的完整内容和详细信息',
      parameters: entryParams()
    }
  })
  tools.push({
    type: 'function',
    function: {
      name: 'get_unread_count',
      description: '查询未读文章总数和各订阅源的未读数量统计',
      parameters: emptyParams()
    }
  })
  tools.push({
    type: 'function',
    function: {
      name: 'web_search',
      description: '执行网络搜索，获取实时信息。当用户的问题需要最新网络信息、新闻、天气、股票价格或其他订阅源中没有的内容时使用此工具',
      parameters: searchParams()
    }
  })
  return tools
}

const VIEW_NAMES: string[] = ['文章', '社交', '视频', '图片']

function feedSummary(feed: Feed): string {
  const viewIdx = feed.view
  const viewName = viewIdx >= 0 && viewIdx < VIEW_NAMES.length ? VIEW_NAMES[viewIdx] : '未知'
  const lastFetched = feed.lastFetched && feed.lastFetched > 0
    ? new Date(feed.lastFetched).toISOString()
    : '未获取'
  return `• ${feed.title} [${feed.category || viewName}] - ID: ${feed.id} - 最后更新: ${lastFetched}`
}

function entrySummary(entry: Entry, index: number): string {
  const published = new Date(entry.publishedAt).toLocaleString()
  const slicedSummary = entry.summary.length > 200
    ? entry.summary.slice(0, 200) + '...'
    : entry.summary
  return `[${index + 1}] ${entry.title}\n   作者: ${entry.author || '未知'}\n   发布时间: ${published}\n   摘要: ${slicedSummary}\n   链接: ${entry.url}`
}

async function listFeeds(): Promise<string> {
  const feeds = await FeedRepository.default.list()
  if (feeds.length === 0) {
    return '当前没有订阅任何源。'
  }
  let lines = ''
  for (const f of feeds) {
    lines += feedSummary(f) + '\n'
  }
  return `共订阅 ${feeds.length} 个源：\n\n${lines}`
}

async function getFeedEntries(args: Record<string, Object>): Promise<string> {
  const feedId = args['feedId'] as string
  if (!feedId) {
    return '错误：缺少 feedId 参数'
  }
  const limitRaw = args['limit'] as number
  const limitNum = typeof limitRaw === 'number' ? limitRaw : 10
  const limit = Math.min(Math.max(1, limitNum), 30)
  const feed = await FeedRepository.default.getById(feedId)
  if (!feed) {
    return `错误：未找到 ID 为 "${feedId}" 的订阅源`
  }
  const entries = await EntryRepository.default.listByFeed(feedId)
  const sliced = entries.slice(0, limit)
  if (sliced.length === 0) {
    return `订阅源「${feed.title}」暂无文章`
  }
  let lines = ''
  for (let i = 0; i < sliced.length; i += 1) {
    lines += entrySummary(sliced[i], i) + '\n\n'
  }
  return `订阅源「${feed.title}」共有 ${entries.length} 篇文章，显示前 ${sliced.length} 篇：\n\n${lines}`
}

async function getTodayUpdates(args: Record<string, Object>): Promise<string> {
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
    return '今天还没有订阅源更新内容。'
  }

  const feedUpdateCount = new Map<string, number>()
  for (const e of sliced) {
    const count = feedUpdateCount.get(e.feedId) ?? 0
    feedUpdateCount.set(e.feedId, count + 1)
  }

  let result = `今天共有 ${feedUpdateCount.size} 个订阅源更新了内容（共 ${todayEntries.length} 篇文章），显示前 ${sliced.length} 篇：\n\n`
  result += '📊 各源今日更新数量：\n'
  feedUpdateCount.forEach((count: number, feedId: string) => {
    const feed = feedMap.get(feedId)
    const name = feed ? feed.title : feedId
    result += `  • ${name}: ${count} 篇\n`
  })
  result += '\n📰 最新文章：\n\n'
  for (let i = 0; i < sliced.length; i += 1) {
    const e = sliced[i]
    const feed = feedMap.get(e.feedId)
    const feedName = feed ? feed.title : e.feedId
    result += `${entrySummary(e, i)}\n   来源: ${feedName}\n\n`
  }
  return result
}

async function getEntryDetail(args: Record<string, Object>): Promise<string> {
  const entryId = args['entryId'] as string
  if (!entryId) {
    return '错误：缺少 entryId 参数'
  }
  const entry = await EntryRepository.default.getById(entryId)
  if (!entry) {
    return `错误：未找到 ID 为 "${entryId}" 的文章`
  }
  const published = new Date(entry.publishedAt).toLocaleString()
  const tagStr = (entry.tags || []).join(', ') || '无'
  const contentSliced = entry.content.length > 3000
    ? entry.content.slice(0, 3000) + '\n...(内容已截断)'
    : entry.content
  return `标题: ${entry.title}\n作者: ${entry.author || '未知'}\n发布时间: ${published}\n阅读时长: ${entry.readingTimeMinutes} 分钟\n标签: ${tagStr}\n链接: ${entry.url}\n\n摘要:\n${entry.summary}\n\n正文:\n${contentSliced}`
}

async function getUnreadCount(): Promise<string> {
  const feeds = await FeedRepository.default.list()
  const totalUnread = await EntryRepository.default.countUnread()
  if (totalUnread === 0) {
    return '所有文章已读完，无未读内容。'
  }
  let result = `共有 ${totalUnread} 篇未读文章：\n`
  for (const feed of feeds) {
    const count = await EntryRepository.default.countUnreadByFeed(feed.id)
    if (count > 0) {
      result += `  • ${feed.title}: ${count} 篇未读\n`
    }
  }
  return result
}

async function webSearch(args: Record<string, Object>): Promise<string> {
  const query = args['query'] as string
  if (!query) {
    return '错误：缺少搜索关键词参数'
  }
  
  try {
    const results = await WebSearchService.search(query)
    return WebSearchService.formatResultsForAI(results, query)
  } catch (error) {
    return `搜索失败: ${error instanceof Error ? error.message : String(error)}`
  }
}

export async function executeToolCall(name: string, args: string): Promise<string> {
  let parsedArgs: Record<string, Object> = {}
  try {
    const raw = JSON.parse(args || '{}') as object
    parsedArgs = raw as Record<string, Object>
  } catch (_e) {
    // use empty args
  }
  switch (name) {
    case 'list_subscribed_feeds':
      return listFeeds()
    case 'get_feed_entries':
      return getFeedEntries(parsedArgs)
    case 'get_today_updates':
      return getTodayUpdates(parsedArgs)
    case 'get_entry_detail':
      return getEntryDetail(parsedArgs)
    case 'get_unread_count':
      return getUnreadCount()
    case 'web_search':
      return webSearch(parsedArgs)
    default:
      return `{"error": "未知工具: ${name}"}`
  }
}
