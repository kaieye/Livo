import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import { ChatHistoryStore } from '../../../services/ChatHistoryStore'
import type { ChatSession } from '../../../services/ChatHistoryStore'
import { RefreshLogStore } from '../../../services/RefreshLogStore'
import type { RefreshLogEntry } from '../../../models/LivoModels'
import { FeaturedEntriesQuery } from '../../../data/FeaturedEntriesQuery'
import { DiscoverAvatarCacheStore } from '../../../services/DiscoverAvatarCacheStore'
import { HomeEntrySnapshotStore } from '../../../services/HomeEntrySnapshotStore'
import {
  OPML_IMPORT_AUTO_REFRESH_LIMIT,
  OPML_IMPORT_LARGE_BATCH_HINT,
  SubscriptionOpmlService,
} from '../../../services/SubscriptionOpmlService'
import type {
  SubscriptionOpmlImportMode,
  SubscriptionOpmlImportResult,
  SubscriptionOpmlRefreshResult,
} from '../../../services/SubscriptionOpmlService'

function emptyParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function limitParams(defaultDescription: string): AgentToolInputSchema {
  const limitParam: AgentToolParamSchema = { type: 'number', description: defaultDescription }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['limit'] = limitParam
  const required: string[] = []
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function importOpmlParams(): AgentToolInputSchema {
  const modeParam: AgentToolParamSchema = {
    type: 'string',
    description: '导入模式：merge 合并导入，overwrite 覆盖当前订阅',
    enum: ['merge', 'overwrite'],
  }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['mode'] = modeParam
  const required: string[] = ['mode']
  return {
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  }
}

function importResultMessage(result: SubscriptionOpmlImportResult, refreshResult?: SubscriptionOpmlRefreshResult): string {
  if (result.status === 'cancelled') {
    return '已取消 OPML 导入'
  }
  if (result.status === 'empty') {
    return 'OPML 文件中未发现可导入订阅'
  }

  let message = `导入完成：新增 ${result.imported}，跳过 ${result.skipped}，失败 ${result.failed}`
  if (result.importedFeedIds.length > OPML_IMPORT_AUTO_REFRESH_LIMIT) {
    message += `\n${OPML_IMPORT_LARGE_BATCH_HINT}`
    return message
  }
  if (refreshResult && refreshResult.total > 0) {
    const failedSuffix = refreshResult.failed > 0 ? `，失败 ${refreshResult.failed}` : ''
    message += `\n后台同步完成：成功 ${refreshResult.success}/${refreshResult.total}${failedSuffix}`
  }
  return message
}

export function buildViewChatHistoryTool(): AgentTool {
  return {
    name: 'view_chat_history',
    title: '查看历史对话',
    description: '查看用户之前的 AI 对话历史记录',
    inputSchema: limitParams('返回历史记录数量，默认10，最大50'),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const limitRaw = args['limit'] as number
      const limit = typeof limitRaw === 'number' ? Math.min(Math.max(1, limitRaw), 50) : 10
      const sessions = await ChatHistoryStore.loadAll()
      if (sessions.length === 0) {
        return { status: 'success', message: '暂无历史对话' }
      }

      const displaySessions = sessions.slice(0, limit)
      let lines = ''
      for (let i = 0; i < displaySessions.length; i += 1) {
        const session: ChatSession = displaySessions[i]
        const time = new Date(session.updatedAt).toLocaleString()
        lines += `${i + 1}. ${session.title} (${time})\n`
      }

      return {
        status: 'success',
        message: `共有 ${sessions.length} 段历史对话，显示前 ${displaySessions.length} 段：\n${lines}`,
        data: { count: sessions.length, sessions: displaySessions },
      }
    },
  }
}

export function buildViewRefreshLogTool(): AgentTool {
  return {
    name: 'view_refresh_log',
    title: '查看刷新日志',
    description: '查看最近刷新或同步日志',
    inputSchema: limitParams('返回日志条数，默认20，最大50'),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const limitRaw = args['limit'] as number
      const limit = typeof limitRaw === 'number' ? Math.min(Math.max(1, limitRaw), 50) : 20
      const logs = await RefreshLogStore.default.load()
      if (logs.length === 0) {
        return { status: 'success', message: '暂无刷新记录' }
      }

      const displayLogs = logs.slice(0, limit)
      let lines = ''
      for (let i = 0; i < displayLogs.length; i += 1) {
        const log: RefreshLogEntry = displayLogs[i]
        const time = new Date(log.refreshedAt).toLocaleString()
        const failed = log.failedFeedCount > 0 ? `，失败 ${log.failedFeedCount} 个` : ''
        lines += `${i + 1}. ${time} - 成功 ${log.successFeedCount} 个${failed}\n`
      }

      return {
        status: 'success',
        message: `最近刷新记录（显示前 ${displayLogs.length} 条）：\n${lines}`,
        data: { count: logs.length, logs: displayLogs },
      }
    },
  }
}

