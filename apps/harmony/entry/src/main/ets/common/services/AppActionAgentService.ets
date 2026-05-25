import { Feed, Entry, HarmonySettings } from '../models/LivoModels'
import { FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { ThemeService } from './ThemeService'
import { SettingsStore } from './SettingsStore'
import { ChatHistoryStore, ChatSession } from './ChatHistoryStore'
import { AppContextService } from './AppContextService'
import { 
  builtinDiscoverFeedsAll, 
  DiscoverBuiltinFeed,
  builtinDiscoverFeedsByView,
  FeedViewType
} from '../data/DiscoverBuiltinFeeds'

export interface AppActionToolDefinition {
  name: string
  description: string
  parameters: AppActionToolParams
}

export interface AppActionToolParams {
  type: string
  properties: Record<string, AppActionToolProp>
  required: string[]
}

export interface AppActionToolProp {
  type: string
  description: string
  enum?: string[]
}

export interface AppActionToolCall {
  id: string
  type: string
  function: AppActionToolCallFunction
}

export interface AppActionToolCallFunction {
  name: string
  arguments: string
}

export interface AppActionResult {
  success: boolean
  message: string
  data?: Record<string, Object>
}

const APP_ACTION_SYSTEM_PROMPT = `你是 Livo 应用的操作助手，可以帮助用户完成应用中各种操作。

你可以使用以下工具（必须通过 function calling 调用）：
- list_subscriptions：查看用户所有订阅源
- list_builtin_feeds：查看应用内嵌的推荐订阅源
- add_subscription：添加新的订阅源
- add_builtin_subscription：从内嵌推荐列表添加订阅源
- remove_subscription：删除某个订阅源
- toggle_theme_mode：切换深色/浅色模式
- change_accent_color：调整主题色
- view_starred_entries：查看收藏内容
- view_chat_history：查看历史对话
- view_refresh_log：查看刷新日志
- get_unread_stats：获取未读统计
- mark_all_read：全部标记为已读

使用规则：
1. 使用中文回复
2. 当用户表达操作意图时，必须调用对应工具执行操作
3. 执行完成后，简洁地告知用户结果
4. 如果操作失败，说明原因并提供建议`

export function buildAppActionTools(): AppActionToolDefinition[] {
  return [
    {
      name: 'list_subscriptions',
      description: '查看用户所有已订阅的RSS源列表',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'list_builtin_feeds',
      description: '查看应用内嵌的推荐订阅源，可按分类查看',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: '分类名称', enum: ['articles', 'social', 'pictures', 'videos', 'ai', 'podcast', 'news', 'all'] }
        },
        required: []
      }
    },
    {
      name: 'add_subscription',
      description: '添加新的RSS订阅源到订阅列表',
      parameters: {
        type: 'object',
        properties: {
          url: { type: 'string', description: '订阅源的URL地址' },
          title: { type: 'string', description: '订阅源的名称（可选）' },
          category: { type: 'string', description: '订阅源的分类（可选）' }
        },
        required: ['url']
      }
    },
    {
      name: 'add_builtin_subscription',
      description: '从应用内嵌的推荐订阅源列表中添加到用户订阅',
      parameters: {
        type: 'object',
        properties: {
          feedTitle: { type: 'string', description: '要添加的内嵌订阅源名称' }
        },
        required: ['feedTitle']
      }
    },
    {
      name: 'remove_subscription',
      description: '从订阅列表中删除某个订阅源',
      parameters: {
        type: 'object',
        properties: {
          feedId: { type: 'string', description: '要删除的订阅源ID' }
        },
        required: ['feedId']
      }
    },
    {
      name: 'toggle_theme_mode',
      description: '切换应用的深色模式或浅色模式',
      parameters: {
        type: 'object',
        properties: {
          mode: { type: 'string', description: '主题模式', enum: ['dark', 'light', 'system'] }
        },
        required: ['mode']
      }
    },
    {
      name: 'change_accent_color',
      description: '调整应用的主题强调色',
      parameters: {
        type: 'object',
        properties: {
          color: { type: 'string', description: '强调色名称', enum: ['orange', 'blue', 'red', 'pink', 'green'] }
        },
        required: ['color']
      }
    },
    {
      name: 'view_starred_entries',
      description: '查看用户收藏的文章列表',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '返回收藏数量，默认20' }
        },
        required: []
      }
    },
    {
      name: 'view_chat_history',
      description: '查看用户之前的AI对话历史记录',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '返回历史记录数量，默认10' }
        },
        required: []
      }
    },
    {
      name: 'view_refresh_log',
      description: '查看最近刷新/同步日志',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: '返回日志条数，默认20' }
        },
        required: []
      }
    },
    {
      name: 'get_unread_stats',
      description: '获取未读文章的统计信息',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    },
    {
      name: 'mark_all_read',
      description: '将所有未读文章标记为已读',
      parameters: {
        type: 'object',
        properties: {},
        required: []
      }
    }
  ]
}

