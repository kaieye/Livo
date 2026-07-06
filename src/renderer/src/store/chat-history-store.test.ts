import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ChatSession } from './chat-history-store'

const CHAT_SESSIONS_KEY = 'livo-chat-sessions'

function createMemoryStorage(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial))
  return {
    get length() {
      return entries.size
    },
    clear: vi.fn(() => entries.clear()),
    getItem: vi.fn((key: string) => entries.get(key) ?? null),
    key: vi.fn((index: number) => Array.from(entries.keys())[index] ?? null),
    removeItem: vi.fn((key: string) => {
      entries.delete(key)
    }),
    setItem: vi.fn((key: string, value: string) => {
      entries.set(key, value)
    }),
  }
}

function makeSession(): ChatSession {
  return {
    id: 'session-1',
    title: 'Read https://user:pass@example.com/feed.xml?token=raw-title&ok=1',
    messages: [
      {
        id: 'msg-1',
        role: 'user',
        content:
          'Please inspect https://user:pass@example.com/article?access_token=raw-message&ok=1.',
        timestamp: 1000,
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Found a citation.',
        timestamp: 2000,
        citations: [
          {
            title: 'Private source',
            url: 'https://cdn.example.com/source?X-Amz-Signature=raw-citation&view=1',
            snippet:
              'Quoted from https://example.com/snippet?client_secret=raw-snippet&keep=1)',
          },
        ],
      },
    ],
    createdAt: 1000,
    updatedAt: 2000,
  }
}

async function loadChatHistoryStore(initial: Record<string, string> = {}) {
  vi.resetModules()
  const storage = createMemoryStorage(initial)
  vi.stubGlobal('localStorage', storage)
  const mod = await import('./chat-history-store')
  return { ...mod, storage }
}

describe('ChatHistoryStore persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('removes secret URL components before persisting chat sessions', async () => {
    const { ChatHistoryStore, storage } = await loadChatHistoryStore()
    const session = makeSession()

    ChatHistoryStore.save(session)

    const rawPayload = storage.getItem(CHAT_SESSIONS_KEY) || ''
    expect(rawPayload).not.toContain('raw-')
    expect(rawPayload).not.toContain('user:pass')
    const persisted = JSON.parse(rawPayload) as ChatSession[]
    expect(persisted[0].title).toBe('Read https://example.com/feed.xml?ok=1')
    expect(persisted[0].messages[0].content).toBe(
      'Please inspect https://example.com/article?ok=1.',
    )
    expect(persisted[0].messages[1].citations?.[0].url).toBe(
      'https://cdn.example.com/source?view=1',
    )
    expect(persisted[0].messages[1].citations?.[0].snippet).toBe(
      'Quoted from https://example.com/snippet?keep=1)',
    )
    expect(session.messages[0].content).toContain('raw-message')
  })

  it('sanitizes legacy chat sessions during hydration', async () => {
    const { ChatHistoryStore, storage } = await loadChatHistoryStore({
      [CHAT_SESSIONS_KEY]: JSON.stringify([makeSession()]),
    })

    const sessions = ChatHistoryStore.loadAll()

    expect(sessions[0].messages[0].content).toBe(
      'Please inspect https://example.com/article?ok=1.',
    )
    expect(storage.getItem(CHAT_SESSIONS_KEY)).not.toContain('raw-')
    expect(storage.getItem(CHAT_SESSIONS_KEY)).not.toContain('user:pass')
  })
})