export function buildExportOpmlTool(): AgentTool {
  return {
    name: 'export_opml',
    title: '导出 OPML',
    description: '导出当前订阅源到用户选择的 OPML 文件。涉及本地数据导出，执行前需要确认',
    inputSchema: emptyParams(),
    capability: 'external',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认导出 OPML',
    confirmationMessage: '将把当前订阅列表写入你选择的 OPML 文件，不会导出文章正文或 API Key。',
    execute: async (): Promise<AgentToolResult> => {
      console.info('[DataAgent] export_opml')
      const result = await SubscriptionOpmlService.exportToFile()
      if (result.status === 'cancelled') {
        return { status: 'success', message: '已取消 OPML 导出', data: { result } }
      }
      return {
        status: 'success',
        message: `OPML 导出完成，共 ${result.feedCount} 条订阅`,
        data: { result },
      }
    },
  }
}

export function buildImportOpmlTool(): AgentTool {
  return {
    name: 'import_opml',
    title: '导入 OPML',
    description: '从用户选择的 OPML 文件导入订阅。merge 会合并，overwrite 会先删除当前订阅再导入',
    inputSchema: importOpmlParams(),
    capability: 'destructive',
    risk: 'high',
    requiresConfirmation: true,
    confirmationTitle: '确认导入 OPML',
    confirmationMessage: '覆盖导入会删除当前订阅和本地文章后再导入；合并导入也会写入本地订阅数据。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const mode = args['mode'] as SubscriptionOpmlImportMode
      console.info('[DataAgent] import_opml mode:', mode)
      const result = await SubscriptionOpmlService.importFromFile(mode)
      let refreshResult: SubscriptionOpmlRefreshResult | undefined = undefined
      if (result.status === 'success' && result.importedFeedIds.length > 0 && result.importedFeedIds.length <= OPML_IMPORT_AUTO_REFRESH_LIMIT) {
        refreshResult = await SubscriptionOpmlService.refreshImportedFeedsInBackground(result.importedFeedIds)
      }
      return {
        status: result.status === 'success' ? 'success' : 'failed',
        message: importResultMessage(result, refreshResult),
        data: { result, refreshResult: refreshResult as Object },
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
    confirmationMessage: '将删除本地刷新日志记录，但不会删除订阅源、文章或账号信息。',
    execute: async (): Promise<AgentToolResult> => {
      const logs = await RefreshLogStore.default.load()
      console.info('[DataAgent] clear_refresh_log count:', logs.length)
      await RefreshLogStore.default.clear()
      return {
        status: 'success',
        message: `已清空 ${logs.length} 条刷新日志`,
        data: { cleared: logs.length },
      }
    },
  }
}

export function buildClearLocalCacheTool(): AgentTool {
  return {
    name: 'clear_local_cache',
    title: '清理本地缓存',
    description: '清理首页快照、发现页头像缓存和首页查询内存缓存，不删除订阅源、文章、账号或 AI 配置',
    inputSchema: emptyParams(),
    capability: 'destructive',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认清理本地缓存',
    confirmationMessage: '将清理首页快照、发现页头像缓存和首页查询内存缓存；不会删除订阅源、文章、账号或 AI 配置。',
    execute: async (): Promise<AgentToolResult> => {
      const snapshotEntries = await HomeEntrySnapshotStore.default.load()
      const avatarEntries = await DiscoverAvatarCacheStore.load()
      console.info('[DataAgent] clear_local_cache snapshots:', snapshotEntries.length, 'avatars:', avatarEntries.length)
      await HomeEntrySnapshotStore.default.save([])
      await DiscoverAvatarCacheStore.save([])
      FeaturedEntriesQuery.default.clearModeEntriesCache()
      return {
        status: 'success',
        message: `已清理本地缓存：首页快照 ${snapshotEntries.length} 条，头像缓存 ${avatarEntries.length} 条`,
        data: {
          clearedHomeSnapshots: snapshotEntries.length,
          clearedAvatarCache: avatarEntries.length,
        },
      }
    },
  }
}
