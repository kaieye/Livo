// Agent permission and capability types

export type AgentToolCapability =
  | 'read'
  | 'navigate'
  | 'mutate'
  | 'destructive'
  | 'external'

export interface AgentPermissionSettings {
  allowRead: boolean
  allowNavigate: boolean
  allowMutate: boolean
  allowDestructive: boolean
  allowExternal: boolean
}

export const DEFAULT_AGENT_PERMISSION_SETTINGS: AgentPermissionSettings = {
  allowRead: true,
  allowNavigate: true,
  allowMutate: true,
  allowDestructive: true,
  allowExternal: true,
}

export function normalizeAgentPermissionSettings(
  permissions?: Partial<AgentPermissionSettings>,
): AgentPermissionSettings {
  return {
    allowRead:
      permissions?.allowRead ?? DEFAULT_AGENT_PERMISSION_SETTINGS.allowRead,
    allowNavigate:
      permissions?.allowNavigate ??
      DEFAULT_AGENT_PERMISSION_SETTINGS.allowNavigate,
    allowMutate:
      permissions?.allowMutate ?? DEFAULT_AGENT_PERMISSION_SETTINGS.allowMutate,
    allowDestructive:
      permissions?.allowDestructive ??
      DEFAULT_AGENT_PERMISSION_SETTINGS.allowDestructive,
    allowExternal:
      permissions?.allowExternal ??
      DEFAULT_AGENT_PERMISSION_SETTINGS.allowExternal,
  }
}

export function isAgentCapabilityAllowed(
  capability: AgentToolCapability,
  permissions?: Partial<AgentPermissionSettings>,
): boolean {
  const normalized = normalizeAgentPermissionSettings(permissions)
  switch (capability) {
    case 'read':
      return normalized.allowRead
    case 'navigate':
      return normalized.allowNavigate
    case 'mutate':
      return normalized.allowMutate
    case 'destructive':
      return normalized.allowDestructive
    case 'external':
      return normalized.allowExternal
    default:
      return false
  }
}
