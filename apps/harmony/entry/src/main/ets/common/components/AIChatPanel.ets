import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationMenuContentOptions,
  HdsNavigationTitleMode,
  BlurStrategy,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { runChatAgent, AgentRoundDetail, AgentAbortSignal } from '../services/AIChatAgentService'
import { AIAssistantSettingsStore } from '../services/AIAssistantSettingsStore'
import { AIAssistantSettings, HarmonySettings } from '../models/LivoModels'
import { ThemePalette } from '../services/ThemeService'
import { showToast } from '../utils/PageToastHelper'
import { AIAssistantSettingsPanel } from './AIAssistantSettingsPanel'
import { AIChatHistoryPanel } from './AIChatHistoryPanel'
import { Typewriter } from '../utils/Typewriter'
import { ChatHistoryStore, ChatMessage, ChatSession } from '../services/ChatHistoryStore'
import { parseMarkdown, MdLine, MdLineKind, MdSpan } from '../utils/MarkdownParser'

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
    const items = this.toolStatusItems
    if (items.length > 0) {
      items[items.length - 1].dots = ''
    }
    this.dotsTimerId = setInterval(() => {
      dotCount = (dotCount + 1) % 4
      const updateDots = '.'.repeat(dotCount)
      const currentItems = this.toolStatusItems
      if (currentItems.length > 0) {
        currentItems[currentItems.length - 1].dots = updateDots
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

  private pushToolStatus(name: string): void {
    const label = this.toolLabelOf(name)
    const key = `${name}_${Date.now()}`
    const item: ToolStatusItem = {
      key: key,
      label: label,
      name: name,
      opacity: 1,
      dots: '',
      done: false,
    }
    this.toolStatusItems.push(item)
    if (!this.showToolBanner) {
      this.showToolBanner = true
    }
    this.toolBannerOpacity = 1
    this.startDotsAnimator()
  }

  private markLastToolDone(): void {
    this.stopDotsAnimator()
    const items = this.toolStatusItems
    if (items.length > 0) {
      const last = items[items.length - 1]
      last.done = true
      last.dots = ''
    }
  }

  private dismissToolBanner(): void {
    this.toolBannerOpacity = 0
    setTimeout(() => {
      this.showToolBanner = false
      this.toolStatusItems = []
    }, 450)
  }

  private async handleSend() {
    const text = this.inputContent.trim()
    if (!text) {
      return
    }
    if (this.isLoading) {
      return
    }
    if (!this.aiSettings || !this.aiSettings.model) {
      showToast(this.getUIContext(), '请先在「设置 > AI助手」中配置 AI 接口', 2000)
      return
    }

    const userMsg: ChatMessage = {
      role: 'user',
      content: text,
      id: Date.now().toString()
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
    this.startTimer()

    try {
      this.inputController.stopEditing()
    } catch (e) {}

    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom)
    }, 100)

    try {
      const result = await runChatAgent(text, this.aiSettings, this.messages, undefined, (name: string) => {
        this.pushToolStatus(name)
      }, this.abortSignal)
      if (result.toolRounds.length > 0) {
        this.markLastToolDone()
        setTimeout(() => {
          this.dismissToolBanner()
        }, 600)
      }

      const assistMsgId = (Date.now() + 1).toString()
      this.isLoading = false
      this.abortSignal = null
      this.editingMessageId = ''

      this.streamingContent = ''
      this.typewriter.start(result.text, {
        onTick: (displayed: string) => {
          this.streamingContent = displayed
        },
        onDone: () => {
          const assistMsg: ChatMessage = {
            role: 'assistant',
            content: typeof result.text === 'string' ? result.text : String(result.text),
            id: assistMsgId
          }
          this.messages.push(assistMsg)
          this.streamingContent = ''
          this.stopTimer()
        }
      })
    } catch (err) {
      this.isLoading = false
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
        this.messages.push(errMsg)
      }
    } finally {
      setTimeout(() => {
        this.scroller.scrollEdge(Edge.Bottom)
      }, 100)
    }
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
    this.elapsedTime = ''
    this.timerVisible = false
    this.timerOpacity = 0
    this.showToolBanner = false
    this.toolStatusItems = []
    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom)
    }, 200)
  }

  private safeDisplayText(value: string): string {
    if (typeof value !== 'string') {
      return ''
    }
    const lower = value.toLowerCase()
    if (lower.includes('[object object]')) {
      return '...'
    }
    return value
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

    // 回填内容到输入框
    this.inputContent = msg.content
    this.editingMessageId = msg.id

    // 删除该消息之后的所有消息（保留该消息之前的历史）
    this.messages = this.messages.slice(0, msgIndex + 1)

    // 清理状态
    this.typewriter.cancel()
    this.streamingContent = ''
    this.editingMessageId = ''
    this.abortSignal = null
    this.clearTimers()
    this.elapsedTime = ''
    this.timerVisible = false
    this.timerOpacity = 0
    this.showToolBanner = false
    this.toolStatusItems = []

    // 聚焦输入框
    setTimeout(() => {
      this.inputContent = this.inputContent
    }, 100)
  }

  private toolLabelOf(name: string): string {
    switch (name) {
      case 'list_subscribed_feeds':
        return '查询订阅源'
      case 'get_feed_entries':
        return '获取文章列表'
      case 'get_today_updates':
        return '查询今日更新'
      case 'get_entry_detail':
        return '查看文章详情'
      case 'get_unread_count':
        return '统计未读'
      case 'web_search':
        return '网络搜索'
      case 'add_feed':
        return '添加订阅源'
      default:
        return name
    }
  }

  @Builder
  private MarkdownText(content: string) {
    Text() {
      ForEach(this.parsedLines(content), (line: MdLine, idx: number) => {
        if (line.kind === MdLineKind.Blank) {
          Span('\n')
        } else if (line.kind === MdLineKind.CodeBlock) {
          if (line.spans.length > 0) {
            Span(line.spans[0].text)
              .fontSize(13)
              .fontColor('#E879F9')
          }
          Span('\n')
        } else {
          if (line.kind === MdLineKind.Bullet) {
            Span('• ')
              .fontColor(this.theme.textMuted)
          } else if (line.kind === MdLineKind.Ordered) {
            Span(`${line.orderedIndex}. `)
              .fontColor(this.theme.textMuted)
          }
          ForEach(line.spans, (span: MdSpan, si: number) => {
            Span(span.text)
              .fontSize(this.headerSizeOf(line.kind))
              .fontWeight(span.bold || this.isHeaderKind(line.kind) ? FontWeight.Bold : FontWeight.Normal)
              .fontColor(span.code ? '#E879F9' : this.theme.textPrimary)
              .fontStyle(span.italic ? FontStyle.Italic : FontStyle.Normal)
          }, (span: MdSpan, si: number) => `s_${idx}_${si}`)
          Span('\n')
        }
      }, (line: MdLine, idx: number) => `l_${idx}`)
    }
    .copyOption(CopyOptions.LocalDevice)
    .fontSize(15)
    .fontColor(this.theme.textPrimary)
    .lineHeight(22)
  }

  private parsedLines(content: string): MdLine[] {
    return parseMarkdown(content)
  }

  private isHeaderKind(kind: MdLineKind): boolean {
    return kind === MdLineKind.H1 || kind === MdLineKind.H2 || kind === MdLineKind.H3
  }

  private headerSizeOf(kind: MdLineKind): number {
    switch (kind) {
      case MdLineKind.H1:
        return 20
      case MdLineKind.H2:
        return 18
      case MdLineKind.H3:
        return 16
      default:
        return 15
    }
  }

  @Builder
  private ToolStatusBanner() {
    Column() {
      ForEach(this.toolStatusItems, (item: ToolStatusItem, idx: number) => {
        Row() {
          if (item.done) {
            SymbolGlyph($r('sys.symbol.checkmark_circle_fill'))
              .fontSize(12)
              .fontColor(['#16A34A'])
              .margin({ right: 6 })
          } else {
            SymbolGlyph($r('sys.symbol.arrow_2_circlepath'))
              .fontSize(12)
              .fontColor(['#7A5AF8'])
              .margin({ right: 6 })
          }
          Text(`${item.label}${item.dots}`)
            .fontSize(11)
            .fontColor(this.theme.textSecondary)
        }
        .opacity(item.opacity)
        .padding({ top: 2, bottom: 2 })
        .animation({ duration: 200, curve: Curve.EaseOut })
      }, (item: ToolStatusItem) => item.key)
    }
    .padding({ left: 12, right: 12, top: 6, bottom: 6 })
    .borderRadius(12)
    .backgroundColor(this.theme.surface)
    .border({ width: 1, color: this.theme.divider })
    .alignItems(HorizontalAlign.Start)
    .opacity(this.toolBannerOpacity)
    .animation({ duration: 300, curve: Curve.EaseInOut })
  }

  @Builder
  private TimerDisplay() {
    Row() {
      SymbolGlyph($r('sys.symbol.timer'))
        .fontSize(11)
        .fontColor(['#7A5AF8'])
        .margin({ right: 5 })
      Text(this.elapsedTime)
        .fontSize(11)
        .fontColor(this.theme.textSecondary)
        .fontFamily('monospace')
    }
    .padding({ left: 10, right: 10, top: 4, bottom: 4 })
    .borderRadius(10)
    .backgroundColor(this.theme.surface)
    .border({ width: 1, color: this.theme.divider })
    .opacity(this.timerOpacity)
    .animation({ duration: 300, curve: Curve.EaseInOut })
  }

  @Builder
  private SettingsSheetOverlay() {
    Column() {
      AIAssistantSettingsPanel({
        onSettingsChange: (settings: HarmonySettings) => {
          void this.loadSettings()
        }
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  @Builder
  private HistorySheetOverlay() {
    Column() {
      AIChatHistoryPanel({
        theme: this.theme,
        onLoadSession: (session: ChatSession) => {
          this.loadSessionFromHistory(session)
        },
        onClose: () => {
          this.showHistory = false
        },
      })
    }
    .width('100%')
    .height('100%')
    .backgroundColor(this.theme.background)
  }

  private chatTitleMenus(): HdsNavigationMenuContentOptions {
    return {
      value: [
        {
          content: {
            label: '新对话',
            icon: $r('sys.symbol.plus'),
            isEnabled: true,
            action: () => {
              this.startNewConversation()
            },
          },
        },
        {
          content: {
            label: '历史对话',
            icon: $r('sys.symbol.arrow_counterclockwise_clock'),
            isEnabled: true,
            action: () => {
              this.showHistory = true
            },
          },
        },
        {
          content: {
            label: 'AI助手设置',
            icon: $r('sys.symbol.gearshape'),
            isEnabled: true,
            action: () => {
              this.showAISettings = true
            },
          },
        },
      ],
    }
  }

  build() {
    HdsNavigation() {
      Column() {
        Column() {
          Column() {
            if (this.messages.length === 0) {
              Scroll() {
                Column() {
                  Blank()
                    .height(90)

                  Image($r('app.media.ri_ai'))
                    .width(64)
                    .height(64)
                    .objectFit(ImageFit.Contain)
                    .fillColor('#7A5AF8')
                    .margin({ bottom: 18 })

                  Text('Livo AI')
                    .fontSize(26)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(this.theme.textPrimary)
                    .margin({ bottom: 8 })

                  Text('您好，有什么可以帮您的？')
                    .fontSize(15)
                    .fontColor(this.theme.textSecondary)
                    .textAlign(TextAlign.Center)
                    .lineHeight(20)
                    .margin({ bottom: 32 })

                  Column({ space: 10 }) {
                    Row() {
                      SymbolGlyph($r('sys.symbol.bolt_fill'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('我订阅了哪些源？')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('我订阅了哪些源？')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.doc_plaintext'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('今天有什么更新？')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('今天有哪些订阅源更新了？')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.list_number'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('有多少未读文章？')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('我有多少未读文章？')
                    })
                  }
                  .width('100%')
                  .margin({ bottom: 40 })

                  Blank()
                    .height(40)
                }
                .width('100%')
                .padding({ left: 24, right: 24 })
              }
              .width('100%')
              .scrollBar(BarState.Off)
            } else {
              Scroll(this.scroller) {
                Column() {
                  Blank()
                    .layoutWeight(1)

                  ForEach(this.messages, (item: ChatMessage) => {
                    Column() {
                      if (item.role === 'user') {
                        Row() {
                          Blank()
                          Column() {
                            Row() {
                              Text(this.safeDisplayText(item.content))
                                .fontSize(15)
                                .fontColor('#FFFFFF')
                                .lineHeight(20)
                                .copyOption(CopyOptions.LocalDevice)
                                .layoutWeight(1)

                              SymbolGlyph($r('sys.symbol.arrowshape_turn_up_left'))
                                .fontSize(14)
                                .fontColor(['rgba(255,255,255,0.7)'])
                                .margin({ left: 8 })
                                .onClick(() => {
                                  this.handleEditMessage(item.id)
                                })
                            }
                            .padding({ left: 16, right: 16, top: 12, bottom: 12 })
                          }
                          .backgroundColor('#7A5AF8')
                          .borderRadius(16)
                          .constraintSize({ maxWidth: '80%' })

                          Image($r('app.media.ri_ai'))
                            .width(32)
                            .height(32)
                            .objectFit(ImageFit.Contain)
                            .fillColor('#7A5AF8')
                            .borderRadius(16)
                            .backgroundColor(this.theme.surface)
                            .padding(4)
                            .margin({ left: 10 })
                        }
                        .width('100%')
                        .margin({ bottom: 14 })
                        .alignItems(VerticalAlign.Top)
                      } else {
                        Row() {
                          Image($r('app.media.ri_ai'))
                            .width(32)
                            .height(32)
                            .objectFit(ImageFit.Contain)
                            .fillColor('#7A5AF8')
                            .borderRadius(16)
                            .backgroundColor(this.theme.surface)
                            .padding(4)
                            .margin({ right: 10 })

                          Column() {
                            Text(item.role === 'system' ? '系统提示' : 'Livo AI')
                              .fontSize(11)
                              .fontColor(this.theme.textMuted)
                              .fontWeight(FontWeight.Medium)
                              .margin({ bottom: 4 })

                            Column() {
                              if (item.role === 'system') {
                                Text(this.safeDisplayText(item.content))
                                  .fontSize(15)
                                  .fontColor('#DC2626')
                                  .lineHeight(20)
                              } else {
                                this.MarkdownText(item.content)
                              }
                            }
                            .padding({ left: 16, right: 16, top: 12, bottom: 12 })
                            .backgroundColor(this.theme.surface)
                            .borderRadius(16)
                            .border({ width: 1, color: this.theme.divider })
                            .constraintSize({ maxWidth: '85%' })
                          }
                          .alignItems(HorizontalAlign.Start)

                          Blank()
                        }
                        .width('100%')
                        .margin({ bottom: 14 })
                        .alignItems(VerticalAlign.Top)
                      }
                    }
                  }, (item: ChatMessage) => item.id)

                  if (!this.isLoading && this.streamingContent) {
                    Row() {
                      Image($r('app.media.ri_ai'))
                        .width(32)
                        .height(32)
                        .objectFit(ImageFit.Contain)
                        .fillColor('#7A5AF8')
                        .borderRadius(16)
                        .backgroundColor(this.theme.surface)
                        .padding(4)
                        .margin({ right: 10 })

                      Column() {
                        Text('Livo AI')
                          .fontSize(11)
                          .fontColor(this.theme.textMuted)
                          .fontWeight(FontWeight.Medium)
                          .margin({ bottom: 4 })

                        Column() {
                          Text(this.streamingContent)
                            .fontSize(15)
                            .fontColor(this.theme.textPrimary)
                            .lineHeight(22)
                            .copyOption(CopyOptions.LocalDevice)
                        }
                        .padding({ left: 16, right: 16, top: 12, bottom: 12 })
                        .backgroundColor(this.theme.surface)
                        .borderRadius(16)
                        .border({ width: 1, color: this.theme.divider })
                        .constraintSize({ maxWidth: '85%' })
                      }
                      .alignItems(HorizontalAlign.Start)

                      Blank()
                    }
                    .width('100%')
                    .margin({ bottom: 14 })
                    .alignItems(VerticalAlign.Top)
                  }

                  if (this.isLoading) {
                    Row() {
                      Image($r('app.media.ri_ai'))
                        .width(32)
                        .height(32)
                        .objectFit(ImageFit.Contain)
                        .fillColor('#7A5AF8')
                        .borderRadius(16)
                        .backgroundColor(this.theme.surface)
                        .padding(4)
                        .margin({ right: 10 })

                      Column() {
                        Text('Livo AI')
                          .fontSize(11)
                          .fontColor(this.theme.textMuted)
                          .fontWeight(FontWeight.Medium)
                          .margin({ bottom: 4 })

                        Row() {
                          LoadingProgress()
                            .width(14)
                            .height(14)
                            .color('#7A5AF8')
                            .margin({ right: 6 })
                          Text('正在处理...')
                            .fontSize(14)
                            .fontColor(this.theme.textMuted)
                        }
                        .padding({ left: 16, right: 16, top: 10, bottom: 10 })
                        .backgroundColor(this.theme.surface)
                        .borderRadius(16)
                        .border({ width: 1, color: this.theme.divider })
                      }
                      .alignItems(HorizontalAlign.Start)

                      Blank()
                    }
                    .width('100%')
                    .margin({ bottom: 14 })
                    .alignItems(VerticalAlign.Top)
                  }
                }
                .width('100%')
                .padding({ left: 16, right: 16 })
                .constraintSize({ minHeight: '100%' })
              }
              .width('100%')
              .layoutWeight(1)
              .scrollBar(BarState.Off)
              .edgeEffect(EdgeEffect.Spring)
            }
          }
          .width('100%')
          .layoutWeight(1)

          if (this.showToolBanner || this.timerVisible) {
            Row() {
              if (this.showToolBanner) {
                this.ToolStatusBanner()
              }
              if (this.timerVisible) {
                Blank()
                  .width(8)
                this.TimerDisplay()
              }
            }
            .width('100%')
            .padding({ left: 20, right: 20, bottom: 4 })
            .justifyContent(FlexAlign.Start)
          }

          Column() {
            Column() {
              Row() {
                TextArea({
                  text: this.inputContent,
                  placeholder: '输入您想了解的内容...',
                  controller: this.inputController
                })
                  .layoutWeight(1)
                  .placeholderColor(this.theme.textMuted)
                  .fontColor(this.theme.textPrimary)
                  .backgroundColor('#00000000')
                  .fontSize(15)
                  .maxLines(5)
                  .onChange((val: string) => {
                    this.inputContent = val
                  })
                  .onSubmit(() => {
                    this.handleSend()
                  })

                Row() {
                  if (this.isLoading) {
                    SymbolGlyph($r('sys.symbol.xmark_circle_fill'))
                      .fontSize(16)
                      .fontColor(['#FFFFFF'])
                  } else {
                    SymbolGlyph($r('sys.symbol.paperplane_fill'))
                      .fontSize(16)
                      .fontColor([this.inputContent.trim() ? '#FFFFFF' : this.theme.textMuted])
                  }
                }
                .width(36)
                .height(36)
                .borderRadius(18)
                .justifyContent(FlexAlign.Center)
                .alignItems(VerticalAlign.Center)
                .backgroundColor(this.isLoading ? '#DC2626' : (this.inputContent.trim() ? '#7A5AF8' : this.theme.divider))
                .onClick(() => {
                  if (this.isLoading) {
                    this.handleStop()
                  } else {
                    this.handleSend()
                  }
                })
              }
              .width('100%')
              .alignItems(VerticalAlign.Bottom)

              Row() {
                Row() {
                  SymbolGlyph($r('sys.symbol.at'))
                    .fontSize(18)
                    .fontColor([this.theme.textMuted])
                    .margin({ right: 16 })

                  SymbolGlyph($r('sys.symbol.paperclip'))
                    .fontSize(18)
                    .fontColor([this.theme.textMuted])
                    .margin({ right: 16 })

                  Row() {
                    SymbolGlyph($r('sys.symbol.doc_plaintext'))
                      .fontSize(12)
                      .fontColor([this.theme.textPrimary])
                      .margin({ right: 4 })
                    Text('文章')
                      .fontSize(12)
                      .fontColor(this.theme.textPrimary)
                  }
                  .padding({ left: 8, right: 8, top: 4, bottom: 4 })
                  .borderRadius(12)
                  .backgroundColor(this.theme.elevated)
                  .border({ width: 1, color: this.theme.divider })
                  .onClick(() => {
                    this.inputContent += ' [当前文章] '
                  })
                }
                .alignItems(VerticalAlign.Center)

                Blank()

                Row() {
                  SymbolGlyph($r('sys.symbol.bolt_fill'))
                    .fontSize(12)
                    .fontColor(['#7A5AF8'])
                    .margin({ right: 4 })

                  Text('智能')
                    .fontSize(12)
                    .fontColor(this.theme.textPrimary)

                  SymbolGlyph($r('sys.symbol.chevron_down'))
                    .fontSize(10)
                    .fontColor([this.theme.textMuted])
                    .margin({ left: 4 })
                }
                .padding({ left: 10, right: 10, top: 4, bottom: 4 })
                .borderRadius(14)
                .backgroundColor(this.theme.elevated)
                .border({ width: 1, color: this.theme.divider })
                .alignItems(VerticalAlign.Center)
              }
              .width('100%')
              .margin({ top: 12 })
            }
            .width('100%')
            .padding(12)
            .borderRadius(16)
            .backgroundColor(this.theme.surface)
            .border({ width: 1, color: this.theme.divider })
          }
          .width('100%')
          .padding({ left: 16, right: 16, bottom: 20, top: 12 })
          .backgroundColor(this.theme.background)
        }
        .width('100%')
        .height('100%')
        .backgroundColor(this.theme.background)
        .bindSheet($$this.showAISettings, this.SettingsSheetOverlay(), {
          detents: [SheetSize.MEDIUM],
          dragBar: false,
          showClose: false,
          backgroundColor: this.theme.background,
          preferType: SheetType.CENTER,
        })
      }
      .width('100%')
      .height('100%')
      .backgroundColor(this.theme.background)
    }
    .mode(NavigationMode.Stack)
    .titleBar({
      content: {
        title: {
          mainTitle: '',
        },
        menu: this.chatTitleMenus(),
      },
      style: {
        scrollEffectOpts: {
          enableScrollEffect: false,
          scrollEffectType: ScrollEffectType.GRADIENT_BLUR,
          blurEffectiveStartOffset: LengthMetrics.vp(0),
          blurEffectiveEndOffset: LengthMetrics.vp(30),
        },
        blurStrategy: BlurStrategy.ENABLE,
        systemMaterialEffect: {
          materialType: hdsMaterial.MaterialType.ADAPTIVE,
          materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE,
        },
        originalStyle: {
          backgroundStyle: {
            backgroundColor: '#00000000',
            maskExtraHeight: 0,
            blurRadius: 28,
          },
          contentStyle: {
            titleStyle: {
              mainTitleColor: $r('sys.color.font_primary'),
              subTitleColor: $r('sys.color.font_secondary'),
            },
            menuStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
            backIconStyle: {
              backgroundColor: $r('sys.color.comp_background_tertiary'),
              iconColor: $r('sys.color.icon_primary'),
            },
          },
        },
        scrollEffectStyle: undefined,
      },
      avoidLayoutSafeArea: true,
      enableComponentSafeArea: false,
    })
    .titleMode(HdsNavigationTitleMode.MINI)
    .hideBackButton(false)
    .bindSheet($$this.showHistory, this.HistorySheetOverlay(), {
      detents: [SheetSize.MEDIUM],
      dragBar: false,
      showClose: false,
      backgroundColor: this.theme.background,
      preferType: SheetType.CENTER,
    })
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    .width('100%')
    .height('100%')
  }
}

interface ToolStatusItem {
  key: string
  label: string
  name: string
  opacity: number
  dots: string
  done: boolean
}
