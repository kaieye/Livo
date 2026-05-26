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

export type AgentToolArgs = Record<string, object>

export interface AgentExecutionContext {
  sessionId: string
  activeRoute?: string
  activeRootTab?: string
  now: number
  dryRun?: boolean
  metadata?: Record<string, object>
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
  data?: Record<string, object>
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
