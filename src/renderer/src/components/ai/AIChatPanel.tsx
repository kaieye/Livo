import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { useAIChatStore } from "../../store/ai-chat-store"
import { useEntryStore } from "../../store/entry-store"
import { X, Send, Trash2, Loader2, Bot, User, GripHorizontal } from "lucide-react"
import { useOverlayHotkeyScope } from "../../hooks/useHotkeyScope"

const STORAGE_KEY = "ai-chat-panel-ratio"

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
  } catch { /* ignore */ }
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
  const width = Math.round(Math.min(Math.max(r.rw * ww, MIN_WIDTH), Math.min(MAX_WIDTH, ww - MARGIN * 2)))
  const height = Math.round(Math.min(Math.max(r.rh * wh, MIN_HEIGHT), Math.min(MAX_HEIGHT, wh - MARGIN * 2)))
  const x = Math.round(Math.max(0, Math.min(r.rx * ww, ww - width)))
  const y = Math.round(Math.max(0, Math.min(r.ry * wh, wh - height)))
  return { x, y, width, height }
}

function pixelsToRatio(x: number, y: number, width: number, height: number): PanelRatio {
  const ww = window.innerWidth
  const wh = window.innerHeight
  return { rx: x / ww, ry: y / wh, rw: width / ww, rh: height / wh }
}

