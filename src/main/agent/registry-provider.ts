import { AgentToolRegistry } from './tool-registry'
import { AgentHarness } from './harness'
import {
  isAgentCapabilityAllowed,
  normalizeAgentPermissionSettings,
} from '../../shared/types'
import type {
  AgentExecutionContext,
  AgentPermissionSettings,
  AgentTool,
  AgentToolArgs,
  AgentToolRun,
} from '../../shared/types'

export type AgentToolBuilder = () => AgentTool[]

/**
 * Lazily builds the full tool registry from a registered builder and caches
 * permission-filtered views so the loop can hand the model only the tools the
 * current permission set allows.
 */
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
    return this.viewForFilter(`p=${permissionsKey(normalized)}`, (tool) =>
      isAgentCapabilityAllowed(tool.capability, normalized),
    )
  }

  async executeToolRun(
    name: string,
    args: AgentToolArgs,
    confirmed = false,
    permissions?: AgentPermissionSettings,
    context?: Partial<AgentExecutionContext>,
  ): Promise<AgentToolRun> {
    const normalized = normalizeAgentPermissionSettings(permissions)
    const registry = this.forPermissions(normalized)
    const harness = new AgentHarness(registry)
    return harness.execute({
      toolName: name,
      args,
      context: {
        sessionId: context?.sessionId ?? 'ai-chat',
        now: Date.now(),
        signal: context?.signal ?? new AbortController().signal,
        deadlineMs: context?.deadlineMs,
        agentPermissions: normalized,
        activeRoute: context?.activeRoute,
        activeRootTab: context?.activeRootTab,
        metadata: context?.metadata,
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
  return (tool) => isAgentCapabilityAllowed(tool.capability, normalized)
}

export const agentToolRegistryProvider = new AgentToolRegistryProviderImpl()
