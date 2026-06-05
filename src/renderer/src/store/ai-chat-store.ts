import { createAppStore } from './helpers'
import { useSettingsStore } from './settings-store'
import { useOverlayStackStore } from './overlay-stack-store'
import { Typewriter } from '../lib/typewriter'
import { aiChatToolLabelOf } from '../components/ai/tool-labels'
import {
  ChatHistoryStore,
  type ChatSession,
  type StoredChatMessage,
} from './chat-history-store'
import type {
  ToolStatusItem,
  PendingAgentConfirmationView,
} from '../components/ai/types'
import type {
  AgentToolExecutionEvent,
  AgentRunMetrics,
  AgentChatHistoryMessage,
  AgentRunResponse,
} from '@shared'

export type ChatMessage = StoredChatMessage

// Re-export so the rest of the app imports the canonical shape from this
// store (which already has @shared wired up).
export type { AgentRunResponse }

interface AIChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isConfirming: boolean
  isPanelOpen: boolean
  streamingContent: string
  toolStatusItems: ToolStatusItem[]
  showToolBanner: boolean
  pendingConfirmation: PendingAgentConfirmationView | null
  pendingId: string | null
  elapsedLabel: string
  timerVisible: boolean
  lastMetrics: AgentRunMetrics | null
  currentSessionId: string
  currentRequestId: string | null

  // Actions
  sendMessage: (content: string, context?: string) => Promise<void>
  confirmPending: () => Promise<void>
  cancelPending: () => void
  stop: () => void
  clearMessages: () => void
  newConversation: () => void
  loadSession: (session: ChatSession) => void
  setPanelOpen: (open: boolean) => void
  applyToolEvent: (event: AgentToolExecutionEvent) => void
}

let messageCounter = 0
function genId(): string {
  return `msg-${Date.now()}-${++messageCounter}`
}

function newSessionId(): string {
  return `session-${Date.now()}-${++messageCounter}`
}

// Module-level transient state that should not trigger React re-renders.
const typewriter = new Typewriter()
let timerInterval: ReturnType<typeof setInterval> | null = null
let timerStartMs = 0
let toolEventSubscribed = false

function toolTraceStatus(
  type: AgentToolExecutionEvent['type'],
): ToolStatusItem['status'] {
  if (type === 'tool_completed') return 'success'
  if (type === 'tool_failed') return 'failed'
  if (type === 'confirmation_required') return 'confirmation_required'
  return 'running'
}

