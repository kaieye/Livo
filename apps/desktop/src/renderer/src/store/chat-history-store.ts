// ChatHistoryStore — 会话历史持久化（移植自 Harmony 端 services/ChatHistoryStore.ets）。
//
// Desktop 端用 localStorage 替代 Harmony 的 Preferences，保留同样的接口语义：
// 最多保留 MAX_SESSIONS 条会话，按 updatedAt 倒序返回。

const CHAT_SESSIONS_KEY = 'livo-chat-sessions'
const MAX_SESSIONS = 50

export interface StoredChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
}

export interface ChatSession {
  id: string
  title: string
  messages: StoredChatMessage[]
  createdAt: number
  updatedAt: number
}

function readSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatSession[]
    if (!Array.isArray(parsed)) return []
    return parsed
  } catch {
    return []
  }
}

function writeSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(CHAT_SESSIONS_KEY, JSON.stringify(sessions))
  } catch {
    // History is best-effort; a write failure must not break the chat flow.
  }
}

export const ChatHistoryStore = {
  loadAll(): ChatSession[] {
    return readSessions().sort((a, b) => b.updatedAt - a.updatedAt)
  },

  save(session: ChatSession): void {
    const sessions = ChatHistoryStore.loadAll()
    const index = sessions.findIndex((s) => s.id === session.id)
    if (index >= 0) {
      sessions[index] = session
    } else {
      sessions.unshift(session)
    }
    writeSessions(sessions.slice(0, MAX_SESSIONS))
  },

  deleteById(id: string): void {
    writeSessions(ChatHistoryStore.loadAll().filter((s) => s.id !== id))
  },

  clearAll(): void {
    writeSessions([])
  },
}
