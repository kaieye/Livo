import { useState, useRef, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useAIChatStore } from '../../store/ai-chat-store'
import { useEntryStore } from '../../store/entry-store'
import {
  X,
  Send,
  Square,
  Trash2,
  Bot,
  User,
  GripHorizontal,
  ListTree,
  History,
  Plus,
} from 'lucide-react'
import { useOverlayHotkeyScope } from '../../hooks/useHotkeyScope'
import { useOverlayStackItem } from '../../store/overlay-stack-store'
import { AIChatConfirmationCard } from './AIChatConfirmationCard'
import { AIChatTracePanel } from './AIChatTracePanel'
import { AIChatHistoryPanel } from './AIChatHistoryPanel'
import { AIChatMarkdown } from './AIChatMarkdown'
import { AIChatActivityBubble } from './AIChatActivityBubble'

const STORAGE_KEY = 'ai-chat-panel-ratio'

// Ratio-based state: position and size as fractions of window
interface PanelRatio {
  rx: number // left as ratio of window width
  ry: number // top as ratio of window height
  rw: number // width as ratio of window width
  rh: number // height as ratio of window height
}

// Absolute pixel limits
const MIN_WIDTH = 360
const MIN_HEIGHT = 400
const MAX_WIDTH = 800
const MAX_HEIGHT = 900
const MARGIN = 20

function loadRatio(): PanelRatio | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return JSON.parse(raw)
  } catch {
    /* ignore */
  }
  return null
}

function saveRatio(ratio: PanelRatio) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ratio))
}

function getDefaultRatio(): PanelRatio {
  const w = window.innerWidth
  const h = window.innerHeight
  const pw = Math.min(Math.max(480, w * 0.3), MAX_WIDTH)
  const ph = Math.min(Math.max(640, h * 0.7), MAX_HEIGHT)
  return {
    rx: (w - pw - MARGIN) / w,
    ry: (h - ph - MARGIN) / h,
    rw: pw / w,
    rh: ph / h,
  }
}

// Convert ratio to clamped pixel values
function ratioToPixels(r: PanelRatio) {
  const ww = window.innerWidth
  const wh = window.innerHeight
  const width = Math.round(
    Math.min(
      Math.max(r.rw * ww, MIN_WIDTH),
      Math.min(MAX_WIDTH, ww - MARGIN * 2),
    ),
  )
  const height = Math.round(
    Math.min(
      Math.max(r.rh * wh, MIN_HEIGHT),
      Math.min(MAX_HEIGHT, wh - MARGIN * 2),
    ),
  )
  const x = Math.round(Math.max(0, Math.min(r.rx * ww, ww - width)))
  const y = Math.round(Math.max(0, Math.min(r.ry * wh, wh - height)))
  return { x, y, width, height }
}

