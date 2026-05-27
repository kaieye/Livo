import { loadJsonArray, saveJsonArray } from './PreferenceStoreAccessor'

const CHAT_SESSIONS_KEY = 'chatSessions'
const MAX_SESSIONS = 50

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  id: string
  reasoning_content?: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

async function persistSessionsQuietly(sessions: ChatSession[]): Promise<void> {
  try {
    await saveJsonArray(CHAT_SESSIONS_KEY, sessions, '保存对话失败')
  } catch (_e) {
    // Silently ignore save errors to avoid disrupting the chat UX
  }
}

export class ChatHistoryStore {
  static async loadAll(): Promise<ChatSession[]> {
    const sessions = await loadJsonArray<ChatSession>(CHAT_SESSIONS_KEY)
    return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
  }

  static async save(session: ChatSession): Promise<void> {
    const sessions = await ChatHistoryStore.loadAll()
    const idx = sessions.findIndex((s: ChatSession) => s.id === session.id)
    if (idx >= 0) {
      sessions[idx] = session
    } else {
      sessions.unshift(session)
    }
    const trimmed = sessions.slice(0, MAX_SESSIONS)
    await persistSessionsQuietly(trimmed)
  }

  static async deleteById(id: string): Promise<void> {
    const sessions = await ChatHistoryStore.loadAll()
    const filtered = sessions.filter((s: ChatSession) => s.id !== id)
    await persistSessionsQuietly(filtered)
  }

  static async clearAll(): Promise<void> {
    await persistSessionsQuietly([])
  }
}
