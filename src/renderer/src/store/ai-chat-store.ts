import { createAppStore } from "./helpers"
import { useSettingsStore } from "./settings-store"

interface ChatMessage {
  id: string
  role: "user" | "assistant" | "system"
  content: string
  timestamp: number
}

interface AIChatState {
  messages: ChatMessage[]
  isLoading: boolean
  isPanelOpen: boolean
  currentStreamContent: string

  // Actions
  sendMessage: (content: string, context?: string) => Promise<void>
  clearMessages: () => void
  setPanelOpen: (open: boolean) => void
}

let messageCounter = 0
function genId(): string {
  return `msg-${Date.now()}-${++messageCounter}`
}

function renderSystemPrompt(template: string, context?: string, personaPrompt?: string): string {
  const contextBlock = context?.trim()
    ? `The user is currently reading the following article:\n\n${context.slice(0, 4000)}`
    : ""
  const personaBlock = personaPrompt?.trim()
    ? `Personalization instructions from user:\n${personaPrompt.trim()}`
    : ""
  return template
    .replace(/\{\{\s*context\s*\}\}/gi, contextBlock)
    .replace(/\{\{\s*persona\s*\}\}/gi, personaBlock)
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

export const useAIChatStore = createAppStore<AIChatState>((set, get) => ({
  messages: [],
  isLoading: false,
  isPanelOpen: false,
  currentStreamContent: "",

  sendMessage: async (content, context) => {
    const userMessage: ChatMessage = {
      id: genId(),
      role: "user",
      content,
      timestamp: Date.now(),
    }

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      currentStreamContent: "",
    }))

    const aiSettings = useSettingsStore.getState().settings.ai
    const useSystemPrompt = !!aiSettings.enableSystemPrompt
    const personaPrompt = (aiSettings.chatPersonaPrompt || "").trim()
    const systemPromptTemplate = (aiSettings.systemPromptTemplate || "").trim()
    const systemPrompt = renderSystemPrompt(systemPromptTemplate, context, personaPrompt)
    const shouldInjectSystemPrompt = useSystemPrompt && systemPrompt.length > 0

    const messages = [
      ...(shouldInjectSystemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
      ...get().messages.map((m) => ({ role: m.role, content: m.content })),
      { role: "user", content },
    ]

    const requestId = `stream-${Date.now()}`

    // Set up stream listeners
    const cleanupChunk = window.api.ai.onStreamChunk((data) => {
      if (data.requestId === requestId) {
        set((state) => ({
          currentStreamContent: state.currentStreamContent + data.content,
        }))
      }
    })

    const cleanupDone = window.api.ai.onStreamDone((data) => {
      if (data.requestId === requestId) {
        const assistantMessage: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: get().currentStreamContent,
          timestamp: Date.now(),
        }
        set((state) => ({
          messages: [...state.messages, assistantMessage],
          isLoading: false,
          currentStreamContent: "",
        }))
        cleanupChunk()
        cleanupDone()
        cleanupError()
      }
    })

    const cleanupError = window.api.ai.onStreamError((data) => {
      if (data.requestId === requestId) {
        const errorMessage: ChatMessage = {
          id: genId(),
          role: "assistant",
          content: `错误: ${data.error}`,
          timestamp: Date.now(),
        }
        set((state) => ({
          messages: [...state.messages, errorMessage],
          isLoading: false,
          currentStreamContent: "",
        }))
        cleanupChunk()
        cleanupDone()
        cleanupError()
      }
    })

    try {
      await window.api.ai.chatStream(messages, requestId)
    } catch {
      set({ isLoading: false })
      cleanupChunk()
      cleanupDone()
      cleanupError()
    }
  },

  clearMessages: () => set({ messages: [], currentStreamContent: "" }),
  setPanelOpen: (open) => set({ isPanelOpen: open }),
}))
