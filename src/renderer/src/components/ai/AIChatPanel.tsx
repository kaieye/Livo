import { useState, useRef, useEffect } from "react"
import { useTranslation } from "react-i18next"
import { useAIChatStore } from "../../store/ai-chat-store"
import { useEntryStore } from "../../store/entry-store"
import { X, Send, Trash2, Loader2, Bot, User } from "lucide-react"

export function AIChatPanel() {
  const { messages, isLoading, currentStreamContent, sendMessage, clearMessages, setPanelOpen } = useAIChatStore()
  const selectedEntry = useEntryStore((s) => s.selectedEntry)
  const [input, setInput] = useState("")
  const { t } = useTranslation()
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, currentStreamContent])

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
  }

  return (
    <div className="w-[380px] min-w-[320px] border-l flex flex-col bg-white dark:bg-surface-dark">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <Bot size={18} className="text-accent" />
          <span className="font-medium text-sm">{t("aiChat.title")}</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={clearMessages}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary text-text-secondary"
            title={t("aiChat.clearChat")}
          >
            <Trash2 size={14} />
          </button>
          <button
            onClick={() => setPanelOpen(false)}
            className="p-1.5 rounded-lg hover:bg-surface-secondary dark:hover:bg-surface-dark-secondary text-text-secondary"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Context indicator */}
      {selectedEntry && (
        <div className="px-4 py-2 bg-accent/5 text-xs text-text-secondary dark:text-text-dark-secondary border-b">
                    {t("aiChat.currentlyReading")}: <span className="font-medium text-text dark:text-text-dark-primary">{selectedEntry.title}</span>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
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
      <form onSubmit={handleSubmit} className="border-t p-3">
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
    </div>
  )
}
