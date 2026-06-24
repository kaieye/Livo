import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChatStore } from '../../store/ai-chat-store'
import { useEntryStore } from '../../store/entry-store'
import {
  X,
  Trash2,
  Bot,
  GripHorizontal,
  ListTree,
  History,
  Plus,
} from 'lucide-react'
import { useOverlayHotkeyScope } from '../../hooks/useHotkeyScope'
import { useOverlayStackItem } from '../../store/overlay-stack-store'
import { AIChatTracePanel } from './AIChatTracePanel'
import { AIChatHistoryPanel } from './AIChatHistoryPanel'
import { AIChatComposer } from './AIChatComposer'
import { AIChatMessageList } from './AIChatMessageList'
import { useAIChatPanelGeometry } from './useAIChatPanelGeometry'

export function AIChatPanel() {
  const {
    messages,
    isLoading,
    isConfirming,
    streamingContent,
    toolStatusItems,
    pendingConfirmation,
    elapsedLabel,
    timerVisible,
    lastMetrics,
    currentSessionId,
    isPanelOpen,
    sendMessage,
    confirmPending,
    cancelPending,
    stop,
    clearMessages,
    newConversation,
    loadSession,
    setPanelOpen,
  } = useAIChatStore()
  useOverlayHotkeyScope('ai-chat', isPanelOpen)
  const { zIndex, isTop } = useOverlayStackItem('ai-chat', isPanelOpen)
  const selectedEntry = useEntryStore((s) => s.selectedEntry)
  const [input, setInput] = useState('')
  const [showTrace, setShowTrace] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const { t } = useTranslation()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const { panelRef, pixels, handleHeaderMouseDown, handleResizeMouseDown } =
    useAIChatPanelGeometry()

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent, toolStatusItems, pendingConfirmation])

  // Auto focus input when panel opens
  useEffect(() => {
    if (isPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isPanelOpen])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading || pendingConfirmation) return

    const context = selectedEntry?.content || selectedEntry?.summary || ''
    sendMessage(input.trim(), context)
    setInput('')
  }

  const handleSuggestionClick = useCallback(
    (suggestion: string) => {
      if (isLoading || pendingConfirmation) return

      const context = selectedEntry?.content || selectedEntry?.summary || ''
      void sendMessage(suggestion, context)
      setInput('')
    },
    [isLoading, pendingConfirmation, selectedEntry, sendMessage],
  )

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
    if (e.key === 'Escape') {
      if (!isTop) return
      setPanelOpen(false)
    }
  }

  if (!isPanelOpen) return null

  const suggestions = [
    t('aiChat.suggestion1'),
    t('aiChat.suggestion2'),
    t('aiChat.suggestion3'),
  ]

  return (
    <div
      ref={panelRef}
      className="animate-in zoom-in-95 slide-in-from-bottom-4 dark:bg-surface-dark fixed flex flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl duration-200"
      style={{
        zIndex,
        left: pixels.x,
        top: pixels.y,
        width: pixels.width,
        height: pixels.height,
      }}
    >
      {/* Header - Draggable area */}
      <div
        data-drag-handle
        className="bg-surface-secondary/50 dark:bg-surface-dark-secondary/50 flex flex-shrink-0 cursor-grab select-none items-center justify-between border-b px-4 py-3 active:cursor-grabbing"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-text-tertiary" />
          <Bot size={18} className="text-accent" />
          <span className="text-sm font-medium">{t('aiChat.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              newConversation()
            }}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
            title={t('aiChat.newConversation')}
          >
            <Plus size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowHistory(true)
            }}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
            title={t('aiChat.history')}
          >
            <History size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setShowTrace(true)
            }}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
            title={t('aiChat.trace')}
          >
            <ListTree size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              clearMessages()
            }}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
            title={t('aiChat.clearChat')}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPanelOpen(false)
            }}
            className="text-text-secondary hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary rounded-lg p-1.5"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Context indicator */}
      {selectedEntry && (
        <div className="bg-accent/5 text-text-secondary dark:text-text-dark-secondary flex-shrink-0 truncate border-b px-4 py-2 text-xs">
          {t('aiChat.currentlyReading')}:{' '}
          <span className="text-text dark:text-text-dark-primary font-medium">
            {selectedEntry.title}
          </span>
        </div>
      )}

      <AIChatMessageList
        messages={messages}
        streamingContent={streamingContent}
        toolStatusItems={toolStatusItems}
        pendingConfirmation={pendingConfirmation}
        isConfirming={isConfirming}
        isLoading={isLoading}
        elapsedLabel={elapsedLabel}
        timerVisible={timerVisible}
        lastMetrics={lastMetrics}
        suggestions={suggestions}
        messagesEndRef={messagesEndRef}
        onSuggestionClick={handleSuggestionClick}
        onConfirm={() => void confirmPending()}
        onCancel={cancelPending}
      />

      <AIChatComposer
        input={input}
        inputRef={inputRef}
        isLoading={isLoading}
        disabled={!!pendingConfirmation}
        onInputChange={setInput}
        onSubmit={handleSubmit}
        onKeyDown={handleKeyDown}
        onStop={stop}
      />

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="group absolute bottom-0 right-0 h-6 w-6 cursor-nwse-resize"
        style={{
          background:
            'linear-gradient(135deg, transparent 50%, currentColor 50%)',
          backgroundSize: '12px 12px',
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'bottom right',
        }}
      >
        <div className="absolute bottom-1 right-1 h-4 w-4 opacity-0 transition-opacity group-hover:opacity-100">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="text-text-tertiary h-full w-full"
          >
            <path
              d="M21 15l-6-6M21 9l-2-2"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>

      {/* Trace / history overlays */}
      {showTrace && <AIChatTracePanel onClose={() => setShowTrace(false)} />}
      {showHistory && (
        <AIChatHistoryPanel
          currentSessionId={currentSessionId}
          onClose={() => setShowHistory(false)}
          onSelect={(session) => {
            loadSession(session)
            setShowHistory(false)
          }}
          onNewConversation={newConversation}
        />
      )}
    </div>
  )
}
