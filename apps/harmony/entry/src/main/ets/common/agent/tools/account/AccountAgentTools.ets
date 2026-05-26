import type {
  AgentTool,
  AgentToolArgs,
  AgentToolInputSchema,
  AgentToolParamSchema,
  AgentToolResult,
} from '../../AgentTypes.ts'
import type { AccountProvider, AccountStatusResult } from '../../../models/LivoModels'
import { openAccountLogin } from '../../../navigation/AppRouter'
import { AccountSessionService } from '../../../services/AccountSessionService'
import {
  accountProviderTitle,
  listAccountProviderDefinitions,
} from '../../../utils/account/AccountProviderCatalog'

const ACCOUNT_PROVIDER_VALUES: string[] = ['youtube', 'x', 'instagram', 'bilibili']

function emptyParams(): AgentToolInputSchema {
  const properties: Record<string, AgentToolParamSchema> = {}
  const required: string[] = []
  return { type: 'object', properties, required, additionalProperties: false }
}

function providerParams(description: string): AgentToolInputSchema {
  const providerParam: AgentToolParamSchema = {
    type: 'string',
    description,
    enum: ACCOUNT_PROVIDER_VALUES,
  }
  const properties: Record<string, AgentToolParamSchema> = {}
  properties['provider'] = providerParam
  const required: string[] = ['provider']
  return { type: 'object', properties, required, additionalProperties: false }
}

function statusLine(status: AccountStatusResult): string {
  const label = accountProviderTitle(status.provider)
  if (status.linked) {
    return `• ${label}: 已关联${status.displayName ? `（${status.displayName}）` : ''}`
  }
  if (status.error) {
    return `• ${label}: 未关联（${status.error}）`
  }
  return `• ${label}: 未关联`
}

export function buildListAccountProvidersTool(): AgentTool {
  return {
    name: 'list_account_providers',
    title: '查看账号关联',
    description: '查看 YouTube、X、Instagram、Bilibili 等账号关联状态，不返回 cookie 或 token',
    inputSchema: emptyParams(),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (): Promise<AgentToolResult> => {
      const definitions = listAccountProviderDefinitions()
      const statuses: AccountStatusResult[] = []
      let lines = ''
      for (const definition of definitions) {
        const status = await AccountSessionService.status(definition.provider)
        statuses.push(status)
        lines += statusLine(status) + '\n'
      }
      return {
        status: 'success',
        message: `账号关联状态：\n${lines}`,
        data: { statuses },
      }
    },
  }
}

export function buildOpenAccountLoginTool(): AgentTool {
  return {
    name: 'open_account_login',
    title: '打开账号登录',
    description: '打开指定平台的账号关联页面。涉及外部登录页，执行前需要确认',
    inputSchema: providerParams('要打开登录页的平台'),
    capability: 'external',
    risk: 'medium',
    requiresConfirmation: true,
    confirmationTitle: '确认打开账号登录页',
    confirmationMessage: '将打开外部平台登录/关联页面，登录过程由对应平台页面处理。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const provider = args['provider'] as AccountProvider
      const loginUrl = AccountSessionService.loginUrl(provider)
      if (!loginUrl) {
        return { status: 'failed', message: `未找到 ${provider} 的登录入口` }
      }

      const title = accountProviderTitle(provider)
      console.info('[AccountAgent] open_account_login provider:', provider)
      await openAccountLogin(provider, title, loginUrl)
      return {
        status: 'success',
        message: `已打开 ${title} 账号关联页面`,
        data: { provider, title },
      }
    },
  }
}

export function buildUnlinkAccountTool(): AgentTool {
  return {
    name: 'unlink_account',
    title: '取消账号关联',
    description: '取消指定平台的账号关联。会删除本地保存的关联状态；Bilibili 会同时清除本地 SESSDATA',
    inputSchema: providerParams('要取消关联的平台'),
    capability: 'destructive',
    risk: 'high',
    requiresConfirmation: true,
    confirmationTitle: '确认取消账号关联',
    confirmationMessage: '将清除该平台在本地保存的关联状态。Bilibili 会同时清除本地 SESSDATA。',
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const provider = args['provider'] as AccountProvider
      const before = await AccountSessionService.status(provider)
      if (!before.linked) {
        return {
          status: 'success',
          message: `${accountProviderTitle(provider)} 当前未关联，无需取消。`,
          data: { provider, linked: false },
        }
      }

      console.info('[AccountAgent] unlink_account provider:', provider)
      const nextStatus = await AccountSessionService.unlink(provider)
      if (nextStatus.error) {
        return { status: 'failed', message: nextStatus.error, data: { status: nextStatus } }
      }
      return {
        status: 'success',
        message: `已取消 ${accountProviderTitle(provider)} 账号关联`,
        data: { status: nextStatus },
      }
    },
  }
}

export function buildRefreshAccountStatusTool(): AgentTool {
  return {
    name: 'refresh_account_status',
    title: '刷新账号状态',
    description: '刷新指定平台的账号关联状态，不返回 cookie 或 token',
    inputSchema: providerParams('要刷新的平台'),
    capability: 'read',
    risk: 'low',
    requiresConfirmation: false,
    execute: async (_context, args: AgentToolArgs): Promise<AgentToolResult> => {
      const provider = args['provider'] as AccountProvider
      const status = await AccountSessionService.status(provider)
      return {
        status: status.error ? 'failed' : 'success',
        message: statusLine(status),
        data: { status },
      }
    },
  }
}
