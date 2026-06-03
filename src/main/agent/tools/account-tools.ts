import type {
  AccountProvider,
  AgentTool,
  AgentToolArgs,
  AgentToolResult,
} from '../../../shared/types'
import {
  getAccountState,
  linkAccount,
  unlinkAccount,
} from '../../services/account/account-auth'
import { emptyParams, objectParams } from './schema'
import { defineReadTool } from './factories'

const PROVIDER_VALUES: AccountProvider[] = [
  'youtube',
  'x',
  'instagram',
  'bilibili',
]
const PROVIDER_LABELS: Record<AccountProvider, string> = {
  youtube: 'YouTube',
  x: 'X',
  instagram: 'Instagram',
  bilibili: 'Bilibili',
}

function providerParams(description: string) {
  return objectParams(
    { provider: { type: 'string', description, enum: PROVIDER_VALUES } },
    ['provider'],
  )
}

function statusLine(
  provider: AccountProvider,
  linked: boolean,
  displayName?: string | null,
  error?: string,
): string {
  const label = PROVIDER_LABELS[provider]
  if (linked)
    return `• ${label}: 已关联${displayName ? `（${displayName}）` : ''}`
  if (error) return `• ${label}: 未关联（${error}）`
  return `• ${label}: 未关联`
}

export function buildListAccountProvidersTool(): AgentTool {
  return defineReadTool({
    name: 'list_account_providers',
    title: '查看账号关联',
    description:
      '查看 YouTube、X、Instagram、Bilibili 等账号关联状态，不返回 cookie 或 token',
    inputSchema: emptyParams(),
    execute: async (): Promise<AgentToolResult> => {
      const statuses = await Promise.all(
        PROVIDER_VALUES.map((p) => getAccountState(p)),
      )
      const lines = statuses
        .map((s) => statusLine(s.provider, s.linked, s.displayName, s.error))
        .join('\n')
      return {
        status: 'success',
        message: `账号关联状态：\n${lines}`,
        data: { statuses: statuses as unknown as object },
      }
    },
  })
}

export function buildRefreshAccountStatusTool(): AgentTool {
  return defineReadTool({
    name: 'refresh_account_status',
    title: '刷新账号状态',
    description: '刷新指定平台的账号关联状态，不返回 cookie 或 token',
    inputSchema: providerParams('要刷新的平台'),
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const provider = args['provider'] as AccountProvider
      const status = await getAccountState(provider)
      return {
        status: status.error ? 'failed' : 'success',
        message: statusLine(
          provider,
          status.linked,
          status.displayName,
          status.error,
        ),
        data: { status: status as unknown as object },
      }
    },
  })
}

export function buildOpenAccountLoginTool(): AgentTool {
  return {
    name: 'open_account_login',
    title: '打开账号登录',
    description:
      '打开指定平台的账号关联登录窗口。涉及外部登录页，执行前需要确认',
    inputSchema: providerParams('要登录的平台'),
    capability: 'external',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认打开账号登录页',
    confirmationMessage:
      '将打开外部平台登录/关联窗口，登录过程由对应平台页面处理。',
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const provider = args['provider'] as AccountProvider
      const label = PROVIDER_LABELS[provider]
      const result = await linkAccount(provider)
      if (!result.success) {
        return {
          status: 'failed',
          message: `${label} 关联未完成：${result.error || '未检测到登录'}`,
        }
      }
      return {
        status: 'success',
        message: `已完成 ${label} 账号关联`,
        data: { provider },
      }
    },
  }
}

export function buildUnlinkAccountTool(): AgentTool {
  return {
    name: 'unlink_account',
    title: '取消账号关联',
    description: '取消指定平台的账号关联，清除本地保存的登录 cookie',
    inputSchema: providerParams('要取消关联的平台'),
    capability: 'destructive',
    risk: 'high',
    requiresConfirmation: true,
    confirmationTitle: '确认取消账号关联',
    confirmationMessage: '将清除该平台在本地保存的登录会话 cookie。',
    execute: async (
      _context,
      args: AgentToolArgs,
    ): Promise<AgentToolResult> => {
      const provider = args['provider'] as AccountProvider
      const label = PROVIDER_LABELS[provider]
      const before = await getAccountState(provider)
      if (!before.linked) {
        return {
          status: 'success',
          message: `${label} 当前未关联，无需取消。`,
          data: { provider, linked: false },
        }
      }
      const result = await unlinkAccount(provider)
      if (!result.success) {
        return {
          status: 'failed',
          message: result.error || `取消 ${label} 关联失败`,
        }
      }
      return {
        status: 'success',
        message: `已取消 ${label} 账号关联`,
        data: { provider },
      }
    },
  }
}
