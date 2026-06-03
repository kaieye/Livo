import { useCallback, useEffect, useState } from 'react'
import { X, Trash2, MessageSquare, Plus } from 'lucide-react'
import {
  ChatHistoryStore,
  type ChatSession,
} from '../../store/chat-history-store'

interface Props {
  currentSessionId: string
  onClose: () => void
  onSelect: (session: ChatSession) => void
  onNewConversation: () => void
}

function formatTime(timestamp: number): string {
  if (timestamp <= 0) return ''
  const date = new Date(timestamp)
  const pad = (n: number) => `${n}`.padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/**
 * Saved-conversation list. Loads persisted sessions from ChatHistoryStore and
 * lets the user resume, delete, or start a new conversation.
 */
export function AIChatHistoryPanel({
  currentSessionId,
  onClose,
  onSelect,
  onNewConversation,
}: Props) {
  const [sessions, setSessions] = useState<ChatSession[]>([])

  const load = useCallback(() => {
    setSessions(ChatHistoryStore.loadAll())
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const remove = useCallback(
    (id: string) => {
      ChatHistoryStore.deleteById(id)
      load()
    },
    [load],
  )

  return (
    <div className="dark:bg-surface-dark absolute inset-0 z-10 flex flex-col overflow-hidden rounded-2xl bg-white">
      <div className="flex flex-shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare size={16} className="text-accent" />
          <span className="text-sm font-medium">对话历史</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              onNewConversation()
              load()
            }}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
            title="新对话"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={onClose}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <MessageSquare size={28} className="text-text-tertiary" />
            <p className="text-sm font-medium">暂无历史对话</p>
            <p className="text-text-secondary text-xs">
              对话会在关闭面板或开始新对话时自动保存
            </p>
          </div>
        ) : (
          sessions.map((session) => (
            <div
              key={session.id}
              onClick={() => onSelect(session)}
              className={`group flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2.5 ${
                session.id === currentSessionId
                  ? 'border-accent/40 bg-accent/5'
                  : 'hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary border-transparent'
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium">
                  {session.title}
                </p>
                <p className="text-text-tertiary mt-0.5 text-[11px]">
                  {session.messages.length} 条 · {formatTime(session.updatedAt)}
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  remove(session.id)
                }}
                className="text-text-tertiary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary rounded-lg p-1.5 opacity-0 hover:text-red-500 group-hover:opacity-100"
                title="删除"
              >
                <Trash2 size={13} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
