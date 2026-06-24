import { isAgentCapabilityAllowed } from '../../shared/types'
import type { AgentPermissionSettings } from '../../shared/types'
import { getDb } from '../database'
import { AgentMemoryStore } from './agent-memory'

const VIEW_NAMES = ['文章', '社交', '视频', '图片']
const MAX_PAGE_CONTEXT_CHARS = 6000
const MAX_FEEDS_IN_FALLBACK = 80
const MAX_TODAY_ENTRIES_IN_FALLBACK = 20
const MAX_TITLE_CHARS = 160
const MAX_SUMMARY_CHARS = 180
const MAX_CONTEXT_FALLBACK_CHARS = 16000

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
  const trimmedPageContext = truncateText(pageContext, MAX_PAGE_CONTEXT_CHARS)
  if (trimmedPageContext) {
    ctx += `当前页面上下文：\n${trimmedPageContext}\n\n`
  }
  const memoryContext = AgentMemoryStore.contextSnippet()
  if (memoryContext) {
    ctx += `${memoryContext}\n\n`
  }

  try {
    const feeds = getDb().feeds.getAllFeeds()
    if (feeds.length === 0) {
      return trimContextFallback(`${ctx}当前没有任何订阅源。`)
    }
    ctx += `用户订阅了 ${feeds.length} 个源：\n`
    const listedFeeds = feeds.slice(0, MAX_FEEDS_IN_FALLBACK)
    for (const f of listedFeeds) {
      const viewName = VIEW_NAMES[f.view] ?? '未知'
      ctx += `- ${truncateText(f.title, MAX_TITLE_CHARS)} [${truncateText(f.category || viewName, MAX_TITLE_CHARS)}] (ID: ${f.id})\n`
    }
    if (feeds.length > listedFeeds.length) {
      ctx += `...还有 ${feeds.length - listedFeeds.length} 个源未列出，可调用 list_subscribed_feeds 获取完整列表。\n`
    }

    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)
    const todayMs = todayStart.getTime()
    const { entries } = getDb().entries.getEntries({
      limit: 50,
      compact: true,
      maxContentLength: 600,
    })
    const todayEntries = entries.filter((e) => e.publishedAt >= todayMs)
    if (todayEntries.length > 0) {
      const feedMap = new Map(feeds.map((f) => [f.id, f.title]))
      ctx += `\n今天更新的文章 (${todayEntries.length} 篇)：\n`
      todayEntries.slice(0, MAX_TODAY_ENTRIES_IN_FALLBACK).forEach((e, i) => {
        const feedName = feedMap.get(e.feedId) ?? e.feedId
        ctx += `[${i + 1}] ${truncateText(e.title, MAX_TITLE_CHARS)} (来自: ${truncateText(feedName, MAX_TITLE_CHARS)}) - ${new Date(e.publishedAt).toLocaleString()}\n`
        if (e.summary) {
          ctx += `  摘要: ${truncateText(e.summary, MAX_SUMMARY_CHARS)}\n`
        }
      })
      if (todayEntries.length > MAX_TODAY_ENTRIES_IN_FALLBACK) {
        ctx += `...还有 ${todayEntries.length - MAX_TODAY_ENTRIES_IN_FALLBACK} 篇今日文章未列出，可调用 get_today_updates 获取更多。\n`
      }
    }

    const stats = getDb().maintenance.getDatabaseStats()
    const unread = Math.max(0, stats.totalEntries - stats.readEntries)
    ctx += `\n未读文章总计: ${unread} 篇`
  } catch {
    return trimContextFallback(`${ctx}无法获取订阅数据。`)
  }

  return trimContextFallback(ctx)
}

/**
 * Builds the small context injected for providers that can call tools. The
 * detailed feed and entry lists remain available through get_session_overview.
 */
export function buildCompactContextFallback(
  pageContext = '',
  permissions?: AgentPermissionSettings,
): string {
  if (!isAgentCapabilityAllowed('read', permissions)) {
    return '当前 Agent 权限未允许读取本地订阅上下文。'
  }

  let ctx = ''
  const trimmedPageContext = truncateText(pageContext, MAX_PAGE_CONTEXT_CHARS)
  if (trimmedPageContext) {
    ctx += `当前页面上下文：\n${trimmedPageContext}\n\n`
  }
  const memoryContext = AgentMemoryStore.contextSnippet()
  if (memoryContext) {
    ctx += `${memoryContext}\n\n`
  }

  try {
    const feeds = getDb().feeds.getAllFeeds()
    const stats = getDb().maintenance.getDatabaseStats()
    const unread = Math.max(0, stats.totalEntries - stats.readEntries)
    ctx += [
      `订阅源总数: ${feeds.length}`,
      `文章总数: ${stats.totalEntries}`,
      `未读文章总计: ${unread}`,
      '如需完整订阅列表、今日更新或文章详情，请调用 get_session_overview 或其他读取工具。',
    ].join('\n')
  } catch {
    ctx += '无法获取订阅统计；如需数据请调用读取工具。'
  }

  return trimContextFallback(ctx)
}

function truncateText(value: string | undefined, maxChars: number): string {
  const text = (value || '').trim()
  if (text.length <= maxChars) return text
  return `${text.slice(0, maxChars)}...(已截断，原始长度 ${text.length} 字)`
}

function trimContextFallback(value: string): string {
  const text = value.trim()
  if (text.length <= MAX_CONTEXT_FALLBACK_CHARS) return text
  return `${text.slice(0, MAX_CONTEXT_FALLBACK_CHARS)}\n\n...(上下文已截断，原始长度 ${text.length} 字；可通过工具查询完整数据)`
}
