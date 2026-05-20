import { PreferenceStoreAccessor } from './PreferenceStoreAccessor'

const CHAT_SESSIONS_KEY = 'chatSessions'
const MAX_SESSIONS = 50

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  id: string
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export class ChatHistoryStore {
  static async loadAll(): Promise<ChatSession[]> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
      const raw = await pref.get(CHAT_SESSIONS_KEY, '[]') as string
      const sessions: ChatSession[] = JSON.parse(raw)
      return sessions.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch (e) {
      return []
    }
  }

  static async save(session: ChatSession): Promise<void> {
    try {
      const sessions = await ChatHistoryStore.loadAll()
      const idx = sessions.findIndex((s: ChatSession) => s.id === session.id)
      if (idx >= 0) {
        sessions[idx] = session
      } else {
        sessions.unshift(session)
      }
      const trimmed = sessions.slice(0, MAX_SESSIONS)
      const pref = await PreferenceStoreAccessor.getPreferences()
      await pref.put(CHAT_SESSIONS_KEY, JSON.stringify(trimmed))
      await pref.flush()
    } catch (e) {
      // Silently ignore save errors to avoid disrupting the chat UX
    }
  }

  static async deleteById(id: string): Promise<void> {
    try {
      const sessions = await ChatHistoryStore.loadAll()
      const filtered = sessions.filter((s: ChatSession) => s.id !== id)
      const pref = await PreferenceStoreAccessor.getPreferences()
      await pref.put(CHAT_SESSIONS_KEY, JSON.stringify(filtered))
      await pref.flush()
    } catch (e) {
      // Silently ignore
    }
  }

  static async clearAll(): Promise<void> {
    try {
      const pref = await PreferenceStoreAccessor.getPreferences()
      await pref.put(CHAT_SESSIONS_KEY, '[]')
      await pref.flush()
    } catch (e) {
      // Silently ignore
    }
  }
}
