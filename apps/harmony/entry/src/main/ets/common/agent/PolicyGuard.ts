import type {
  AgentConfirmationRequest,
  AgentExecutionContext,
  AgentRiskLevel,
  AgentTool,
  AgentToolArgs,
} from './AgentTypes.ts'

export interface AgentPolicyDecision {
  allowed: boolean
  requiresConfirmation: boolean
  reason: string
  risk: AgentRiskLevel
}

export class AgentPolicyGuard {
  evaluate(
    tool: AgentTool,
    _args: AgentToolArgs,
    _context: AgentExecutionContext,
  ): AgentPolicyDecision {
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
