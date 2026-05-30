import { isAgentCapabilityAllowed } from '../../shared/types'
import type {
  AgentConfirmationRequest,
  AgentExecutionContext,
  AgentRiskLevel,
  AgentTool,
  AgentToolArgs,
} from '../../shared/types'

export interface AgentPolicyDecision {
  allowed: boolean
  requiresConfirmation: boolean
  reason: string
  risk: AgentRiskLevel
}

/**
 * Centralizes the agent safety policy: permission gating per capability and
 * the confirmation requirements for mutate / destructive / external tools.
 */
export class AgentPolicyGuard {
  evaluate(
    tool: AgentTool,
    _args: AgentToolArgs,
    context: AgentExecutionContext,
  ): AgentPolicyDecision {
    if (!isAgentCapabilityAllowed(tool.capability, context.agentPermissions)) {
      return {
        allowed: false,
        requiresConfirmation: false,
        reason: disabledPermissionReason(tool),
        risk: tool.risk,
      }
    }

    if (tool.capability === 'read') {
      return {
        allowed: true,
        requiresConfirmation: tool.requiresConfirmation,
        reason: tool.requiresConfirmation
          ? '只读工具显式要求确认'
          : '只读工具可自动执行',
        risk: tool.risk,
      }
    }

    if (tool.capability === 'navigate') {
      return {
        allowed: true,
        requiresConfirmation: tool.requiresConfirmation || tool.risk === 'high',
        reason:
          tool.risk === 'high' ? '高风险导航需要确认' : '导航工具可自动执行',
        risk: tool.risk,
      }
    }

    if (tool.capability === 'external') {
      return {
        allowed: true,
        requiresConfirmation: tool.requiresConfirmation || tool.risk !== 'low',
        reason:
          tool.risk === 'low' ? '低风险外部工具可执行' : '外部工具需要用户确认',
        risk: tool.risk,
      }
    }

    if (tool.capability === 'mutate') {
      return {
        allowed: true,
        requiresConfirmation: true,
        reason: '写入工具需要用户确认',
        risk: tool.risk,
      }
    }

    return {
      allowed: true,
      requiresConfirmation: true,
      reason: '破坏性工具必须用户确认',
      risk: tool.risk,
    }
  }

  createConfirmation(
    tool: AgentTool,
    args: AgentToolArgs,
    decision: AgentPolicyDecision,
  ): AgentConfirmationRequest {
    return {
      toolName: tool.name,
      title: tool.confirmationTitle || `确认执行：${tool.title}`,
      message:
        tool.confirmationMessage || confirmationMessageFor(tool, decision),
      risk: decision.risk,
      argsPreview: formatArgsPreview(args),
    }
  }
}

function confirmationMessageFor(
  tool: AgentTool,
  decision: AgentPolicyDecision,
): string {
  if (tool.capability === 'destructive') {
    return '该操作会删除或覆盖本地数据，请确认对象和影响范围后再执行。'
  }
  if (tool.capability === 'external') {
    return '该操作会访问外部页面、服务或导出本地数据，请确认后继续。'
  }
  return decision.reason
}

function formatArgsPreview(args: AgentToolArgs): string {
  const keys = Object.keys(args)
  if (keys.length === 0) {
    return '无参数'
  }

  let preview = ''
  for (const key of keys) {
    const value = args[key]
    const rendered = typeof value === 'string' ? value : JSON.stringify(value)
    preview += `${key}: ${rendered}\n`
  }
  return preview.trim()
}

function disabledPermissionReason(tool: AgentTool): string {
  if (tool.capability === 'read') {
    return `当前 Agent 权限未允许读取本地数据，已阻止「${tool.title}」。`
  }
  if (tool.capability === 'navigate') {
    return `当前 Agent 权限未允许打开页面，已阻止「${tool.title}」。`
  }
  if (tool.capability === 'mutate') {
    return `当前 Agent 权限未允许修改应用数据或设置，已阻止「${tool.title}」。`
  }
  if (tool.capability === 'destructive') {
    return `当前 Agent 权限未允许删除或覆盖数据，已阻止「${tool.title}」。`
  }
  return `当前 Agent 权限未允许访问外部服务或导出数据，已阻止「${tool.title}」。`
}
