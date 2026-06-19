import { IPC } from '../../shared/types'
import { registerChannel } from '../ipc/register-channel'
import type { AgentRunResponse } from '@shared'
import { agentService } from '../agent/service'
import type {
  AgentHistoryMessage,
  AgentToolExecutionEvent,
} from '../agent/loop'
import { AgentTraceStore } from '../agent/trace-store'
import { settingsProvider } from '../services/system/settings-provider'
import { normalizeAIError } from '../services/ai/provider-protocol'
// Importing default-tools registers the tool builder with the registry provider.
import '../agent/default-tools'

interface AgentRunPayload {
  requestId: string
  prompt: string
  history?: AgentHistoryMessage[]
  pageContext?: string
}

interface AgentResumePayload {
  requestId: string
  pendingId: string
}

export function registerAgentHandlers(): void {
  registerChannel(
    IPC.AGENT_RUN,
    async (event, payload: AgentRunPayload): Promise<AgentRunResponse> => {
      const onToolEvent = (toolEvent: AgentToolExecutionEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('agent:tool-event', {
            requestId: payload.requestId,
            ...toolEvent,
          })
        }
      }
      try {
        const result = await agentService.run({
          requestId: payload.requestId,
          prompt: payload.prompt,
          history: payload.history,
          pageContext: payload.pageContext,
          onToolEvent,
        })
        return { success: true, ...result }
      } catch (error) {
        return {
          success: false,
          error: normalizeAIError(error, settingsProvider.get().ai),
        }
      }
    },
  )

  registerChannel(
    IPC.AGENT_RESUME,
    async (event, payload: AgentResumePayload): Promise<AgentRunResponse> => {
      const onToolEvent = (toolEvent: AgentToolExecutionEvent) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('agent:tool-event', {
            requestId: payload.requestId,
            ...toolEvent,
          })
        }
      }
      try {
        const result = await agentService.resume({
          requestId: payload.requestId,
          pendingId: payload.pendingId,
          onToolEvent,
        })
        return { success: true, ...result }
      } catch (error) {
        return {
          success: false,
          error: normalizeAIError(error, settingsProvider.get().ai),
        }
      }
    },
  )

  registerChannel(IPC.AGENT_ABORT, (_event, requestId: string) => {
    return { success: agentService.abort(requestId) }
  })

  registerChannel(IPC.AGENT_CANCEL_PENDING, (_event, pendingId: string) => {
    return { success: agentService.cancelPending(pendingId) }
  })

  registerChannel(IPC.AGENT_TRACES_LIST, () => {
    return AgentTraceStore.loadAll()
  })

  registerChannel(IPC.AGENT_TRACES_CLEAR, () => {
    AgentTraceStore.clearAll()
    return { success: true }
  })
}
