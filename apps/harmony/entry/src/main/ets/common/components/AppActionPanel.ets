import { LengthMetrics } from '@kit.ArkUI'
import {
  HdsNavigation,
  HdsNavigationMenuContentOptions,
  HdsNavigationTitleMode,
  BlurStrategy,
  ScrollEffectType,
  hdsMaterial,
} from '@kit.UIDesignKit'
import { runAppActionAgent, AppActionAgentResult, AppActionAgentRound } from '../services/AppActionAgentService'
import { ThemePalette } from '../services/ThemeService'
import { showToast } from '../utils/PageToastHelper'
import { Typewriter } from '../utils/Typewriter'
import { parseMarkdown, MdLine, MdLineKind, MdSpan } from '../utils/MarkdownParser'

interface ActionMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  id: string
  executedActions?: string[]
}

interface ToolStatusItem {
  key: string
  label: string
  name: string
  opacity: number
  dots: string
  done: boolean
}

@Component
export struct AppActionPanel {
  @Prop theme: ThemePalette
  @Prop context: string = ''
  onClose: () => void = () => {}

  @State messages: ActionMessage[] = []
  @State inputContent: string = ''
  @State isLoading: boolean = false
  @State showHistory: boolean = false
  @State streamingContent: string = ''
  @State currentSessionId: string = ''

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
  }

  aboutToDisappear() {
    this.typewriter.cancel()
    this.clearTimers()
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

    const userMsg: ActionMessage = {
      role: 'user',
      content: text,
      id: Date.now().toString()
    }

    this.typewriter.cancel()
    this.streamingContent = ''

    this.messages.push(userMsg)
    this.inputContent = ''
    this.isLoading = true

    this.startTimer()

    try {
      this.inputController.stopEditing()
    } catch (e) {}

    setTimeout(() => {
      this.scroller.scrollEdge(Edge.Bottom)
    }, 100)

    try {
      const history = this.messages.map(m => ({ role: m.role, content: m.content }))
      const result = await runAppActionAgent(text, history)
      
      if (result.rounds.length > 0) {
        for (const round of result.rounds) {
          this.pushToolStatus(round.name)
        }
        this.markLastToolDone()
        setTimeout(() => {
          this.dismissToolBanner()
        }, 600)
      }

      const assistMsgId = (Date.now() + 1).toString()
      this.isLoading = false

      this.streamingContent = ''
      this.typewriter.start(result.text, {
        onTick: (displayed: string) => {
          this.streamingContent = displayed
        },
        onDone: () => {
          const assistMsg: ActionMessage = {
            role: 'assistant',
            content: result.text,
            id: assistMsgId,
            executedActions: result.executedActions
          }
          this.messages.push(assistMsg)
          this.streamingContent = ''
          this.stopTimer()
        }
      })
    } catch (err) {
      this.isLoading = false
      this.stopTimer()
      this.dismissToolBanner()
      const errMsg: ActionMessage = {
        role: 'system',
        content: err instanceof Error ? err.message : String(err),
        id: (Date.now() + 1).toString()
      }
      this.messages.push(errMsg)
    } finally {
      setTimeout(() => {
        this.scroller.scrollEdge(Edge.Bottom)
      }, 100)
    }
  }

  private handleSuggestionClick(text: string) {
    this.inputContent = text
    this.handleSend()
  }

  private startNewConversation(): void {
    this.messages = []
    this.currentSessionId = Date.now().toString()
    this.streamingContent = ''
    this.clearTimers()
    this.elapsedTime = ''
    this.timerVisible = false
    this.timerOpacity = 0
    this.showToolBanner = false
    this.toolStatusItems = []
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

  private toolLabelOf(name: string): string {
    switch (name) {
      case 'list_subscriptions':
        return '查询订阅'
      case 'list_builtin_feeds':
        return '查看推荐订阅源'
      case 'add_subscription':
        return '添加订阅'
      case 'add_builtin_subscription':
        return '添加推荐订阅'
      case 'remove_subscription':
        return '删除订阅'
      case 'toggle_theme_mode':
        return '切换主题'
      case 'change_accent_color':
        return '更改主题色'
      case 'view_starred_entries':
        return '查看收藏'
      case 'view_chat_history':
        return '查看历史'
      case 'view_refresh_log':
        return '查看刷新日志'
      case 'get_unread_stats':
        return '未读统计'
      case 'mark_all_read':
        return '标记已读'
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

                  SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
                    .fontSize(64)
                    .fontColor(['#7A5AF8'])
                    .margin({ bottom: 18 })

                  Text('Livo 操作助手')
                    .fontSize(26)
                    .fontWeight(FontWeight.Bold)
                    .fontColor(this.theme.textPrimary)
                    .margin({ bottom: 8 })

                  Text('您好，我可以帮您完成应用中的各种操作')
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
                      SymbolGlyph($r('sys.symbol.star_fill'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('查看推荐订阅源')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('查看推荐订阅源')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.moon_fill'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('切换到深色模式')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('切换到深色模式')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.star_fill'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('查看我的收藏')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('查看我的收藏内容')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.arrow_counterclockwise_clock'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('查看历史对话')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('查看历史对话')
                    })
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
                      SymbolGlyph($r('sys.symbol.moon_fill'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('切换到深色模式')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('切换到深色模式')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.star_fill'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('查看我的收藏')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('查看我的收藏内容')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.arrow_counterclockwise_clock'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('查看历史对话')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('查看历史对话')
                    })

                    Row() {
                      SymbolGlyph($r('sys.symbol.doc_plaintext'))
                        .fontSize(14)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 8 })
                      Text('查看未读统计')
                        .fontSize(14)
                        .fontColor(this.theme.textPrimary)
                    }
                    .width('100%')
                    .padding(14)
                    .backgroundColor(this.theme.surface)
                    .borderRadius(10)
                    .border({ width: 1, color: this.theme.divider })
                    .onClick(() => {
                      this.handleSuggestionClick('查看未读统计')
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

                  ForEach(this.messages, (item: ActionMessage) => {
                    Column() {
                      if (item.role === 'user') {
                        Row() {
                          Blank()
                          Row() {
                            Text(this.safeDisplayText(item.content))
                              .fontSize(15)
                              .fontColor('#FFFFFF')
                              .lineHeight(20)
                              .copyOption(CopyOptions.LocalDevice)
                          }
                          .padding({ left: 16, right: 16, top: 12, bottom: 12 })
                          .backgroundColor('#7A5AF8')
                          .borderRadius(16)
                          .constraintSize({ maxWidth: '80%' })

                          SymbolGlyph($r('sys.symbol.person_crop_circle_fill'))
                            .fontSize(32)
                            .fontColor(['#7A5AF8'])
                            .margin({ left: 10 })
                        }
                        .width('100%')
                        .margin({ bottom: 14 })
                        .alignItems(VerticalAlign.Top)
                      } else {
                        Row() {
                          SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
                            .fontSize(32)
                            .fontColor(['#7A5AF8'])
                            .margin({ right: 10 })

                          Column() {
                            Text('操作助手')
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
                  }, (item: ActionMessage) => item.id)

                  if (!this.isLoading && this.streamingContent) {
                    Row() {
                      SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
                        .fontSize(32)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 10 })

                      Column() {
                        Text('操作助手')
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
                      SymbolGlyph($r('sys.symbol.bolt_circle_fill'))
                        .fontSize(32)
                        .fontColor(['#7A5AF8'])
                        .margin({ right: 10 })

                      Column() {
                        Text('操作助手')
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
                  placeholder: '告诉我您想做什么...',
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
                  SymbolGlyph($r('sys.symbol.paperplane_fill'))
                    .fontSize(16)
                    .fontColor([this.inputContent.trim() ? '#FFFFFF' : this.theme.textMuted])
                }
                .width(36)
                .height(36)
                .borderRadius(18)
                .justifyContent(FlexAlign.Center)
                .alignItems(VerticalAlign.Center)
                .backgroundColor(this.inputContent.trim() ? '#7A5AF8' : this.theme.divider)
                .onClick(() => {
                  this.handleSend()
                })
              }
              .width('100%')
              .alignItems(VerticalAlign.Bottom)
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
    .ignoreLayoutSafeArea([LayoutSafeAreaType.SYSTEM], [LayoutSafeAreaEdge.TOP, LayoutSafeAreaEdge.BOTTOM])
    .width('100%')
    .height('100%')
  }
}
