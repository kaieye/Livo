import { AgentToolRegistry } from './ToolRegistry.ts'
import { AgentHarness } from './AgentHarness.ts'
import {
  isAgentCapabilityAllowed,
  normalizeAgentPermissionSettings,
} from './AgentTypes.ts'
import type {
  AgentExecutionContext,
  AgentPermissionSettings,
  AgentTool,
  AgentToolArgs,
  AgentToolRun,
} from './AgentTypes.ts'

export type AgentToolBuilder = () => AgentTool[]

class AgentToolRegistryProviderImpl {
  private builder: AgentToolBuilder | undefined
  private fullRegistry: AgentToolRegistry | undefined
  private readonly viewCache: Map<string, AgentToolRegistry> = new Map()

  setBuilder(builder: AgentToolBuilder): void {
    this.builder = builder
    this.fullRegistry = undefined
    this.viewCache.clear()
  }

  full(): AgentToolRegistry {
    if (!this.fullRegistry) {
      if (!this.builder) {
        throw new Error('AgentToolRegistryProvider 未注册工具构建器')
      }
      this.fullRegistry = new AgentToolRegistry(this.builder())
    }
    return this.fullRegistry
  }

  forContext(context: AgentExecutionContext): AgentToolRegistry {
    return this.viewForFilter(filterKey(context), buildContextFilter(context))
  }

  forPermissions(permissions?: AgentPermissionSettings): AgentToolRegistry {
    const normalized = normalizeAgentPermissionSettings(permissions)
    return this.viewForFilter(
      `p=${permissionsKey(normalized)}`,
      (tool: AgentTool) =>
        isAgentCapabilityAllowed(tool.capability, normalized),
    )
  }

  async executeToolRun(
    name: string,
    args: AgentToolArgs,
    confirmed: boolean = false,
    permissions?: AgentPermissionSettings,
  ): Promise<AgentToolRun> {
    const normalized = normalizeAgentPermissionSettings(permissions)
    const registry = this.forPermissions(normalized)
    const harness = new AgentHarness(registry)
    return harness.execute({
      toolName: name,
      args,
      context: {
        sessionId: 'ai-chat',
        now: Date.now(),
        agentPermissions: normalized,
      },
      confirmed,
    })
  }

  resetForTests(): void {
    this.fullRegistry = undefined
    this.viewCache.clear()
  }

  private viewForFilter(
    cacheKey: string,
    predicate: (tool: AgentTool) => boolean,
  ): AgentToolRegistry {
    const cached = this.viewCache.get(cacheKey)
    if (cached) {
      return cached
    }
    const filtered = this.full().list().filter(predicate)
    const registry = new AgentToolRegistry(filtered)
    this.viewCache.set(cacheKey, registry)
    return registry
  }
}

function permissionsKey(permissions: AgentPermissionSettings): string {
  return (
    `${permissions.allowRead ? 1 : 0}` +
    `${permissions.allowNavigate ? 1 : 0}` +
    `${permissions.allowMutate ? 1 : 0}` +
    `${permissions.allowDestructive ? 1 : 0}` +
    `${permissions.allowExternal ? 1 : 0}`
  )
}

function filterKey(context: AgentExecutionContext): string {
  const normalized = normalizeAgentPermissionSettings(context.agentPermissions)
  return (
    `p=${permissionsKey(normalized)}` +
    `|t=${context.activeRootTab || ''}` +
    `|r=${context.activeRoute || ''}`
  )
}

function buildContextFilter(
  context: AgentExecutionContext,
): (tool: AgentTool) => boolean {
  const normalized = normalizeAgentPermissionSettings(context.agentPermissions)
  return (tool: AgentTool): boolean => {
    if (!isAgentCapabilityAllowed(tool.capability, normalized)) {
      return false
    }
    // 占位：未来按 context.activeRoute / context.activeRootTab 屏蔽工具。
    // 例如未登录账号时屏蔽 unlink_account；当前在设置页时屏蔽 open_settings_panel。
    return true
  }
}

export const agentToolRegistryProvider = new AgentToolRegistryProviderImpl()
