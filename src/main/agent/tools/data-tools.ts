import type {
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
} from '../../../shared/types'
import { getDb } from '../../database'
import { exportOPML } from '../../operations/data-operations'
import { throwIfAgentToolAborted } from '../tool-runtime'
import {
  loadRefreshLogs,
  clearRefreshLogs,
} from '../../services/system/refresh-log-store'
import { clampLimit, emptyParams, limitParams, objectParams } from './schema'
import { defineReadTool } from './factories'

export function buildViewRefreshLogTool(): AgentTool {
  return defineReadTool({
    name: 'view_refresh_log',
    title: '查看刷新日志',
    description: '查看最近的订阅刷新历史记录',
    inputSchema: limitParams('返回日志条数，默认20，最大50'),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const limit = clampLimit(args['limit'], 20, 50)
      const logs = loadRefreshLogs()
      if (logs.length === 0) {
        return { status: 'success', message: '暂无刷新记录' }
      }
      const display = logs.slice(0, limit)
      let lines = ''
      display.forEach((log, i) => {
        const time = new Date(log.refreshedAt).toLocaleString()
        const failed =
          log.failedFeedCount > 0 ? `，失败 ${log.failedFeedCount} 个` : ''
        lines += `${i + 1}. ${time} - 成功 ${log.successFeedCount} 个${failed}\n`
      })
      return {
        status: 'success',
        message: `最近刷新记录（显示前 ${display.length} 条）：\n${lines}`,
        data: { count: logs.length, logs: display as unknown as object },
      }
    },
  })
}

export function buildExportOpmlTool(): AgentTool {
  return {
    name: 'export_opml',
    title: '导出 OPML',
    description:
      '导出当前订阅源到用户选择的 OPML 文件。涉及本地数据导出，执行前需要确认',
    inputSchema: emptyParams(),
    capability: 'external',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认导出 OPML',
    confirmationMessage:
      '将把当前订阅列表写入你选择的 OPML 文件，不会导出文章正文或 API Key。',
    execute: async (context): Promise<AgentToolResult> => {
      const result = await exportOPML({ signal: context.signal })
      if (!result.success) {
        if (result.cancelled)
          return { status: 'success', message: '已取消 OPML 导出' }
        return {
          status: 'failed',
          message: `OPML 导出失败：${result.error ?? '未知错误'}`,
        }
      }
      return {
        status: 'success',
        message: `OPML 导出完成，共 ${result.feedCount} 条订阅`,
        data: {
          feedCount: result.feedCount,
          ...(result.filePath ? { filePath: result.filePath } : {}),
        },
      }
    },
  }
}

export function buildClearRefreshLogTool(): AgentTool {
  return {
    name: 'clear_refresh_log',
    title: '清空刷新日志',
    description: '清空本地保存的刷新日志，不会删除订阅源或文章',
    inputSchema: emptyParams(),
    capability: 'destructive',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认清空刷新日志',
    confirmationMessage:
      '将删除本地刷新日志记录，但不会删除订阅源、文章或账号信息。',
    execute: async (): Promise<AgentToolResult> => {
      const count = loadRefreshLogs().length
      clearRefreshLogs()
      return {
        status: 'success',
        message: `已清空 ${count} 条刷新日志`,
        data: { cleared: count },
      }
    },
  }
}

export function buildCleanupOldEntriesTool(): AgentTool {
  return {
    name: 'cleanup_old_entries',
    title: '清理旧文章',
    description:
      '按每源保留数量和最大保留天数清理本地旧文章（不影响收藏文章、订阅源和账号）',
    inputSchema: objectParams({
      entriesPerFeed: {
        type: 'number',
        description: '每个订阅源保留的最新文章数量，默认 128',
        minimum: 1,
        maximum: 10000,
      },
      maxEntryAgeDays: {
        type: 'number',
        description: '超过该天数的文章会被清理，默认 90',
        minimum: 1,
        maximum: 3650,
      },
    }),
    capability: 'destructive',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认清理旧文章',
    confirmationMessage:
      '将删除超出保留范围的本地旧文章（收藏文章会保留），不可撤销。',
    execute: async (context, args: AgentToolArgs): Promise<AgentToolResult> => {
      throwIfAgentToolAborted(context.signal)
      const entriesPerFeed =
        typeof args['entriesPerFeed'] === 'number'
          ? Math.max(1, Math.floor(args['entriesPerFeed'] as number))
          : 128
      const maxEntryAgeDays =
        typeof args['maxEntryAgeDays'] === 'number'
          ? Math.max(1, Math.floor(args['maxEntryAgeDays'] as number))
          : 90
      const stats = getDb().maintenance.cleanupEntries(
        {
          entriesPerFeed,
          maxEntryAgeDays,
        },
        { signal: context.signal },
      )
      throwIfAgentToolAborted(context.signal)
      return {
        status: 'success',
        message: `清理完成：移除 ${stats.removed} 篇旧文章（按数量上限 ${stats.removedByCap}，按时间 ${stats.removedByAge}）`,
        data: { stats: stats as unknown as object },
      }
    },
  }
}
