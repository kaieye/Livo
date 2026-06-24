import { Bot, User } from 'lucide-react'
import type { RefObject } from 'react'
import { useTranslation } from 'react-i18next'
import { AIChatActivityBubble } from './AIChatActivityBubble'
import { AIChatConfirmationCard } from './AIChatConfirmationCard'
import { AIChatMarkdown } from './AIChatMarkdown'
import type { PendingAgentConfirmationView, ToolStatusItem } from './types'
import type { AgentRunMetrics } from '@shared'
import type { ChatMessage } from '../../store/ai-chat-store'

interface AIChatMessageListProps {
  messages: ChatMessage[]
  streamingContent: string
  toolStatusItems: ToolStatusItem[]
  pendingConfirmation: PendingAgentConfirmationView | null
  isConfirming: boolean
  isLoading: boolean
  elapsedLabel: string
  timerVisible: boolean
  lastMetrics: AgentRunMetrics | null
  suggestions: string[]
  messagesEndRef: RefObject<HTMLDivElement | null>
  onSuggestionClick: (suggestion: string) => void
  onConfirm: () => void
  onCancel: () => void
}

export function AIChatMessageList({
  messages,
  streamingContent,
  toolStatusItems,
  pendingConfirmation,
  isConfirming,
  isLoading,
  elapsedLabel,
  timerVisible,
  lastMetrics,
  suggestions,
  messagesEndRef,
  onSuggestionClick,
  onConfirm,
  onCancel,
}: AIChatMessageListProps) {
  const { t } = useTranslation()

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
      {messages.length === 0 && !streamingContent && !pendingConfirmation && (
        <div className="text-text-secondary dark:text-text-dark-secondary py-8 text-center">
          <Bot size={32} className="text-text-tertiary mx-auto mb-3" />
          <p className="text-sm font-medium">{t('aiChat.welcome')}</p>
          <p className="mt-1 text-xs">{t('aiChat.welcomeDesc')}</p>
          <div className="mt-4 space-y-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                onClick={() => onSuggestionClick(suggestion)}
                className="bg-surface-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary block w-full rounded-lg px-3 py-2 text-left text-xs transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => {
        if (msg.role === 'system') {
          return (
            <div key={msg.id} className="flex justify-center">
              <div className="max-w-[90%] whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400">
                {msg.content}
              </div>
            </div>
          )
        }
        return (
          <div
            key={msg.id}
            className={`flex gap-2.5 ${msg.role === 'user' ? 'justify-end' : ''}`}
          >
            {msg.role === 'assistant' && (
              <div className="bg-accent/10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
                <Bot size={14} className="text-accent" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-xl px-3 py-2 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-accent rounded-br-sm text-white'
                  : 'bg-surface-secondary dark:bg-surface-dark-secondary rounded-bl-sm'
              }`}
            >
              {msg.role === 'assistant' ? (
                <AIChatMarkdown content={msg.content} />
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
            </div>
            {msg.role === 'user' && (
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30">
                <User size={14} className="text-blue-500" />
              </div>
            )}
          </div>
        )
      })}

      {streamingContent && (
        <div className="flex gap-2.5">
          <div className="bg-accent/10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
            <Bot size={14} className="text-accent" />
          </div>
          <div className="bg-surface-secondary dark:bg-surface-dark-secondary max-w-[85%] rounded-xl rounded-bl-sm px-3 py-2 text-sm leading-relaxed">
            <p className="whitespace-pre-wrap">{streamingContent}</p>
            <span className="bg-accent/50 ml-0.5 inline-block h-4 w-1.5 animate-pulse" />
          </div>
        </div>
      )}

      {pendingConfirmation && (
        <AIChatConfirmationCard
          confirmation={pendingConfirmation}
          isConfirming={isConfirming}
          onConfirm={onConfirm}
          onCancel={onCancel}
        />
      )}

      {isLoading && !streamingContent && !pendingConfirmation && (
        <div className="flex gap-2.5">
          <div className="bg-accent/10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full">
            <Bot size={14} className="text-accent" />
          </div>
          <AIChatActivityBubble
            items={toolStatusItems}
            elapsedLabel={elapsedLabel}
            timerVisible={timerVisible}
            metrics={lastMetrics}
          />
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  )
}
