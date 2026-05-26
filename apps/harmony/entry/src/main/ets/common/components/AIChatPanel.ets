import { runLivoAgent, resumeLivoAgent, AgentAbortSignal, LivoAgentContinuationState, LivoAgentEvent, LivoAgentPendingConfirmation, LivoAgentRunResult } from '../agent/LivoAgentService'
import { AIAssistantSettingsStore } from '../services/AIAssistantSettingsStore'
import { AIAssistantSettings } from '../models/LivoModels'
import { ThemePalette } from '../services/ThemeService'
import { showToast } from '../utils/PageToastHelper'
import { Typewriter } from '../utils/Typewriter'
import { ChatHistoryStore, ChatMessage, ChatSession } from '../services/ChatHistoryStore'
import { AIChatPanelLayout } from './AIChatPanelLayout'
import { PendingAgentConfirmationView, ToolStatusItem, ToolTraceStatus } from './AIChatPanelTypes'
import { aiChatToolLabelOf } from './AIChatToolLabels'
import { AIChatTraceRecorder } from './AIChatTraceRecorder'
@Component
export struct AIChatPanel {
  @Prop theme: ThemePalette
  @Prop context: string = ''
  onClose: () => void = () => {}
  @State messages: ChatMessage[] = []
  @State inputContent: string = ''
  @State isLoading: boolean = false
  @State aiSettings: AIAssistantSettings | null = null
  @State showAISettings: boolean = false
  @State showHistory: boolean = false
  @State showTrace: boolean = false
  @State streamingContent: string = ''
  @State currentSessionId: string = ''
  @State editingMessageId: string = ''
  private abortSignal: AgentAbortSignal | null = null
  @State elapsedTime: string = ''
  @State timerVisible: boolean = false
  @State timerOpacity: number = 0
  @State toolStatusItems: ToolStatusItem[] = []
  @State showToolBanner: boolean = false
  @State toolBannerOpacity: number = 0
  @State pendingConfirmation: PendingAgentConfirmationView | null = null
  @State isConfirming: boolean = false
  private pendingContinuation: LivoAgentContinuationState | null = null
  private traceRecorder: AIChatTraceRecorder = new AIChatTraceRecorder()
  private scroller: Scroller = new Scroller()
  private inputController: TextAreaController = new TextAreaController()
  private typewriter: Typewriter = new Typewriter()
  private timerId: number = -1
  private timerStartMs: number = 0
  private dotsTimerId: number = -1
  aboutToAppear() {
    this.currentSessionId = Date.now().toString()
    this.loadSettings()
  }
  aboutToDisappear() {
    this.typewriter.cancel()
    this.clearTimers()
    this.saveCurrentSession()
  }
  private clearTimers(): void {
    if (this.timerId >= 0) {
      clearInterval(this.timerId)
      this.timerId = -1
    }
    if (this.dotsTimerId >= 0) {
      clearInterval(this.dotsTimerId)
      this.dotsTimerId = -1
    }
  }
  private startTimer(): void {
    this.clearTimers()
    this.timerStartMs = Date.now()
    this.elapsedTime = '0.0s'
    this.timerVisible = true
    this.timerOpacity = 1
    this.timerId = setInterval(() => {
      const elapsed = (Date.now() - this.timerStartMs) / 1000
      this.elapsedTime = elapsed.toFixed(1) + 's'
    }, 100)
  }
  private stopTimer(): void {
    if (this.timerId >= 0) {
      clearInterval(this.timerId)
      this.timerId = -1
    }
    const elapsed = (Date.now() - this.timerStartMs) / 1000
    this.elapsedTime = elapsed.toFixed(1) + 's'
    this.timerOpacity = 0
    setTimeout(() => {
      this.timerVisible = false
    }, 400)
  }
  private startDotsAnimator(): void {
    if (this.dotsTimerId >= 0) {
      clearInterval(this.dotsTimerId)
    }
    let dotCount = 0
    this.dotsTimerId = setInterval(() => {
      dotCount = (dotCount + 1) % 4
      const updateDots = '.'.repeat(dotCount)
      const currentItems = this.toolStatusItems.slice()
      const runningIndex = currentItems.findIndex((item: ToolStatusItem) => item.status === 'running')
      if (runningIndex >= 0) {
        currentItems[runningIndex].dots = updateDots
        this.toolStatusItems = currentItems
      }
    }, 400)
  }
  private stopDotsAnimator(): void {
    if (this.dotsTimerId >= 0) {
      clearInterval(this.dotsTimerId)
      this.dotsTimerId = -1
    }
  }
  private async loadSettings() {
    try {
      this.aiSettings = await AIAssistantSettingsStore.load()
    } catch (e) {
      showToast(this.getUIContext(), '加载 AI 助理设置失败', 2000)
    }
  }
  private toolTraceStatusOf(type: string): ToolTraceStatus {
    if (type === 'tool_completed') {
      return 'success'
    }
    if (type === 'tool_failed') {
      return 'failed'
    }
    if (type === 'confirmation_required') {
      return 'confirmation_required'
    }
    return 'running'
  }
  private handleAgentEvent(event: LivoAgentEvent): void {
    const key = event.toolCallId || `${event.toolName}_${Date.now()}`
    const items = this.toolStatusItems.slice()
    const index = items.findIndex((item: ToolStatusItem) => item.key === key)
    const status = this.toolTraceStatusOf(event.type)
    const next: ToolStatusItem = index >= 0 ? items[index] : {
      key,
      label: aiChatToolLabelOf(event.toolName),
      name: event.toolName,
      opacity: 1,
      dots: '',
      status,
    }
    next.status = status
    next.message = event.message || event.resultSummary
    next.argsPreview = event.args
    next.elapsedMs = event.elapsedMs
    if (status !== 'running') {
      next.dots = ''
    }
    if (index >= 0) {
      items[index] = next
    } else {
      items.push(next)
    }
    this.toolStatusItems = items
    if (!this.showToolBanner) {
      this.showToolBanner = true
    }
    this.toolBannerOpacity = 1
    if (items.some((item: ToolStatusItem) => item.status === 'running')) {
      this.startDotsAnimator()
    } else {
      this.stopDotsAnimator()
    }
  }
  private dismissToolBanner(): void {
    this.toolBannerOpacity = 0
    setTimeout(() => {
      this.showToolBanner = false
      this.toolStatusItems = []
    }, 450)
  }
  private markToolCancelled(toolCallId: string): void {
    const items = this.toolStatusItems.slice()
    const index = items.findIndex((item: ToolStatusItem) => item.key === toolCallId)
    if (index >= 0) {
      items[index].status = 'cancelled'
      items[index].dots = ''
      items[index].message = '用户取消执行'
      this.toolStatusItems = items
    }
    this.stopDotsAnimator()
  }
  private toPendingConfirmationView(pending: LivoAgentPendingConfirmation): PendingAgentConfirmationView {
    return {
      toolCallId: pending.toolCallId,
      toolName: pending.toolName,
      title: pending.confirmation.title,
      message: pending.confirmation.message,
      risk: pending.confirmation.risk,
      argsPreview: pending.confirmation.argsPreview,
    }
  }
  private async handleSend() {
    const text = this.inputContent.trim()
    if (!text) {
      return
    }
    if (this.isLoading) {
      return
    }
    if (this.pendingConfirmation) {
      showToast(this.getUIContext(), '请先处理当前确认请求', 2000)
      return
    }
    if (!this.aiSettings || !this.aiSettings.model) {
      showToast(this.getUIContext(), '请先在「设置 > AI助手」中配置 AI 接口', 2000)
      return
    }
    this.typewriter.cancel()
    this.streamingContent = ''
    if (this.editingMessageId) {
      const editIdx = this.messages.findIndex((m: ChatMessage) => m.id === this.editingMessageId)
      if (editIdx >= 0) {
        this.messages[editIdx].content = text
      }
      this.editingMessageId = ''
    } else {
      const userMsg: ChatMessage = {
        role: 'user',
        content: text,
        id: Date.now().toString()
      }
      this.messages.push(userMsg)
    }
    this.inputContent = ''
    this.isLoading = true
    this.abortSignal = { aborted: false }
    this.traceRecorder.start(text, this.currentSessionId)
    this.startTimer()
    try {
      this.inputController.stopEditing()
    } catch (e) {}
    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom)
    }, 100)
    try {
      const result = await runLivoAgent({
        prompt: text,
        aiSettings: this.aiSettings,
        history: this.messages,
        pageContext: this.context,
        abortSignal: this.abortSignal,
        onEvent: (event) => {
          this.handleAgentEvent(event)
        },
      })
      this.handleAgentRunResult(result)
    } catch (err) {
      this.isLoading = false
      this.isConfirming = false
      this.abortSignal = null
      this.editingMessageId = ''
      this.stopTimer()
      this.dismissToolBanner()
      const errMsg: ChatMessage = {
        role: 'system',
        content: err instanceof Error ? err.message : String(err),
        id: (Date.now() + 1).toString()
      }
      if (err instanceof Error && err.message.includes('取消')) {
        // Don't show error for user-initiated cancellation
      } else {
        void this.traceRecorder.saveFailed(errMsg.content)
        this.messages.push(errMsg)
      }
    } finally {
      setTimeout(() => {
        this.scroller.scrollEdge(Edge.Bottom)
      }, 100)
    }
  }
  private handleAgentRunResult(result: LivoAgentRunResult): void {
    void this.traceRecorder.saveResult(result)
    if (result.status === 'confirmation_required' && result.confirmation && result.continuation) {
      this.pendingConfirmation = this.toPendingConfirmationView(result.confirmation)
      this.pendingContinuation = result.continuation
      this.isLoading = false
      this.isConfirming = false
      this.abortSignal = null
      this.editingMessageId = ''
      this.streamingContent = ''
      this.stopTimer()
      setTimeout(() => {
        this.scroller.scrollEdge(Edge.Bottom)
      }, 100)
      return
    }

    if (result.toolRounds.length > 0) {
      setTimeout(() => {
        this.dismissToolBanner()
      }, 1200)
    }
    this.finishAssistantResponse(result.text)
  }
  private finishAssistantResponse(text: string): void {
    const assistMsgId = (Date.now() + 1).toString()
    this.isLoading = false
    this.isConfirming = false
    this.abortSignal = null
    this.editingMessageId = ''
    this.streamingContent = ''
    this.typewriter.start(text, {
      onTick: (displayed: string) => {
        this.streamingContent = displayed
      },
      onDone: () => {
        const assistMsg: ChatMessage = {
          role: 'assistant',
          content: typeof text === 'string' ? text : String(text),
          id: assistMsgId
        }
        this.messages.push(assistMsg)
        this.streamingContent = ''
        this.stopTimer()
      }
    })
  }
  private async handleConfirmPendingTool() {
    if (!this.pendingContinuation || !this.aiSettings) {
      return
    }
    const continuation = this.pendingContinuation
    this.pendingContinuation = null
    this.pendingConfirmation = null
    this.isLoading = true
    this.isConfirming = true
    this.abortSignal = { aborted: false }
    this.startTimer()
    try {
      const result = await resumeLivoAgent({
        aiSettings: this.aiSettings,
        continuation,
        abortSignal: this.abortSignal,
        onEvent: (event: LivoAgentEvent) => {
          this.handleAgentEvent(event)
        },
      })
      this.handleAgentRunResult(result)
    } catch (err) {
      this.isLoading = false
      this.isConfirming = false
      this.abortSignal = null
      this.stopTimer()
      const errMsg: ChatMessage = {
        role: 'system',
        content: err instanceof Error ? err.message : String(err),
        id: (Date.now() + 1).toString()
      }
      if (!(err instanceof Error && err.message.includes('取消'))) {
        this.messages.push(errMsg)
      }
    }
  }
  private handleCancelPendingTool(): void {
    const pending = this.pendingConfirmation
    if (!pending) {
      return
    }
    this.markToolCancelled(pending.toolCallId)
    this.pendingConfirmation = null
    this.pendingContinuation = null
    this.isConfirming = false
    const assistMsg: ChatMessage = {
      role: 'assistant',
      content: `已取消执行「${aiChatToolLabelOf(pending.toolName)}」。`,
      id: (Date.now() + 1).toString()
    }
    void this.traceRecorder.saveCancelled(pending.toolName, aiChatToolLabelOf(pending.toolName))
    this.messages.push(assistMsg)
    setTimeout(() => {
      this.dismissToolBanner()
    }, 900)
  }
  private handleStop() {
    if (this.abortSignal) {
      this.abortSignal.aborted = true
    }
    this.typewriter.cancel()
    this.streamingContent = ''
  }
  private handleSuggestionClick(text: string) {
    this.inputContent = text
    this.handleSend()
  }
  private saveCurrentSession(): void {
    if (this.messages.length === 0) {
      return
    }
    const title = this.messages.find((m: ChatMessage) => m.role === 'user')?.content.slice(0, 40) || '新对话'
    const session: ChatSession = {
      id: this.currentSessionId || Date.now().toString(),
      title,
      messages: this.messages.slice(),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    void ChatHistoryStore.save(session)
  }
  private startNewConversation(): void {
    this.saveCurrentSession()
    this.messages = []
    this.currentSessionId = Date.now().toString()
    this.streamingContent = ''
    this.editingMessageId = ''
    this.abortSignal = null
    this.pendingConfirmation = null
    this.pendingContinuation = null
    this.isConfirming = false
    this.clearTimers()
    this.elapsedTime = ''
    this.timerVisible = false
    this.timerOpacity = 0
    this.showToolBanner = false
    this.toolStatusItems = []
  }
  private loadSessionFromHistory(session: ChatSession): void {
    this.saveCurrentSession()
    this.typewriter.cancel()
    this.streamingContent = ''
    this.editingMessageId = ''
    this.messages = session.messages.slice()
    this.currentSessionId = session.id
    this.showHistory = false
    this.showTrace = false
    this.pendingConfirmation = null
    this.pendingContinuation = null
    this.isConfirming = false
    this.elapsedTime = ''
    this.timerVisible = false
    this.timerOpacity = 0
    this.showToolBanner = false
    this.toolStatusItems = []
    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom)
    }, 200)
  }
  private handleEditMessage(messageId: string): void {
    if (this.isLoading) {
      return
    }
    const msgIndex = this.messages.findIndex((m: ChatMessage) => m.id === messageId)
    if (msgIndex < 0) {
      return
    }
    const msg = this.messages[msgIndex]
    if (msg.role !== 'user') {
      return
    }
    this.inputContent = msg.content
    this.editingMessageId = msg.id
    this.messages = this.messages.slice(0, msgIndex + 1)
    this.typewriter.cancel()
    this.streamingContent = ''
    this.editingMessageId = ''
    this.abortSignal = null
    this.pendingConfirmation = null
    this.pendingContinuation = null
    this.isConfirming = false
    this.clearTimers()
    this.elapsedTime = ''
    this.timerVisible = false
    this.timerOpacity = 0
    this.showToolBanner = false
    this.toolStatusItems = []
    setTimeout(() => {
      this.inputContent = this.inputContent
    }, 100)
  }
  build() {
    AIChatPanelLayout({
      theme: this.theme,
      messages: this.messages,
      streamingContent: this.streamingContent,
      isLoading: this.isLoading,
      isConfirming: this.isConfirming,
      pendingConfirmation: this.pendingConfirmation,
      showToolBanner: this.showToolBanner,
      toolBannerOpacity: this.toolBannerOpacity,
      toolStatusItems: this.toolStatusItems,
      timerVisible: this.timerVisible,
      timerOpacity: this.timerOpacity,
      elapsedTime: this.elapsedTime,
      inputContent: $inputContent,
      showAISettings: $showAISettings,
      showHistory: $showHistory,
      showTrace: $showTrace,
      scroller: this.scroller,
      inputController: this.inputController,
      onSuggestionClick: (text: string) => { this.handleSuggestionClick(text) },
      onEditMessage: (messageId: string) => { this.handleEditMessage(messageId) },
      onSend: () => { this.handleSend() },
      onStop: () => { this.handleStop() },
      onConfirmPendingTool: () => { this.handleConfirmPendingTool() },
      onCancelPendingTool: () => { this.handleCancelPendingTool() },
      onSettingsChange: () => { void this.loadSettings() },
      onLoadSession: (session: ChatSession) => { this.loadSessionFromHistory(session) },
      onStartNewConversation: () => { this.startNewConversation() },
    })
  }
}
