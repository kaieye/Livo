import { AIAssistantSettings } from '../models/LivoModels'
import { ChatMessage } from '../services/ChatHistoryStore'
import {
  runChatAgent,
  resumeChatAgent,
  AgentAbortSignal,
  AgentContinuationState,
  AgentPendingConfirmation,
  AgentRoundDetail,
  AgentRunResult,
  AgentToolExecutionEvent,
} from '../services/AIChatAgentService'
import { buildDefaultTools } from '../services/AIChatTools'

export { AgentAbortSignal }

export type LivoAgentEventType = 'tool_started' | 'tool_completed' | 'tool_failed' | 'confirmation_required'

export interface LivoAgentEvent {
  type: LivoAgentEventType
  toolName: string
  toolCallId: string
  args: string
  at: number
  message?: string
  resultSummary?: string
  elapsedMs?: number
  confirmation?: AgentPendingConfirmation
}

export interface LivoAgentRunRequest {
  prompt: string
  aiSettings: AIAssistantSettings
  history?: ChatMessage[]
  pageContext?: string
  abortSignal?: AgentAbortSignal
  onEvent?: (event: LivoAgentEvent) => void
}

export interface LivoAgentResumeRequest {
  aiSettings: AIAssistantSettings
  continuation: AgentContinuationState
  abortSignal?: AgentAbortSignal
  onEvent?: (event: LivoAgentEvent) => void
}

export type LivoAgentRoundDetail = AgentRoundDetail
export type LivoAgentRunResult = AgentRunResult
export type LivoAgentContinuationState = AgentContinuationState
export type LivoAgentPendingConfirmation = AgentPendingConfirmation

export async function runLivoAgent(request: LivoAgentRunRequest): Promise<LivoAgentRunResult> {
  const tools = buildDefaultTools(request.aiSettings.agentPermissions)
  console.info('[LivoAgent] run started', 'history:', request.history ? request.history.length : 0)

  return runChatAgent(
    request.prompt,
    request.aiSettings,
    request.history,
    tools,
    (event: AgentToolExecutionEvent) => {
      forwardLivoAgentEvent(event, request.onEvent)
    },
    request.abortSignal,
    request.pageContext || '',
  )
}

export async function resumeLivoAgent(request: LivoAgentResumeRequest): Promise<LivoAgentRunResult> {
  const tools = buildDefaultTools(request.aiSettings.agentPermissions)
  console.info('[LivoAgent] resume started', 'nextRound:', request.continuation.nextRound)

  return resumeChatAgent(
    request.continuation,
    request.aiSettings,
    tools,
    (event: AgentToolExecutionEvent) => {
      forwardLivoAgentEvent(event, request.onEvent)
    },
    request.abortSignal,
  )
}

function forwardLivoAgentEvent(
  event: AgentToolExecutionEvent,
  onEvent?: (event: LivoAgentEvent) => void,
): void {
  console.info('[LivoAgent] tool event:', event.type, event.toolName)
  if (!onEvent) {
    return
  }

  onEvent({
    type: event.type,
    toolName: event.toolName,
    toolCallId: event.toolCallId,
    args: event.args,
    at: Date.now(),
    message: event.message,
    resultSummary: event.resultSummary,
    elapsedMs: event.elapsedMs,
    confirmation: event.confirmation ? {
      toolCallId: event.toolCallId,
      toolName: event.toolName,
      args: event.args,
      confirmation: event.confirmation,
    } : undefined,
  })
}
