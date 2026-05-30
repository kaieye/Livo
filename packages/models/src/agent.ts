// Agent tool system contracts shared across platforms (Harmony / Desktop).
//
// Only the interface and enum surface lives here so both ends can keep their
// tool signatures identical. The capability + permission enums already live in
// ./types.ts and are re-used here.

import type { AgentToolCapability, AgentPermissionSettings } from './types'

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

/** OpenAI-compatible function tool definition fed to the model. */
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

// ---------------------------------------------------------------------------
// Wire types shared across main / preload / renderer for the agent runtime.
// ---------------------------------------------------------------------------

export interface AgentRoundDetail {
  name: string
  args: string
  resultSummary: string
  status?: string
  elapsedMs?: number
  confirmation?: AgentConfirmationRequest
}

export type AgentRunStatus = 'completed' | 'confirmation_required'

export type AgentToolEventType =
  | 'tool_started'
  | 'tool_completed'
  | 'tool_failed'
  | 'confirmation_required'

export interface AgentToolExecutionEvent {
  type: AgentToolEventType
  toolCallId: string
  toolName: string
  args: string
  message?: string
  resultSummary?: string
  elapsedMs?: number
  confirmation?: AgentConfirmationRequest
}

export interface AgentPendingConfirmation {
  toolCallId: string
  toolName: string
  args: string
  confirmation: AgentConfirmationRequest
}

export interface AgentRoundMetric {
  round: number
  llmMs: number
  toolMs: number
  toolCalls: number
}

export interface AgentRunMetrics {
  totalMs: number
  llmMs: number
  toolMs: number
  rounds: AgentRoundMetric[]
}

/** Final result surfaced over IPC for one agent run / resume. */
export interface AgentRunSummary {
  text: string
  status: AgentRunStatus
  toolRounds: AgentRoundDetail[]
  confirmation?: AgentPendingConfirmation
  /** Present when status is `confirmation_required`; pass to resume. */
  pendingId?: string
  metrics: AgentRunMetrics
}

export interface AgentChatHistoryMessage {
  role: 'user' | 'assistant'
  content: string
}

export type AgentRootTab = 'home' | 'subscriptions' | 'discover' | 'settings'

export type AgentSettingsPanel =
  | 'settings'
  | 'general'
  | 'appearance'
  | 'reading'
  | 'data'
  | 'privacy'
  | 'about'
  | 'ai'
  | 'accounts'
  | 'agentPermissions'

/** A navigation intent relayed from a navigation tool (main) to the renderer. */
export type AgentNavigationAction =
  | { type: 'open-root-tab'; tab: AgentRootTab; replace?: boolean }
  | { type: 'go-back' }
  | { type: 'open-entry-detail'; entryId: string }
  | { type: 'open-feed-detail'; feedId: string }
  | { type: 'open-settings-panel'; panel: AgentSettingsPanel }
  | {
      type: 'open-video-player'
      title: string
      videoUrl: string
      previewUrl?: string
    }
  | { type: 'open-image-viewer'; imageUrl: string; title?: string }

export interface AgentTraceToolCall {
  id: string
  toolName: string
  argsPreview: string
  status: string
  resultSummary: string
  elapsedMs: number
  at: number
}

export type AgentTraceStatus =
  | 'completed'
  | 'confirmation_required'
  | 'failed'
  | 'cancelled'

export interface AgentTraceRecord {
  traceId: string
  sessionId: string
  startedAt: number
  completedAt: number
  promptSummary: string
  finalText: string
  status: AgentTraceStatus
  toolCalls: AgentTraceToolCall[]
}