export const useAIChatStore = createAppStore<AIChatState>((set, get) => {
  function ensureToolEventSubscription(): void {
    if (toolEventSubscribed) return
    toolEventSubscribed = true
    window.api.agent.onToolEvent((data) => {
      if (data.requestId !== get().currentRequestId) return
      get().applyToolEvent(data)
    })
  }

  function startTimer(): void {
    stopTimer(false)
    timerStartMs = Date.now()
    set({ elapsedLabel: '0.0s', timerVisible: true })
    timerInterval = setInterval(() => {
      const elapsed = (Date.now() - timerStartMs) / 1000
      set({ elapsedLabel: `${elapsed.toFixed(1)}s` })
    }, 100)
  }

  function stopTimer(hide = true): void {
    if (timerInterval !== null) {
      clearInterval(timerInterval)
      timerInterval = null
    }
    if (hide) set({ timerVisible: false })
  }

  function dismissToolBannerSoon(): void {
    setTimeout(() => {
      // Only clear if a new run hasn't started in the meantime.
      if (!get().isLoading && !get().pendingConfirmation) {
        set({ showToolBanner: false, toolStatusItems: [] })
      }
    }, 1200)
  }

  function buildHistory(): AgentChatHistoryMessage[] {
    return get()
      .messages.filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      }))
  }

  function saveCurrentSession(): void {
    const { messages, currentSessionId } = get()
    if (messages.length === 0) return
    const title =
      messages.find((m) => m.role === 'user')?.content.slice(0, 40) || '新对话'
    const now = Date.now()
    ChatHistoryStore.save({
      id: currentSessionId,
      title,
      messages: messages.slice(),
      createdAt: now,
      updatedAt: now,
    })
  }

  function finishAssistantResponse(text: string): void {
    set({ isLoading: false, isConfirming: false, currentRequestId: null })
    typewriter.start(text, {
      onTick: (displayed) => set({ streamingContent: displayed }),
      onDone: () => {
        const assistantMessage: ChatMessage = {
          id: genId(),
          role: 'assistant',
          content: text,
          timestamp: Date.now(),
        }
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          streamingContent: '',
        }))
        stopTimer()
        saveCurrentSession()
        dismissToolBannerSoon()
      },
    })
  }

  function handleResult(result: AgentRunResponse): void {
    if (!result.success) {
      pushSystemError(result.error)
      return
    }

    set({ lastMetrics: result.metrics })

    if (
      result.status === 'confirmation_required' &&
      result.confirmation &&
      result.pendingId
    ) {
      const c = result.confirmation
      set({
        pendingConfirmation: {
          toolCallId: c.toolCallId,
          toolName: c.toolName,
          title: c.confirmation.title,
          message: c.confirmation.message,
          risk: c.confirmation.risk,
          argsPreview: c.confirmation.argsPreview,
        },
        pendingId: result.pendingId,
        isLoading: false,
        isConfirming: false,
        streamingContent: '',
        currentRequestId: null,
      })
      stopTimer()
      return
    }

    finishAssistantResponse(result.text)
  }

  function pushSystemError(message: string): void {
    typewriter.cancel()
    stopTimer()
    set((state) => ({
      messages: [
        ...state.messages,
        {
          id: genId(),
          role: 'system' as const,
          content: message,
          timestamp: Date.now(),
        },
      ],
      isLoading: false,
      isConfirming: false,
      streamingContent: '',
      currentRequestId: null,
    }))
    dismissToolBannerSoon()
  }

  return {
    messages: [],
    isLoading: false,
    isConfirming: false,
    isPanelOpen: false,
    streamingContent: '',
    toolStatusItems: [],
    showToolBanner: false,
    pendingConfirmation: null,
    pendingId: null,
    elapsedLabel: '',
    timerVisible: false,
    lastMetrics: null,
    currentSessionId: newSessionId(),
    currentRequestId: null,

    applyToolEvent: (event) => {
      const key = event.toolCallId || `${event.toolName}-${Date.now()}`
      const status = toolTraceStatus(event.type)
      set((state) => {
        const items = state.toolStatusItems.slice()
        const index = items.findIndex((item) => item.key === key)
        const base: ToolStatusItem =
          index >= 0
            ? items[index]
            : {
                key,
                label: aiChatToolLabelOf(event.toolName),
                name: event.toolName,
                status,
              }
        const next: ToolStatusItem = {
          ...base,
          status,
          message: event.message || event.resultSummary,
          argsPreview: event.args,
          elapsedMs: event.elapsedMs,
        }
        if (index >= 0) items[index] = next
        else items.push(next)
        return { toolStatusItems: items, showToolBanner: true }
      })
    },

    sendMessage: async (content, context) => {
      if (get().isLoading || get().pendingConfirmation) return
      const configError = validateChatConfig()
      if (configError) {
        pushSystemError(configError)
        return
      }
      ensureToolEventSubscription()

      typewriter.cancel()
      const history = buildHistory()
      const userMessage: ChatMessage = {
        id: genId(),
        role: 'user',
        content,
        timestamp: Date.now(),
      }
      const requestId = `agent-${Date.now()}-${++messageCounter}`
      set((state) => ({
        messages: [...state.messages, userMessage],
        isLoading: true,
        streamingContent: '',
        toolStatusItems: [],
        showToolBanner: false,
        currentRequestId: requestId,
      }))
      startTimer()

      try {
        const result = (await window.api.agent.run({
          requestId,
          prompt: content,
          history,
          pageContext: context,
        })) as AgentRunResponse
        handleResult(result)
      } catch (error) {
        pushSystemError(error instanceof Error ? error.message : String(error))
      }
    },

    confirmPending: async () => {
      const pendingId = get().pendingId
      if (!pendingId) return
      ensureToolEventSubscription()
      const requestId = `agent-${Date.now()}-${++messageCounter}`
      set({
        pendingConfirmation: null,
        pendingId: null,
        isLoading: true,
        isConfirming: true,
        currentRequestId: requestId,
      })
      startTimer()
      try {
        const result = (await window.api.agent.resume({
          requestId,
          pendingId,
        })) as AgentRunResponse
        handleResult(result)
      } catch (error) {
        pushSystemError(error instanceof Error ? error.message : String(error))
      }
    },

    cancelPending: () => {
      const pending = get().pendingConfirmation
      if (!pending) return
      set((state) => {
        const items = state.toolStatusItems.slice()
        const index = items.findIndex((item) => item.key === pending.toolCallId)
        if (index >= 0) {
          items[index] = {
            ...items[index],
            status: 'cancelled',
            message: '用户取消执行',
          }
        }
        return {
          toolStatusItems: items,
          pendingConfirmation: null,
          pendingId: null,
          isConfirming: false,
          messages: [
            ...state.messages,
            {
              id: genId(),
              role: 'assistant' as const,
              content: `已取消执行「${aiChatToolLabelOf(pending.toolName)}」。`,
              timestamp: Date.now(),
            },
          ],
        }
      })
      stopTimer()
      saveCurrentSession()
      dismissToolBannerSoon()
    },

    stop: () => {
      const requestId = get().currentRequestId
      if (requestId) void window.api.agent.abort(requestId)
      typewriter.cancel()
      stopTimer()
      set({
        isLoading: false,
        isConfirming: false,
        streamingContent: '',
        currentRequestId: null,
      })
      dismissToolBannerSoon()
    },

    clearMessages: () => {
      saveCurrentSession()
      typewriter.cancel()
      stopTimer()
      set({
        messages: [],
        streamingContent: '',
        toolStatusItems: [],
        showToolBanner: false,
        pendingConfirmation: null,
        pendingId: null,
        isLoading: false,
        isConfirming: false,
        currentRequestId: null,
        currentSessionId: newSessionId(),
        lastMetrics: null,
      })
    },

    newConversation: () => {
      get().clearMessages()
    },

    loadSession: (session) => {
      saveCurrentSession()
      typewriter.cancel()
      stopTimer()
      set({
        messages: session.messages.slice(),
        currentSessionId: session.id,
        streamingContent: '',
        toolStatusItems: [],
        showToolBanner: false,
        pendingConfirmation: null,
        pendingId: null,
        isLoading: false,
        isConfirming: false,
        currentRequestId: null,
        lastMetrics: null,
      })
    },

    setPanelOpen: (open) => {
      if (open) {
        useOverlayStackStore.getState().open('ai-chat')
      } else {
        useOverlayStackStore.getState().close('ai-chat')
        saveCurrentSession()
      }
      set({ isPanelOpen: open })
    },
  }
})

function validateChatConfig(): string | null {
  const ai = useSettingsStore.getState().settings.ai
  if (!(ai.apiKey || '').trim()) {
    return '请先在「设置 > AI」中配置 API Key'
  }
  if (!(ai.model || '').trim()) {
    return '请先在「设置 > AI」中配置模型'
  }
  return null
}
