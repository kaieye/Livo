import { executeDefaultAgentToolRun } from './DefaultAgentTools'
import { agentToolResultToText } from './AgentToolResultText.ts'
import { AgentAbortSignal } from '../services/article-assist/ChatCompletionRunner'
import type {
  AgentPermissionSettings,
  AgentToolArgs,
  AgentToolRun,
} from './AgentTypes.ts'
import type {
  ExtractedToolCall,
} from '../services/article-assist/ProviderResponseParser'
import type {
  AgentMessage,
} from '../services/article-assist/ProviderProtocol'
import type {
  AgentRoundDetail,
  AgentToolExecutionEvent,
  AgentRunResult,
} from './LivoAgentLoop'

export interface ExecutedAgentToolCall {
  run: AgentToolRun
  text: string
}

function toolCallResultSummary(name: string, result: string): string {
  if (result.length > 0 && (result.charAt(0) === '{' || result.startsWith('错误'))) {
    return result.slice(0, 100)
  }
  return `${name} 执行完毕 (返回 ${result.length} 字)`
}

function truncateToolResult(result: string): string {
  const maxLen = 8000
  if (result.length <= maxLen) {
    return result
  }
  return result.slice(0, maxLen) + '\n\n...(结果已截断，总长度 ' + result.length + ' 字)'
}

function emitToolEvent(
  onToolEvent: ((event: AgentToolExecutionEvent) => void) | undefined,
  event: AgentToolExecutionEvent,
): void {
  if (onToolEvent) {
    onToolEvent(event)
  }
}

export function toToolResultMessage(tc: ExtractedToolCall, toolResult: string): AgentMessage {
  return {
    role: 'tool',
    content: toolResult,
    tool_call_id: tc.id,
    name: tc.function.name,
  }
}

export function buildConfirmationRequiredResult(
  tc: ExtractedToolCall,
  remainingToolCalls: ExtractedToolCall[],
  currentMessages: AgentMessage[],
  toolRounds: AgentRoundDetail[],
  nextRound: number,
  executed: ExecutedAgentToolCall,
): AgentRunResult {
  const confirmation = executed.run.result.confirmation
  if (!confirmation) {
    const completed: AgentRunResult = {
      text: executed.text,
      toolRounds,
      status: 'completed',
    }
    return completed
  }

  const result: AgentRunResult = {
    text: executed.text,
    toolRounds,
    status: 'confirmation_required',
    confirmation: {
      toolCallId: tc.id,
      toolName: tc.function.name,
      args: tc.function.arguments,
      confirmation,
    },
    continuation: {
      messages: currentMessages.slice(),
      pendingToolCall: tc,
      remainingToolCalls,
      toolRounds: toolRounds.slice(),
      nextRound,
    },
  }
  return result
}

export async function executeAgentToolCall(
  tc: ExtractedToolCall,
  confirmed: boolean,
  toolRounds: AgentRoundDetail[],
  onToolEvent?: (event: AgentToolExecutionEvent) => void,
  abortSignal?: AgentAbortSignal,
  agentPermissions?: AgentPermissionSettings,
): Promise<ExecutedAgentToolCall> {
  if (abortSignal?.aborted) {
    throw new Error('请求已取消')
  }

  const startedEvent: AgentToolExecutionEvent = {
    type: 'tool_started',
    toolCallId: tc.id,
    toolName: tc.function.name,
    args: tc.function.arguments,
  }
  emitToolEvent(onToolEvent, startedEvent)

  let parsedArgs: AgentToolArgs = {}
  try {
    const raw = JSON.parse(tc.function.arguments || '{}') as object
    parsedArgs = raw as AgentToolArgs
  } catch (_error) {
  }

  const run = await executeDefaultAgentToolRun(tc.function.name, parsedArgs, confirmed, agentPermissions)
  const toolText = truncateToolResult(agentToolResultToText(run.result))
  const resultSummary = toolCallResultSummary(tc.function.name, toolText)
  const roundDetail: AgentRoundDetail = {
    name: tc.function.name,
    args: tc.function.arguments,
    resultSummary,
    status: run.result.status,
    elapsedMs: run.elapsedMs,
    confirmation: run.result.confirmation,
  }
  toolRounds.push(roundDetail)

  if (run.result.status === 'confirmation_required') {
    const confirmationEvent: AgentToolExecutionEvent = {
      type: 'confirmation_required',
      toolCallId: tc.id,
      toolName: tc.function.name,
      args: tc.function.arguments,
      message: run.result.message,
      resultSummary,
      elapsedMs: run.elapsedMs,
      confirmation: run.result.confirmation,
    }
    emitToolEvent(onToolEvent, confirmationEvent)
  } else {
    const completedEvent: AgentToolExecutionEvent = {
      type: run.result.status === 'success' ? 'tool_completed' : 'tool_failed',
      toolCallId: tc.id,
      toolName: tc.function.name,
      args: tc.function.arguments,
      message: run.result.message,
      resultSummary,
      elapsedMs: run.elapsedMs,
    }
    emitToolEvent(onToolEvent, completedEvent)
  }

  const result: ExecutedAgentToolCall = {
    run,
    text: toolText,
  }
  return result
}