function pixelsToRatio(
  x: number,
  y: number,
  width: number,
  height: number,
): PanelRatio {
  const ww = window.innerWidth
  const wh = window.innerHeight
  return { rx: x / ww, ry: y / wh, rw: width / ww, rh: height / wh }
}

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
  const panelRef = useRef<HTMLDivElement>(null)

  const [ratio, setRatio] = useState<PanelRatio>(
    () => loadRatio() || getDefaultRatio(),
  )
  const ratioRef = useRef(ratio)
  useEffect(() => {
    ratioRef.current = ratio
  }, [ratio])

  // Force re-render on window resize so pixels recalculate
  const [, setTick] = useState(0)
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const pixels = ratioToPixels(ratio)

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

  // Drag handler
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    const panel = panelRef.current
    if (!panel) return

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startPixels = ratioToPixels(ratioRef.current)
    const startLeft = startPixels.x
    const startTop = startPixels.y
    const panelW = startPixels.width

    panel.style.transition = 'none'
    panel.style.animation = 'none'
    panel.style.willChange = 'transform'

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const newX = Math.max(
        0,
        Math.min(startLeft + dx, window.innerWidth - panelW),
      )
      const newY = Math.max(
        0,
        Math.min(startTop + dy, window.innerHeight - startPixels.height),
      )
      panel.style.transform = `translate(${newX - startLeft}px, ${newY - startTop}px)`
    }

    const onUp = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const newX = Math.max(
        0,
        Math.min(startLeft + dx, window.innerWidth - panelW),
      )
      const newY = Math.max(
        0,
        Math.min(startTop + dy, window.innerHeight - startPixels.height),
      )

      panel.style.left = `${newX}px`
      panel.style.top = `${newY}px`
      panel.style.transform = 'none'
      panel.style.willChange = ''

      const newRatio = pixelsToRatio(
        newX,
        newY,
        startPixels.width,
        startPixels.height,
      )
      ratioRef.current = newRatio
      setRatio(newRatio)
      saveRatio(newRatio)

      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
  }, [])

  // Resize handler
  const handleResizeMouseDown = useCallback((e: React.MouseEvent) => {
    const panel = panelRef.current
    if (!panel) return

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startPixels = ratioToPixels(ratioRef.current)

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const maxW = Math.min(MAX_WIDTH, window.innerWidth - startPixels.x)
      const maxH = Math.min(MAX_HEIGHT, window.innerHeight - startPixels.y)
      const newW = Math.min(Math.max(startPixels.width + dx, MIN_WIDTH), maxW)
      const newH = Math.min(Math.max(startPixels.height + dy, MIN_HEIGHT), maxH)
      panel.style.width = `${newW}px`
      panel.style.height = `${newH}px`
    }

    const onUp = () => {
      const finalW = parseInt(panel.style.width) || startPixels.width
      const finalH = parseInt(panel.style.height) || startPixels.height
      const newRatio = pixelsToRatio(
        startPixels.x,
        startPixels.y,
        finalW,
        finalH,
      )
      ratioRef.current = newRatio
      setRatio(newRatio)
      saveRatio(newRatio)

      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
    e.preventDefault()
    e.stopPropagation()
  }, [])

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

      {/* Messages */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && !streamingContent && !pendingConfirmation && (
          <div className="text-text-secondary dark:text-text-dark-secondary py-8 text-center">
            <Bot size={32} className="text-text-tertiary mx-auto mb-3" />
            <p className="text-sm font-medium">{t('aiChat.welcome')}</p>
            <p className="mt-1 text-xs">{t('aiChat.welcomeDesc')}</p>
            <div className="mt-4 space-y-2">
              {[
                t('aiChat.suggestion1'),
                t('aiChat.suggestion2'),
                t('aiChat.suggestion3'),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => handleSuggestionClick(suggestion)}
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

        {/* Streaming content (typewriter) */}
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

        {/* Pending confirmation card */}
        {pendingConfirmation && (
          <AIChatConfirmationCard
            confirmation={pendingConfirmation}
            isConfirming={isConfirming}
            onConfirm={() => void confirmPending()}
            onCancel={cancelPending}
          />
        )}

        {/* 临时展示 Agent 执行过程；最终回答开始输出时自动让位给回答气泡。 */}
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

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex-shrink-0 border-t p-3">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('aiChat.inputPlaceholder')}
            rows={1}
            disabled={!!pendingConfirmation}
            className="bg-surface-secondary focus:ring-accent/50 dark:bg-surface-dark-secondary max-h-[120px] flex-1 resize-none rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 disabled:opacity-50"
            style={{
              height: 'auto',
              minHeight: '36px',
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = 'auto'
              target.style.height = Math.min(target.scrollHeight, 120) + 'px'
            }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={stop}
              className="bg-surface-secondary text-text-secondary hover:bg-surface-tertiary dark:bg-surface-dark-secondary dark:hover:bg-surface-dark-tertiary self-end rounded-lg p-2 transition-colors"
              title={t('aiChat.stop')}
            >
              <Square size={16} />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim() || !!pendingConfirmation}
              className="bg-accent hover:bg-accent-hover self-end rounded-lg p-2 text-white transition-colors disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          )}
        </div>
      </form>

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
