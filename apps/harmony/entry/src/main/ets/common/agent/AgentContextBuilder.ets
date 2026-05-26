import { isAgentCapabilityAllowed } from './AgentTypes.ts'
import type { AgentPermissionSettings } from './AgentTypes.ts'
import { FeedRepository } from '../repositories/FeedRepository'
import { EntryRepository } from '../repositories/EntryRepository'
import { Feed, Entry } from '../models/LivoModels'

export async function buildContextFallback(
  pageContext: string = '',
  permissions?: AgentPermissionSettings,
): Promise<string> {
  if (!isAgentCapabilityAllowed('read', permissions)) {
    return '当前 Agent 权限未允许读取本地订阅上下文。'
  }

  let ctx = ''
  const trimmedPageContext = pageContext.trim()
  if (trimmedPageContext) {
    ctx += `当前页面上下文：\n${trimmedPageContext}\n\n`
  }
  try {
    const feeds = await FeedRepository.default.list()
    if (feeds.length === 0) {
      return '当前没有任何订阅源。'
    }
    ctx += `用户订阅了 ${feeds.length} 个源：\n`
    for (const f of feeds) {
      const viewNames = ['文章', '社交', '视频', '图片']
      const vn = viewNames[f.view] ?? '未知'
      ctx += `- ${f.title} [${f.category || vn}] (ID: ${f.id})\n`
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayMs = today.getTime()
    const entries = await EntryRepository.default.listRecent(30)
    const todayEntries: Entry[] = []
    for (const e of entries) {
      if (e.publishedAt >= todayMs) {
        todayEntries.push(e)
      }
    }
    if (todayEntries.length > 0) {
      ctx += `\n今天更新的文章 (${todayEntries.length} 篇)：\n`
      const feedMap = new Map<string, string>()
      for (const f of feeds) {
        feedMap.set(f.id, f.title)
      }
      for (let i = 0; i < todayEntries.length; i += 1) {
        const e = todayEntries[i]
        const fn = feedMap.get(e.feedId) ?? e.feedId
        ctx += `[${i + 1}] ${e.title} (来自: ${fn}) - ${new Date(e.publishedAt).toLocaleString()}\n`
        if (e.summary) {
          const s = e.summary.slice(0, 150)
          ctx += `  摘要: ${s}\n`
        }
      }
    }

    const unread = await EntryRepository.default.countUnread()
    ctx += `\n未读文章总计: ${unread} 篇`
  } catch (_e) {
    ctx = '无法获取订阅数据。'
  }
  return ctx
}
