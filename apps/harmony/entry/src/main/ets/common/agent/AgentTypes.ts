export type AgentToolCapability =
  | 'read'
  | 'navigate'
  | 'mutate'
  | 'destructive'
  | 'external'
export type AgentRiskLevel = 'low' | 'medium' | 'high'
export type AgentToolResultStatus =
  | 'success'
  | 'failed'
  | 'confirmation_required'

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

export interface AgentToolParamSchema {
  type: string
  description?: string
  enum?: string[]
}

export interface AgentToolInputSchema {
  type: string
  properties: Record<string, AgentToolParamSchema>
  required: string[]
  additionalProperties?: boolean
}

export interface AgentToolDefinition {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: AgentToolInputSchema
  }
}

export type AgentToolValue = string | number | boolean | object
export type AgentToolArgs = Record<string, AgentToolValue>

export interface AgentExecutionContext {
  sessionId: string
  activeRoute?: string
  activeRootTab?: string
  now: number
  agentPermissions?: AgentPermissionSettings
  dryRun?: boolean
  metadata?: Record<string, AgentToolValue>
}

export interface AgentConfirmationRequest {
  toolName: string
  title: string
  message: string
  risk: AgentRiskLevel
  argsPreview: string
}

export interface AgentToolResult {
  status: AgentToolResultStatus
  message: string
  data?: Record<string, AgentToolValue>
  confirmation?: AgentConfirmationRequest
}

export interface AgentTool {
  name: string
  title: string
  description: string
  inputSchema: AgentToolInputSchema
  outputSchema?: AgentToolInputSchema
  capability: AgentToolCapability
  risk: AgentRiskLevel
  requiresConfirmation: boolean
  confirmationTitle?: string
  confirmationMessage?: string
  execute: (
    context: AgentExecutionContext,
    args: AgentToolArgs,
  ) => Promise<AgentToolResult>
}

export interface AgentToolRun {
  toolName: string
  args: AgentToolArgs
  result: AgentToolResult
  elapsedMs: number
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
  if (capability === 'read') {
    return normalized.allowRead
  }
  if (capability === 'navigate') {
    return normalized.allowNavigate
  }
  if (capability === 'mutate') {
    return normalized.allowMutate
  }
  if (capability === 'destructive') {
    return normalized.allowDestructive
  }
  return normalized.allowExternal
}
