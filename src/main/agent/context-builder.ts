import { isAgentCapabilityAllowed } from '../../shared/types'
import type { AgentPermissionSettings } from '../../shared/types'
import { getDb } from '../database'

const VIEW_NAMES = ['文章', '社交', '视频', '图片']

/**
 * Builds a textual snapshot of the user's subscriptions / today's updates /
 * unread total, prepended to the system prompt. Acts as a fallback for models
 * that don't support function calling, and grounds models that do. Gated by the
 * agent's read permission.
 */
export function buildContextFallback(
  pageContext = '',
  permissions?: AgentPermissionSettings,
): string {
  if (!isAgentCapabilityAllowed('read', permissions)) {
    return '当前 Agent 权限未允许读取本地订阅上下文。'
  }

  let ctx = ''
  const trimmedPageContext = pageContext.trim()
  if (trimmedPageContext) {
    ctx += `当前页面上下文：\n${trimmedPageContext}\n\n`
  }

  try {
    const feeds = getDb().feeds.getAllFeeds()
    if (feeds.length === 0) {
      return `${ctx}当前没有任何订阅源。`.trim()
    }
    ctx += `用户订阅了 ${feeds.length} 个源：\n`
    for (const f of feeds) {
      const viewName = VIEW_NAMES[f.view] ?? '未知'
      ctx += `- ${f.title} [${f.category || viewName}] (ID: ${f.id})\n`
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()
    const { entries } = getDb().entries.getEntries({ limit: 30 })
    const todayEntries = entries.filter((e) => e.publishedAt >= todayMs)
    if (todayEntries.length > 0) {
      const feedMap = new Map(feeds.map((f) => [f.id, f.title]))
      ctx += `\n今天更新的文章 (${todayEntries.length} 篇)：\n`
      todayEntries.forEach((e, i) => {
        const feedName = feedMap.get(e.feedId) ?? e.feedId
        ctx += `[${i + 1}] ${e.title} (来自: ${feedName}) - ${new Date(e.publishedAt).toLocaleString()}\n`
        if (e.summary) ctx += `  摘要: ${e.summary.slice(0, 150)}\n`
      })
    }

    const stats = getDb().maintenance.getDatabaseStats()
    const unread = Math.max(0, stats.totalEntries - stats.readEntries)
    ctx += `\n未读文章总计: ${unread} 篇`
  } catch {
    return `${ctx}无法获取订阅数据。`.trim()
  }

  return ctx.trim()
}