export function AIChatPanel() {
  const { messages, isLoading, currentStreamContent, isPanelOpen, sendMessage, clearMessages, setPanelOpen } = useAIChatStore()
  useOverlayHotkeyScope("ai-chat", isPanelOpen)
  const selectedEntry = useEntryStore((s) => s.selectedEntry)
  const [input, setInput] = useState("")
  const { t } = useTranslation()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const [ratio, setRatio] = useState<PanelRatio>(() => loadRatio() || getDefaultRatio())
  const ratioRef = useRef(ratio)
  useEffect(() => { ratioRef.current = ratio }, [ratio])

  // Force re-render on window resize so pixels recalculate
  const [, setTick] = useState(0)
  useEffect(() => {
    const onResize = () => setTick((t) => t + 1)
    window.addEventListener("resize", onResize)
    return () => window.removeEventListener("resize", onResize)
  }, [])

  const pixels = ratioToPixels(ratio)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, currentStreamContent])

  // Auto focus input when panel opens
  useEffect(() => {
    if (isPanelOpen) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isPanelOpen])

  // Drag handler
  const handleHeaderMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return
    const panel = panelRef.current
    if (!panel) return

    const startMouseX = e.clientX
    const startMouseY = e.clientY
    const startPixels = ratioToPixels(ratioRef.current)
    const startLeft = startPixels.x
    const startTop = startPixels.y
    const panelW = startPixels.width

    panel.style.transition = "none"
    panel.style.animation = "none"
    panel.style.willChange = "transform"

    const onMove = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const newX = Math.max(0, Math.min(startLeft + dx, window.innerWidth - panelW))
      const newY = Math.max(0, Math.min(startTop + dy, window.innerHeight - startPixels.height))
      panel.style.transform = `translate(${newX - startLeft}px, ${newY - startTop}px)`
    }

    const onUp = (ev: MouseEvent) => {
      const dx = ev.clientX - startMouseX
      const dy = ev.clientY - startMouseY
      const newX = Math.max(0, Math.min(startLeft + dx, window.innerWidth - panelW))
      const newY = Math.max(0, Math.min(startTop + dy, window.innerHeight - startPixels.height))

      panel.style.left = `${newX}px`
      panel.style.top = `${newY}px`
      panel.style.transform = "none"
      panel.style.willChange = ""

      const newRatio = pixelsToRatio(newX, newY, startPixels.width, startPixels.height)
      ratioRef.current = newRatio
      setRatio(newRatio)
      saveRatio(newRatio)

      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "grabbing"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
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
      const newRatio = pixelsToRatio(startPixels.x, startPixels.y, finalW, finalH)
      ratioRef.current = newRatio
      setRatio(newRatio)
      saveRatio(newRatio)

      document.removeEventListener("mousemove", onMove)
      document.removeEventListener("mouseup", onUp)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }

    document.body.style.cursor = "nwse-resize"
    document.body.style.userSelect = "none"
    document.addEventListener("mousemove", onMove)
    document.addEventListener("mouseup", onUp)
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || isLoading) return

    const context = selectedEntry?.content || selectedEntry?.summary || ""
    sendMessage(input.trim(), context)
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
    if (e.key === "Escape") {
      setPanelOpen(false)
    }
  }

  if (!isPanelOpen) return null

  return (
    <div
      ref={panelRef}
      className="fixed z-[60] bg-white dark:bg-surface-dark rounded-2xl shadow-2xl border animate-in zoom-in-95 slide-in-from-bottom-4 duration-200 flex flex-col overflow-hidden"
      style={{
        left: pixels.x,
        top: pixels.y,
        width: pixels.width,
        height: pixels.height,
      }}
    >
      {/* Header - Draggable area */}
      <div
        data-drag-handle
        className="flex items-center justify-between px-4 py-3 border-b bg-surface-secondary/50 dark:bg-surface-dark-secondary/50 cursor-grab active:cursor-grabbing select-none flex-shrink-0"
        onMouseDown={handleHeaderMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripHorizontal size={14} className="text-text-tertiary" />
          <Bot size={18} className="text-accent" />
          <span className="font-medium text-sm">{t("aiChat.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => {
              e.stopPropagation()
              clearMessages()
            }}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary text-text-secondary"
            title={t("aiChat.clearChat")}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation()
              setPanelOpen(false)
            }}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary text-text-secondary"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Context indicator */}
      {selectedEntry && (
        <div className="px-4 py-2 bg-accent/5 text-xs text-text-secondary dark:text-text-dark-secondary border-b truncate flex-shrink-0">
          {t("aiChat.currentlyReading")}: <span className="font-medium text-text dark:text-text-dark-primary">{selectedEntry.title}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0">
        {messages.length === 0 && !currentStreamContent && (
          <div className="text-center text-text-secondary dark:text-text-dark-secondary py-8">
            <Bot size={32} className="mx-auto mb-3 text-text-tertiary" />
            <p className="text-sm font-medium">{t("aiChat.welcome")}</p>
            <p className="text-xs mt-1">{t("aiChat.welcomeDesc")}</p>
            <div className="mt-4 space-y-2">
              {[
                t("aiChat.suggestion1"),
                t("aiChat.suggestion2"),
                t("aiChat.suggestion3"),
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setInput(suggestion)
                    inputRef.current?.focus()
                  }}
                  className="block w-full text-left text-xs px-3 py-2 rounded-lg bg-surface-secondary dark:bg-surface-dark-secondary hover:bg-surface-tertiary dark:hover:bg-surface-dark-tertiary transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : ""}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
                <Bot size={14} className="text-accent" />
              </div>
            )}
            <div
              className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-accent text-white rounded-br-sm"
                  : "bg-surface-secondary dark:bg-surface-dark-secondary rounded-bl-sm"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
            </div>
            {msg.role === "user" && (
              <div className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                <User size={14} className="text-blue-500" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming content */}
        {currentStreamContent && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-accent" />
            </div>
            <div className="max-w-[85%] px-3 py-2 rounded-xl rounded-bl-sm bg-surface-secondary dark:bg-surface-dark-secondary text-sm leading-relaxed">
              <p className="whitespace-pre-wrap">{currentStreamContent}</p>
              <span className="inline-block w-1.5 h-4 bg-accent/50 animate-pulse ml-0.5" />
            </div>
          </div>
        )}

        {isLoading && !currentStreamContent && (
          <div className="flex gap-2.5">
            <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center flex-shrink-0">
              <Bot size={14} className="text-accent" />
            </div>
            <div className="px-3 py-2 rounded-xl rounded-bl-sm bg-surface-secondary dark:bg-surface-dark-secondary">
              <Loader2 size={16} className="animate-spin text-accent" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t p-3 flex-shrink-0">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("aiChat.inputPlaceholder")}
            rows={1}
            className="flex-1 px-3 py-2 rounded-lg border bg-surface-secondary dark:bg-surface-dark-secondary text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/50 max-h-[120px]"
            style={{
              height: "auto",
              minHeight: "36px",
            }}
            onInput={(e) => {
              const target = e.target as HTMLTextAreaElement
              target.style.height = "auto"
              target.style.height = Math.min(target.scrollHeight, 120) + "px"
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || isLoading}
            className="p-2 rounded-lg bg-accent text-white hover:bg-accent-hover transition-colors disabled:opacity-40 self-end"
          >
            <Send size={16} />
          </button>
        </div>
      </form>

      {/* Resize handle */}
      <div
        onMouseDown={handleResizeMouseDown}
        className="absolute bottom-0 right-0 w-6 h-6 cursor-nwse-resize group"
        style={{
          background: "linear-gradient(135deg, transparent 50%, currentColor 50%)",
          backgroundSize: "12px 12px",
          backgroundRepeat: "no-repeat",
          backgroundPosition: "bottom right",
        }}
      >
        <div className="absolute bottom-1 right-1 w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="w-full h-full text-text-tertiary">
            <path d="M21 15l-6-6M21 9l-2-2" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </div>
      </div>
    </div>
  )
}
