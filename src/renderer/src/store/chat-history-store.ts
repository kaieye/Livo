// ChatHistoryStore — 会话历史持久化（移植自 Harmony 端 services/ChatHistoryStore.ets）。
//
// Desktop 端用 localStorage 替代 Harmony 的 Preferences，保留同样的接口语义：
// 最多保留 MAX_SESSIONS 条会话，按 updatedAt 倒序返回。

import {
  sanitizeEmbeddedPersistedUrls,
  sanitizePersistedUrl,
} from '../../../shared/persisted-url-policy'

const CHAT_SESSIONS_KEY = 'livo-chat-sessions'
const MAX_SESSIONS = 50

export interface StoredChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  timestamp: number
  citations?: AIChatCitation[]
}

export interface AIChatCitation {
  documentId?: string
  chunkId?: string
  title: string
  url?: string | null
  sourceTitle?: string | null
  category?: string | null
  publishedAt?: string | null
  snippet?: string
  score?: number
}

export interface ChatSession {
  id: string
  title: string
  messages: StoredChatMessage[]
  createdAt: number
  updatedAt: number
}

function sanitizeCitationForChatHistory(
  citation: AIChatCitation,
): AIChatCitation {
  return {
    ...citation,
    url: citation.url ? sanitizePersistedUrl(citation.url) : citation.url,
    snippet: citation.snippet
      ? sanitizeEmbeddedPersistedUrls(citation.snippet)
      : citation.snippet,
  }
}

function sanitizeMessageForChatHistory(
  message: StoredChatMessage,
): StoredChatMessage {
  return {
    ...message,
    content: sanitizeEmbeddedPersistedUrls(message.content),
    citations: message.citations?.map(sanitizeCitationForChatHistory),
  }
}

function sanitizeSessionForChatHistory(session: ChatSession): ChatSession {
  return {
    ...session,
    title: sanitizeEmbeddedPersistedUrls(session.title),
    messages: session.messages.map(sanitizeMessageForChatHistory),
  }
}

function sanitizeSessionsForChatHistory(
  sessions: ChatSession[],
): ChatSession[] {
  return sessions.map(sanitizeSessionForChatHistory)
}

function readSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(CHAT_SESSIONS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as ChatSession[]
    if (!Array.isArray(parsed)) return []
    const sanitized = sanitizeSessionsForChatHistory(parsed)
    const sanitizedRaw = JSON.stringify(sanitized)
    if (raw !== sanitizedRaw) {
      localStorage.setItem(CHAT_SESSIONS_KEY, sanitizedRaw)
    }
    return sanitized
  } catch {
    return []
  }
}

function writeSessions(sessions: ChatSession[]): void {
  try {
    localStorage.setItem(
      CHAT_SESSIONS_KEY,
      JSON.stringify(sanitizeSessionsForChatHistory(sessions)),
    )
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