async function listSubscriptions(): Promise<AppActionResult> {
  try {
    const feeds = await FeedRepository.default.list()
    if (feeds.length === 0) {
      return { success: true, message: '当前没有任何订阅源' }
    }
    
    const feedList = feeds.map(f => {
      const viewNames = ['文章', '社交', '视频', '图片']
      const viewName = viewNames[f.view] || '未知'
      return `${f.title} (${f.category || viewName})`
    }).join('\n')
    
    return {
      success: true,
      message: `共订阅 ${feeds.length} 个源：\n${feedList}`,
      data: { count: feeds.length, feeds }
    }
  } catch (e) {
    return { success: false, message: `获取订阅列表失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function listBuiltinFeeds(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const category = args['category'] as string || 'all'
    let feeds: DiscoverBuiltinFeed[] = []
    
    if (category === 'all') {
      feeds = builtinDiscoverFeedsAll()
    } else {
      const viewMap: Record<string, FeedViewType> = {
        'articles': FeedViewType.Articles,
        'social': FeedViewType.SocialMedia,
        'pictures': FeedViewType.Pictures,
        'videos': FeedViewType.Videos,
      }
      const viewType = viewMap[category]
      if (viewType !== undefined) {
        feeds = builtinDiscoverFeedsByView(viewType)
      } else {
        // 对于 ai, podcast, news 等特殊分类
        feeds = builtinDiscoverFeedsAll().filter(f => {
          if (category === 'ai') return f.category.includes('AI')
          if (category === 'podcast') return f.category.includes('播客')
          if (category === 'news') return f.category.includes('新闻')
          return false
        })
      }
    }
    
    if (feeds.length === 0) {
      return { success: true, message: `暂无 ${category} 分类的推荐订阅源` }
    }
    
    const categoryNames: Record<string, string> = {
      'all': '全部',
      'articles': '文章',
      'social': '社交',
      'pictures': '图片',
      'videos': '视频',
      'ai': 'AI',
      'podcast': '播客',
      'news': '新闻'
    }
    
    const categoryName = categoryNames[category] || category
    const feedList = feeds.slice(0, 30).map((f, i) => {
      return `${i + 1}. ${f.title} - ${f.description.slice(0, 50)}...`
    }).join('\n')
    
    const totalText = feeds.length > 30 ? `（显示前30个，共${feeds.length}个）` : ''
    return {
      success: true,
      message: `推荐订阅源 - ${categoryName}分类 ${totalText}：\n\n${feedList}`,
      data: { count: feeds.length, feeds: feeds.slice(0, 30) }
    }
  } catch (e) {
    return { success: false, message: `获取推荐订阅源失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function addBuiltinSubscription(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const feedTitle = args['feedTitle'] as string
    if (!feedTitle) {
      return { success: false, message: '缺少订阅源名称参数' }
    }
    
    // 在所有内嵌订阅源中查找
    const allBuiltinFeeds = builtinDiscoverFeedsAll()
    const matchedFeed = allBuiltinFeeds.find(f => 
      f.title.toLowerCase().includes(feedTitle.toLowerCase()) ||
      feedTitle.toLowerCase().includes(f.title.toLowerCase())
    )
    
    if (!matchedFeed) {
      // 提供相似的建议
      const similarFeeds = allBuiltinFeeds.filter(f =>
        f.title.toLowerCase().includes(feedTitle.toLowerCase().slice(0, 3)) ||
        feedTitle.toLowerCase().includes(f.title.toLowerCase().slice(0, 3))
      ).slice(0, 5)
      
      let suggestionMsg = `未找到名为 "${feedTitle}" 的推荐订阅源。`
      if (similarFeeds.length > 0) {
        suggestionMsg += '\n\n您可能想要添加：\n'
        similarFeeds.forEach((f, i) => {
          suggestionMsg += `${i + 1}. ${f.title}\n`
        })
      }
      
      return { success: false, message: suggestionMsg }
    }
    
    // 检查是否已订阅
    const existingFeeds = await FeedRepository.default.list()
    const alreadySubscribed = existingFeeds.some(f => f.url === matchedFeed.url)
    if (alreadySubscribed) {
      return { success: false, message: `您已订阅 "${matchedFeed.title}"` }
    }
    
    // 添加到订阅
    const feed = await FeedRepository.default.create({
      url: matchedFeed.url,
      title: matchedFeed.title,
      category: matchedFeed.category,
      view: matchedFeed.view,
    })
    
    return {
      success: true,
      message: `✓ 成功添加推荐订阅源：${feed.title}\n分类：${feed.category}`,
      data: { feed }
    }
  } catch (e) {
    return { success: false, message: `添加推荐订阅源失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function addSubscription(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const url = args['url'] as string
    if (!url) {
      return { success: false, message: '缺少订阅源URL参数' }
    }
    
    const title = (args['title'] as string) || ''
    const category = (args['category'] as string) || ''
    
    // 检查是否已存在
    const existing = await FeedRepository.default.getByUrl(url)
    if (existing) {
      return { success: false, message: `该订阅源已存在: ${existing.title}` }
    }
    
    // 创建新订阅
    const feed = await FeedRepository.default.create({
      url,
      title: title || url,
      category,
      view: 0,
    })
    
    return {
      success: true,
      message: `成功添加订阅: ${feed.title}`,
      data: { feed }
    }
  } catch (e) {
    return { success: false, message: `添加订阅失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function removeSubscription(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const feedId = args['feedId'] as string
    if (!feedId) {
      return { success: false, message: '缺少订阅源ID参数' }
    }
    
    const feed = await FeedRepository.default.getById(feedId)
    if (!feed) {
      return { success: false, message: `未找到ID为 ${feedId} 的订阅源` }
    }
    
    await FeedRepository.default.remove(feedId)
    return { success: true, message: `已删除订阅: ${feed.title}` }
  } catch (e) {
    return { success: false, message: `删除订阅失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function toggleThemeMode(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const mode = args['mode'] as 'dark' | 'light' | 'system'
    if (!mode || !['dark', 'light', 'system'].includes(mode)) {
      return { success: false, message: '无效的主题模式，请使用 dark、light 或 system' }
    }
    
    const settings = await SettingsStore.default.load()
    settings.themeMode = mode
    await SettingsStore.default.save(settings)
    
    const modeNames = { dark: '深色模式', light: '浅色模式', system: '跟随系统' }
    return { success: true, message: `已切换到${modeNames[mode]}` }
  } catch (e) {
    return { success: false, message: `切换主题失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function changeAccentColor(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const color = args['color'] as 'orange' | 'blue' | 'red' | 'pink' | 'green'
    if (!color || !['orange', 'blue', 'red', 'pink', 'green'].includes(color)) {
      return { success: false, message: '无效的主题色，请使用 orange、blue、red、pink 或 green' }
    }
    
    const settings = await SettingsStore.default.load()
    settings.themeAccent = color
    await SettingsStore.default.save(settings)
    
    const colorNames = { orange: '橙色', blue: '蓝色', red: '红色', pink: '粉色', green: '绿色' }
    return { success: true, message: `主题色已更改为${colorNames[color]}` }
  } catch (e) {
    return { success: false, message: `更改主题色失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function viewStarredEntries(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const limitRaw = args['limit'] as number
    const limit = typeof limitRaw === 'number' ? Math.min(Math.max(1, limitRaw), 50) : 20
    
    const entries = await EntryRepository.default.listStarred(limit)
    if (entries.length === 0) {
      return { success: true, message: '暂无收藏内容' }
    }
    
    const entryList = entries.slice(0, limit).map((e, i) => {
      const published = new Date(e.publishedAt).toLocaleDateString()
      return `${i + 1}. ${e.title} (${published})`
    }).join('\n')
    
    return {
      success: true,
      message: `共收藏 ${entries.length} 篇文章，显示前 ${Math.min(limit, entries.length)} 篇：\n${entryList}`,
      data: { count: entries.length, entries }
    }
  } catch (e) {
    return { success: false, message: `获取收藏内容失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function viewChatHistory(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const limitRaw = args['limit'] as number
    const limit = typeof limitRaw === 'number' ? Math.min(Math.max(1, limitRaw), 50) : 10
    
    const sessions = await ChatHistoryStore.loadAll()
    if (sessions.length === 0) {
      return { success: true, message: '暂无历史对话' }
    }
    
    const historyList = sessions.slice(0, limit).map((s, i) => {
      const time = new Date(s.updatedAt).toLocaleString()
      return `${i + 1}. ${s.title} (${time})`
    }).join('\n')
    
    return {
      success: true,
      message: `共有 ${sessions.length} 段历史对话，显示前 ${Math.min(limit, sessions.length)} 段：\n${historyList}`,
      data: { count: sessions.length, sessions }
    }
  } catch (e) {
    return { success: false, message: `获取历史对话失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function viewRefreshLog(args: Record<string, Object>): Promise<AppActionResult> {
  try {
    const limitRaw = args['limit'] as number
    const limit = typeof limitRaw === 'number' ? Math.min(Math.max(1, limitRaw), 50) : 20
    
    // 获取最近更新的订阅源作为刷新日志
    const feeds = await FeedRepository.default.list()
    const recentFeeds = feeds
      .filter(f => f.lastFetched && f.lastFetched > 0)
      .sort((a, b) => (b.lastFetched || 0) - (a.lastFetched || 0))
      .slice(0, limit)
    
    if (recentFeeds.length === 0) {
      return { success: true, message: '暂无刷新记录' }
    }
    
    const logList = recentFeeds.map((f, i) => {
      const time = new Date(f.lastFetched!).toLocaleString()
      const status = f.errorCount && f.errorCount > 0 ? ` (错误${f.errorCount}次)` : ''
      return `${i + 1}. ${f.title} - ${time}${status}`
    }).join('\n')
    
    return {
      success: true,
      message: `最近刷新记录（显示前 ${recentFeeds.length} 条）：\n${logList}`,
      data: { feeds: recentFeeds }
    }
  } catch (e) {
    return { success: false, message: `获取刷新日志失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function getUnreadStats(): Promise<AppActionResult> {
  try {
    const totalUnread = await EntryRepository.default.countUnread()
    const starredCount = await EntryRepository.default.countStarred()
    
    const feeds = await FeedRepository.default.list()
    const feedUnreadList: { name: string, count: number }[] = []
    
    for (const feed of feeds) {
      const count = await EntryRepository.default.countUnreadByFeed(feed.id)
      if (count > 0) {
        feedUnreadList.push({ name: feed.title, count })
      }
    }
    
    let message = `未读统计：\n`
    message += `• 总未读: ${totalUnread} 篇\n`
    message += `• 已收藏: ${starredCount} 篇\n`
    
    if (feedUnreadList.length > 0) {
      message += '\n各订阅源未读：\n'
      feedUnreadList.forEach(f => {
        message += `• ${f.name}: ${f.count} 篇\n`
      })
    }
    
    return {
      success: true,
      message,
      data: { totalUnread, starredCount, feedUnreadList }
    }
  } catch (e) {
    return { success: false, message: `获取未读统计失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

async function markAllRead(): Promise<AppActionResult> {
  try {
    const feeds = await FeedRepository.default.list()
    let markedCount = 0
    
    for (const feed of feeds) {
      const entries = await EntryRepository.default.listByFeed(feed.id)
      for (const entry of entries) {
        if (!entry.isRead) {
          await EntryRepository.default.markRead(entry.id, true)
          markedCount++
        }
      }
    }
    
    return {
      success: true,
      message: `已将 ${markedCount} 篇文章标记为已读`
    }
  } catch (e) {
    return { success: false, message: `标记已读失败: ${e instanceof Error ? e.message : String(e)}` }
  }
}

export async function executeAppActionTool(name: string, args: string): Promise<AppActionResult> {
  let parsedArgs: Record<string, Object> = {}
  try {
    const raw = JSON.parse(args || '{}') as object
    parsedArgs = raw as Record<string, Object>
  } catch (_e) {
    // use empty args
  }
  
  switch (name) {
    case 'list_subscriptions':
      return listSubscriptions()
    case 'list_builtin_feeds':
      return listBuiltinFeeds(parsedArgs)
    case 'add_subscription':
      return addSubscription(parsedArgs)
    case 'add_builtin_subscription':
      return addBuiltinSubscription(parsedArgs)
    case 'remove_subscription':
      return removeSubscription(parsedArgs)
    case 'toggle_theme_mode':
      return toggleThemeMode(parsedArgs)
    case 'change_accent_color':
      return changeAccentColor(parsedArgs)
    case 'view_starred_entries':
      return viewStarredEntries(parsedArgs)
    case 'view_chat_history':
      return viewChatHistory(parsedArgs)
    case 'view_refresh_log':
      return viewRefreshLog(parsedArgs)
    case 'get_unread_stats':
      return getUnreadStats()
    case 'mark_all_read':
      return markAllRead()
    default:
      return { success: false, message: `未知工具: ${name}` }
  }
}

export interface AppActionAgentRound {
  name: string
  args: string
  result: AppActionResult
}

export interface AppActionAgentResult {
  text: string
  rounds: AppActionAgentRound[]
  executedActions: string[]
}

const MAX_APP_ACTION_ROUNDS = 3

export async function runAppActionAgent(
  prompt: string,
  history?: { role: string, content: string }[],
): Promise<AppActionAgentResult> {
  const rounds: AppActionAgentRound[] = []
  const executedActions: string[] = []
  
  // 构建消息列表
  const messages: { role: string, content: string, tool_calls?: any[] }[] = [
    { role: 'system', content: APP_ACTION_SYSTEM_PROMPT }
  ]
  
  if (history && history.length > 0) {
    for (const m of history) {
      messages.push({ role: m.role, content: m.content })
    }
  }
  
  messages.push({ role: 'user', content: prompt })
  
  // 这里简化实现，实际应调用LLM API
  // 由于HarmonyOS环境限制，我们使用规则匹配的方式
  const result = await executeAppActionByRules(prompt, messages, rounds, executedActions)
  
  return {
    text: result.text,
    rounds,
    executedActions
  }
}

// 基于规则的执行引擎（替代LLM function calling）
async function executeAppActionByRules(
  prompt: string,
  messages: { role: string, content: string }[],
  rounds: AppActionAgentRound[],
  executedActions: string[]
): Promise<{ text: string }> {
  const lowerPrompt = prompt.toLowerCase()
  
  // 订阅相关 - 查看用户订阅
  if (lowerPrompt.includes('订阅') && (lowerPrompt.includes('哪些') || lowerPrompt.includes('什么') || lowerPrompt.includes('列表')) && !lowerPrompt.includes('推荐') && !lowerPrompt.includes('内嵌') && !lowerPrompt.includes('内置')) {
    const result = await listSubscriptions()
    rounds.push({ name: 'list_subscriptions', args: '{}', result })
    executedActions.push('list_subscriptions')
    return { text: result.message }
  }
  
  // 查看推荐/内嵌订阅源
  if ((lowerPrompt.includes('推荐') || lowerPrompt.includes('内嵌') || lowerPrompt.includes('内置') || lowerPrompt.includes('discover')) && lowerPrompt.includes('订阅')) {
    // 解析分类
    let category = 'all'
    if (lowerPrompt.includes('文章') || lowerPrompt.includes('article')) category = 'articles'
    else if (lowerPrompt.includes('社交') || lowerPrompt.includes('social')) category = 'social'
    else if (lowerPrompt.includes('图片') || lowerPrompt.includes('picture')) category = 'pictures'
    else if (lowerPrompt.includes('视频') || lowerPrompt.includes('video')) category = 'videos'
    else if (lowerPrompt.includes('ai') || lowerPrompt.includes('人工智能')) category = 'ai'
    else if (lowerPrompt.includes('播客') || lowerPrompt.includes('podcast')) category = 'podcast'
    else if (lowerPrompt.includes('新闻') || lowerPrompt.includes('news')) category = 'news'
    
    const result = await listBuiltinFeeds({ category })
    rounds.push({ name: 'list_builtin_feeds', args: JSON.stringify({ category }), result })
    executedActions.push('list_builtin_feeds')
    return { text: result.message }
  }
  
  // 添加订阅 - 从推荐列表
  if (lowerPrompt.includes('添加') && lowerPrompt.includes('订阅') && (lowerPrompt.includes('推荐') || lowerPrompt.includes('这个') || lowerPrompt.includes('那个'))) {
    // 提取订阅源名称
    const titleMatch = prompt.match(/[""](.*?)["']/) || prompt.match(/添加\s+(.+)/)
    if (titleMatch) {
      const feedTitle = titleMatch[1]
      const result = await addBuiltinSubscription({ feedTitle })
      rounds.push({ name: 'add_builtin_subscription', args: JSON.stringify({ feedTitle }), result })
      executedActions.push('add_builtin_subscription')
      return { text: result.message }
    }
    return { text: '请提供要添加的推荐订阅源名称，例如："添加 阮一峰的网络日志"' }
  }
  
  // 添加订阅 - 自定义URL
  if (lowerPrompt.includes('添加') && lowerPrompt.includes('订阅') && lowerPrompt.includes('http')) {
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/)
    if (urlMatch) {
      const url = urlMatch[0]
      const titleMatch = prompt.match(/[""](.*?)["']/)
      const title = titleMatch ? titleMatch[1] : ''
      const result = await addSubscription({ url, title })
      rounds.push({ name: 'add_subscription', args: JSON.stringify({ url, title }), result })
      executedActions.push('add_subscription')
      return { text: result.message }
    }
  }
  
  if (lowerPrompt.includes('添加') && lowerPrompt.includes('订阅')) {
    const urlMatch = prompt.match(/https?:\/\/[^\s]+/)
    if (urlMatch) {
      const url = urlMatch[0]
      const titleMatch = prompt.match(/[""](.*?)["']/)
      const title = titleMatch ? titleMatch[1] : ''
      const result = await addSubscription({ url, title })
      rounds.push({ name: 'add_subscription', args: JSON.stringify({ url, title }), result })
      executedActions.push('add_subscription')
      return { text: result.message }
    }
    return { text: '请提供要添加的订阅源URL地址，或者查看推荐订阅源列表' }
  }
  
  if (lowerPrompt.includes('删除') && lowerPrompt.includes('订阅')) {
    return { text: '请提供要删除的订阅源名称或ID' }
  }
  
  // 主题相关
  if (lowerPrompt.includes('深色') || lowerPrompt.includes('dark')) {
    const result = await toggleThemeMode({ mode: 'dark' })
    rounds.push({ name: 'toggle_theme_mode', args: JSON.stringify({ mode: 'dark' }), result })
    executedActions.push('toggle_theme_mode')
    return { text: result.message }
  }
  
  if (lowerPrompt.includes('浅色') || lowerPrompt.includes('light')) {
    const result = await toggleThemeMode({ mode: 'light' })
    rounds.push({ name: 'toggle_theme_mode', args: JSON.stringify({ mode: 'light' }), result })
    executedActions.push('toggle_theme_mode')
    return { text: result.message }
  }
  
  if (lowerPrompt.includes('主题色') || lowerPrompt.includes('颜色')) {
    const colorMap: Record<string, string> = {
      '蓝色': 'blue', '红': 'red', '粉': 'pink', '绿': 'green', '橙': 'orange'
    }
    for (const [cn, en] of Object.entries(colorMap)) {
      if (lowerPrompt.includes(cn)) {
        const result = await changeAccentColor({ color: en as any })
        rounds.push({ name: 'change_accent_color', args: JSON.stringify({ color: en }), result })
        executedActions.push('change_accent_color')
        return { text: result.message }
      }
    }
    return { text: '请选择主题色：橙色、蓝色、红色、粉色或绿色' }
  }
  
  // 收藏相关
  if (lowerPrompt.includes('收藏')) {
    const result = await viewStarredEntries({})
    rounds.push({ name: 'view_starred_entries', args: '{}', result })
    executedActions.push('view_starred_entries')
    return { text: result.message }
  }
  
  // 历史对话
  if (lowerPrompt.includes('历史') && lowerPrompt.includes('对话')) {
    const result = await viewChatHistory({})
    rounds.push({ name: 'view_chat_history', args: '{}', result })
    executedActions.push('view_chat_history')
    return { text: result.message }
  }
  
  // 刷新日志
  if (lowerPrompt.includes('刷新') && (lowerPrompt.includes('日志') || lowerPrompt.includes('记录'))) {
    const result = await viewRefreshLog({})
    rounds.push({ name: 'view_refresh_log', args: '{}', result })
    executedActions.push('view_refresh_log')
    return { text: result.message }
  }
  
  // 未读统计
  if (lowerPrompt.includes('未读') || lowerPrompt.includes('统计')) {
    const result = await getUnreadStats()
    rounds.push({ name: 'get_unread_stats', args: '{}', result })
    executedActions.push('get_unread_stats')
    return { text: result.message }
  }
  
  // 全部标记已读
  if (lowerPrompt.includes('全部') && lowerPrompt.includes('已读')) {
    const result = await markAllRead()
    rounds.push({ name: 'mark_all_read', args: '{}', result })
    executedActions.push('mark_all_read')
    return { text: result.message }
  }
  
  return { text: '抱歉，我还不太理解您的需求。您可以尝试：\n• 查看订阅 / 查看推荐订阅源\n• 添加订阅 / 添加推荐订阅\n• 切换深色/浅色模式\n• 查看收藏 / 查看历史对话\n• 查看未读统计 / 全部标记已读' }
}
